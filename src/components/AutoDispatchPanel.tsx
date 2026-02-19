/**
 * ═══════════════════════════════════════════════════════════
 * AUTO-DISPATCH PANEL — Smart Driver Assignment (Onfleet-Style)
 *
 * When a load is unassigned, this panel shows the best driver
 * candidates ranked by:
 *   1. Proximity (closest to pickup)
 *   2. Workload (fewest active loads today)
 *   3. Availability (on-duty, not at capacity)
 *
 * One-click to assign. No more guessing "who's nearby?"
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Zap, Truck, MapPin, Package, Clock, ArrowRight,
    CheckCircle2, User, RefreshCw, Target,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────

interface Driver {
    id: string;
    full_name: string;
    hub: string;
    status: string;
}

interface DriverCandidate {
    driver: Driver;
    activeLoads: number;
    distanceMiles: number | null; // null = no GPS data
    score: number; // lower is better
    reason: string;
}

interface AutoDispatchPanelProps {
    loadId: string;
    loadPickupAddress?: string | null;
    loadPickupLat?: number | null;
    loadPickupLng?: number | null;
    loadHub?: string;
    onAssigned?: (driverId: string) => void;
    onClose?: () => void;
}

// ─── Haversine ─────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════

export default function AutoDispatchPanel({
    loadId, loadPickupAddress, loadPickupLat, loadPickupLng, loadHub, onAssigned, onClose,
}: AutoDispatchPanelProps) {
    const { toast } = useToast();
    const [candidates, setCandidates] = useState<DriverCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<string | null>(null);

    const fetchCandidates = useCallback(async () => {
        setLoading(true);

        // 1. Get all active drivers (prefer same hub)
        const { data: drivers } = await supabase
            .from("drivers")
            .select("id, full_name, hub, status")
            .eq("status", "active") as { data: Driver[] | null };

        if (!drivers || drivers.length === 0) {
            setCandidates([]);
            setLoading(false);
            return;
        }

        // 2. Get today's load counts per driver
        const today = new Date().toISOString().split("T")[0];
        const { data: loadCounts } = await supabase
            .from("daily_loads")
            .select("driver_id")
            .eq("load_date", today)
            .neq("status", "cancelled") as { data: { driver_id: string }[] | null };

        const countMap = new Map<string, number>();
        for (const lc of loadCounts ?? []) {
            if (lc.driver_id) countMap.set(lc.driver_id, (countMap.get(lc.driver_id) ?? 0) + 1);
        }

        // 3. Get latest GPS positions — graceful fallback if RPC doesn't exist
        const posMap = new Map<string, { lat: number; lng: number }>();
        try {
            const { data: positions } = await supabase
                .rpc("get_driver_positions") as { data: any[] | null };

            for (const pos of positions ?? []) {
                posMap.set(pos.driver_id, { lat: pos.latitude, lng: pos.longitude });
            }
        } catch {
            // RPC may not exist yet — GPS scoring will be skipped
        }

        // 4. Score each driver
        const scored: DriverCandidate[] = drivers.map((driver) => {
            const activeLoads = countMap.get(driver.id) ?? 0;
            let distanceMiles: number | null = null;
            let distanceScore = 50; // default if no GPS

            // GPS distance
            const gps = posMap.get(driver.id);
            if (gps && loadPickupLat && loadPickupLng) {
                distanceMiles = Math.round(haversine(gps.lat, gps.lng, loadPickupLat, loadPickupLng) * 10) / 10;
                distanceScore = distanceMiles;
            }

            // Hub preference — meaningful bonus so same-hub drivers rank higher
            const hubBonus = (loadHub && driver.hub === loadHub) ? -15 : 0;

            // Workload penalty (more loads = higher score)
            const workloadPenalty = activeLoads * 10;

            // Final score (lower = better)
            const score = distanceScore + workloadPenalty + hubBonus;

            // Reason
            let reason = "";
            if (distanceMiles !== null) {
                reason = `${distanceMiles} mi away`;
            } else {
                reason = driver.hub === loadHub ? "Same hub" : `${driver.hub} hub`;
            }
            if (activeLoads > 0) reason += ` · ${activeLoads} active loads`;

            return { driver, activeLoads, distanceMiles, score, reason };
        });

        // Sort by score (best first)
        scored.sort((a, b) => a.score - b.score);
        setCandidates(scored.slice(0, 8)); // Show top 8
        setLoading(false);
    }, [loadHub, loadPickupLat, loadPickupLng]);

    useEffect(() => {
        fetchCandidates();
    }, [fetchCandidates]);

    const assignDriver = async (driverId: string) => {
        setAssigning(driverId);
        const { error } = await supabase
            .from("daily_loads")
            .update({ driver_id: driverId, status: "assigned" })
            .eq("id", loadId);

        if (error) {
            toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
        } else {
            const driver = candidates.find((c) => c.driver.id === driverId);
            toast({
                title: "🚛 Driver assigned!",
                description: `${driver?.driver.full_name ?? "Driver"} assigned to this load`,
            });
            onAssigned?.(driverId);
        }
        setAssigning(null);
    };

    const bestCandidate = candidates[0];

    return (
        <Card className="border-0 shadow-lg">
            <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Smart Assignment
                    </h3>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={fetchCandidates}>
                            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        {onClose && (
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClose}>✕</Button>
                        )}
                    </div>
                </div>

                {loadPickupAddress && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {loadPickupAddress}
                    </p>
                )}

                {loading ? (
                    <div className="py-6 text-center">
                        <Target className="h-8 w-8 text-primary animate-pulse mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Finding best drivers...</p>
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="py-4 text-center">
                        <p className="text-sm text-muted-foreground">No active drivers available</p>
                    </div>
                ) : (
                    <>
                        {/* Best match highlight */}
                        {bestCandidate && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-amber-500/20 text-amber-600 border-0 text-[9px]">⭐ Best Match</Badge>
                                    <span className="text-xs text-muted-foreground">{bestCandidate.reason}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                                            <User className="h-4 w-4 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">{bestCandidate.driver.full_name}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {bestCandidate.distanceMiles !== null ? `${bestCandidate.distanceMiles} mi away` : bestCandidate.driver.hub}
                                                {bestCandidate.activeLoads > 0 ? ` · ${bestCandidate.activeLoads} loads today` : " · Available"}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="bg-amber-500 hover:bg-amber-600 text-white h-8 gap-1"
                                        disabled={assigning !== null}
                                        onClick={() => assignDriver(bestCandidate.driver.id)}
                                    >
                                        {assigning === bestCandidate.driver.id ? (
                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <><ArrowRight className="h-3 w-3" /> Assign</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Other candidates */}
                        {candidates.length > 1 && (
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-1">
                                    Other Available Drivers
                                </p>
                                {candidates.slice(1).map((candidate) => (
                                    <div
                                        key={candidate.driver.id}
                                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                                            <Truck className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{candidate.driver.full_name}</p>
                                            <p className="text-[10px] text-muted-foreground">{candidate.reason}</p>
                                        </div>
                                        <Button
                                            variant="outline" size="sm"
                                            className="h-6 text-[10px] px-2"
                                            disabled={assigning !== null}
                                            onClick={() => assignDriver(candidate.driver.id)}
                                        >
                                            {assigning === candidate.driver.id ? "..." : "Assign"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
