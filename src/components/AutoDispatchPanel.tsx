/**
 * -----------------------------------------------------------
 * AUTO-DISPATCH AI SUGGESTION PANEL
 *
 * Analyzes unassigned/pending loads against live driver positions
 * and suggests the best driver for each load based on:
 *   1. Proximity (Haversine distance to pickup)
 *   2. Availability (shift status: on_duty > idle > off_duty)
 *   3. Active load count (fewer = higher rank)
 *
 * All math runs client-side. Zero external API calls.
 * -----------------------------------------------------------
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { optimizeRoute } from "@/hooks/useRouteOptimizer";
import { Bot, MapPin, Truck, CheckCircle2, AlertCircle, RefreshCw, User } from "lucide-react";

// --- Types ---------------------------------------------

interface LiveDriverProp {
    driverId: string;
    name: string;
    lat: number;
    lng: number;
    shiftStatus: string;
    activeLoadId: string | null;
}

interface AutoDispatchPanelProps {
    liveDrivers: LiveDriverProp[];
}

interface UnassignedLoad {
    id: string;
    reference_number: string;
    client_name: string | null;
    pickup_address: string | null;
    pickup_lat: number | null;
    pickup_lng: number | null;
    status: string;
}

interface DriverCandidate {
    driverId: string;
    name: string;
    distanceMiles: number;
    shiftStatus: string;
    activeLoadCount: number;
    score: number;
}

interface LoadSuggestion {
    load: UnassignedLoad;
    candidates: DriverCandidate[];
    confidence: "HIGH" | "MEDIUM" | "LOW";
}

// --- Haversine (re-uses the formula exported from useRouteOptimizer indirectly) ---
// We call optimizeRoute with 2 points to get the distance -- avoids duplicating Haversine.
// For direct use, we replicate only the math (same formula, not a new impl).
function haversineMiles(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Scoring -------------------------------------------

const SHIFT_SCORE: Record<string, number> = {
    on_duty: 100,
    idle: 60,
    break: 30,
    off_duty: 10,
};

function shiftScore(status: string): number {
    return SHIFT_SCORE[status] ?? 0;
}

function computeScore(distanceMiles: number, status: string, activeLoadCount: number): number {
    const proximity = Math.max(0, 100 - distanceMiles * 2);
    const availability = shiftScore(status);
    const loadPenalty = activeLoadCount * 15;
    return proximity + availability - loadPenalty;
}

function confidenceLevel(top: DriverCandidate): "HIGH" | "MEDIUM" | "LOW" {
    if (top.shiftStatus === "on_duty" && top.distanceMiles < 10 && top.activeLoadCount === 0) {
        return "HIGH";
    }
    if (top.score >= 100) return "MEDIUM";
    return "LOW";
}

// --- Component -----------------------------------------

export default function AutoDispatchPanel({ liveDrivers }: AutoDispatchPanelProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [assigning, setAssigning] = useState<string | null>(null);

    // Fetch unassigned/pending loads with pickup coordinates
    const { data: loads = [], isLoading: loadsLoading } = useQuery<UnassignedLoad[]>({
        queryKey: ["auto-dispatch-loads"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("daily_loads")
                .select("id, reference_number, client_name, pickup_address, pickup_lat, pickup_lng, status")
                .in("status", ["pending", "unassigned"])
                .is("driver_id", null)
                .not("pickup_lat", "is", null)
                .not("pickup_lng", "is", null)
                .order("created_at", { ascending: true })
                .limit(20);
            if (error) throw new Error(error.message);
            return (data ?? []) as UnassignedLoad[];
        },
        refetchInterval: 30000,
    });

    // Fetch active load counts per driver (loads currently in progress)
    const { data: activeLoadCounts = {} } = useQuery<Record<string, number>>({
        queryKey: ["auto-dispatch-active-counts"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("daily_loads")
                .select("driver_id")
                .in("status", ["in_progress", "assigned", "picked_up"])
                .not("driver_id", "is", null);
            if (error) throw new Error(error.message);
            const counts: Record<string, number> = {};
            for (const row of data ?? []) {
                if (row.driver_id) {
                    counts[row.driver_id] = (counts[row.driver_id] ?? 0) + 1;
                }
            }
            return counts;
        },
        refetchInterval: 30000,
    });

    // Build suggestions
    const suggestions: LoadSuggestion[] = loads.map((load) => {
        const pickupLat = load.pickup_lat as number;
        const pickupLng = load.pickup_lng as number;

        const candidates: DriverCandidate[] = liveDrivers
            .map((driver) => {
                const distanceMiles = Math.round(
                    haversineMiles(driver.lat, driver.lng, pickupLat, pickupLng) * 10,
                ) / 10;
                const activeLoadCount = activeLoadCounts[driver.driverId] ?? 0;
                const score = computeScore(distanceMiles, driver.shiftStatus, activeLoadCount);
                return {
                    driverId: driver.driverId,
                    name: driver.name,
                    distanceMiles,
                    shiftStatus: driver.shiftStatus,
                    activeLoadCount,
                    score,
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        const confidence = candidates.length > 0 ? confidenceLevel(candidates[0]) : "LOW";

        return { load, candidates, confidence };
    });

    // Assign driver to load
    const handleAssign = async (loadId: string, driverId: string) => {
        setAssigning(loadId + driverId);
        const { error } = await supabase
            .from("daily_loads")
            .update({ driver_id: driverId, status: "assigned" })
            .eq("id", loadId);
        if (error) {
            toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Driver assigned", description: "Load has been assigned successfully." });
            await queryClient.invalidateQueries({ queryKey: ["auto-dispatch-loads"] });
            await queryClient.invalidateQueries({ queryKey: ["auto-dispatch-active-counts"] });
        }
        setAssigning(null);
    };

    const confidenceBadge = (c: "HIGH" | "MEDIUM" | "LOW") => {
        if (c === "HIGH") {
            return (
                <Badge className="bg-green-500/15 text-green-700 border-0 text-[9px] font-bold">
                    HIGH
                </Badge>
            );
        }
        if (c === "MEDIUM") {
            return (
                <Badge className="bg-yellow-500/15 text-yellow-700 border-0 text-[9px] font-bold">
                    MED
                </Badge>
            );
        }
        return (
            <Badge className="bg-red-500/15 text-red-700 border-0 text-[9px] font-bold">
                LOW
            </Badge>
        );
    };

    const shiftBadge = (status: string) => {
        if (status === "on_duty") {
            return (
                <Badge className="bg-green-500/15 text-green-700 border-0 text-[9px]">
                    on duty
                </Badge>
            );
        }
        if (status === "idle") {
            return (
                <Badge className="bg-blue-500/15 text-blue-700 border-0 text-[9px]">
                    idle
                </Badge>
            );
        }
        if (status === "break") {
            return (
                <Badge className="bg-orange-500/15 text-orange-700 border-0 text-[9px]">
                    break
                </Badge>
            );
        }
        return (
            <Badge className="bg-muted text-muted-foreground border-0 text-[9px]">
                {status}
            </Badge>
        );
    };

    return (
        <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        Auto-Dispatch AI
                    </h3>
                    <Badge variant="secondary" className="text-[10px]">
                        {suggestions.length} unassigned
                    </Badge>
                </div>

                {liveDrivers.length === 0 && !loadsLoading && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                        No live driver positions available.
                    </p>
                )}

                {/* Skeleton */}
                {loadsLoading && (
                    <div className="space-y-2">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                )}

                {/* No suggestions */}
                {!loadsLoading && suggestions.length === 0 && (
                    <div className="flex flex-col items-center gap-1 py-4 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500/50" />
                        <p className="text-xs text-muted-foreground">All loads are assigned.</p>
                    </div>
                )}

                {/* Suggestion cards */}
                {!loadsLoading && suggestions.map(({ load, candidates, confidence }) => (
                    <div
                        key={load.id}
                        className="rounded-lg border border-border/50 p-3 space-y-2 bg-muted/20"
                    >
                        {/* Load header */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">
                                    {load.reference_number}
                                    {load.client_name ? ` - ${load.client_name}` : ""}
                                </p>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                                    {load.pickup_address ?? "No address"}
                                </p>
                            </div>
                            <div className="shrink-0 flex items-center gap-1">
                                {confidenceBadge(confidence)}
                                {candidates.length === 0 && (
                                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                            </div>
                        </div>

                        {/* Driver candidates */}
                        {candidates.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground">
                                No drivers with live positions available.
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {candidates.map((c, rank) => (
                                    <div
                                        key={c.driverId}
                                        className={`flex items-center gap-2 p-1.5 rounded-md transition-colors ${rank === 0 ? "bg-primary/5" : "bg-transparent"}`}
                                    >
                                        {/* Rank badge */}
                                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[9px] font-bold text-primary">
                                            {rank + 1}
                                        </div>
                                        {/* Driver info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-medium truncate flex items-center gap-1">
                                                <User className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                                {c.name}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                                                <Truck className="h-2 w-2 shrink-0" />
                                                {c.distanceMiles} mi away
                                                {" - "}
                                                {c.activeLoadCount} active
                                            </p>
                                        </div>
                                        {/* Status */}
                                        {shiftBadge(c.shiftStatus)}
                                        {/* Assign */}
                                        <Button
                                            size="sm"
                                            variant={rank === 0 ? "default" : "outline"}
                                            className="h-6 text-[10px] px-2 shrink-0"
                                            disabled={assigning !== null}
                                            onClick={() => handleAssign(load.id, c.driverId)}
                                        >
                                            {assigning === load.id + c.driverId ? (
                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                            ) : (
                                                "Assign"
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Footer note */}
                {suggestions.length > 0 && (
                    <p className="text-[9px] text-muted-foreground text-center">
                        Ranked by proximity, shift status, and active loads.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
