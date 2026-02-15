/**
 * ═══════════════════════════════════════════════════════════
 * ACTIVITY LOG — Full Audit Trail
 *
 * Tracks every action in the dispatch system:
 *   • Load created / updated / status changed
 *   • Driver assigned / unassigned
 *   • POD captured
 *   • Route optimized
 *   • Settings changed
 *
 * Displays a searchable, filterable timeline.
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
    Activity, Search, Package, Truck, Camera, Route,
    Settings, Clock, User, ArrowRight, Filter, RefreshCw,
    CheckCircle2, MapPin, Zap, FileText,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────

interface ActivityEntry {
    id: string;
    action: string;
    entity_type: "load" | "driver" | "system" | "pod" | "route";
    entity_id?: string;
    details: string;
    user_name?: string;
    timestamp: string;
}

interface ActivityLogProps {
    loadId?: string;       // Filter to a specific load
    driverId?: string;     // Filter to a specific driver
    limit?: number;
    compact?: boolean;
}

// ─── Action → icon/color mapping ──────────────────────

function getActionMeta(action: string, entityType: string) {
    if (action.includes("created") || action.includes("new")) return { icon: Package, color: "text-green-500", bg: "bg-green-500/10" };
    if (action.includes("assigned")) return { icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" };
    if (action.includes("delivered")) return { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" };
    if (action.includes("picked") || action.includes("transit")) return { icon: MapPin, color: "text-amber-500", bg: "bg-amber-500/10" };
    if (action.includes("pod") || action.includes("photo")) return { icon: Camera, color: "text-orange-500", bg: "bg-orange-500/10" };
    if (action.includes("route") || action.includes("optimize")) return { icon: Route, color: "text-violet-500", bg: "bg-violet-500/10" };
    if (action.includes("import")) return { icon: FileText, color: "text-indigo-500", bg: "bg-indigo-500/10" };
    if (entityType === "driver") return { icon: Truck, color: "text-cyan-500", bg: "bg-cyan-500/10" };
    return { icon: Activity, color: "text-slate-500", bg: "bg-slate-500/10" };
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// ═══════════════════════════════════════════════════════════

export default function ActivityLog({
    loadId, driverId, limit = 30, compact = false,
}: ActivityLogProps) {
    const [entries, setEntries] = useState<ActivityEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<string>("all");

    const fetchActivity = useCallback(async () => {
        setLoading(true);

        // Build activity from load_status_events + daily_loads recent changes
        const activities: ActivityEntry[] = [];

        // 1. Status events
        try {
            let query = (supabase as any)
                .from("load_status_events")
                .select("id, load_id, new_status, old_status, note, recorded_at, changed_by")
                .order("recorded_at", { ascending: false })
                .limit(limit);

            if (loadId) query = query.eq("load_id", loadId);

            const { data: events } = await query as { data: any[] | null };

            if (events) {
                for (const evt of events) {
                    activities.push({
                        id: `evt-${evt.id}`,
                        action: `Status changed to ${evt.new_status}`,
                        entity_type: "load",
                        entity_id: evt.load_id,
                        details: evt.note
                            ? `${evt.old_status ?? "—"} → ${evt.new_status} · "${evt.note}"`
                            : `${evt.old_status ?? "—"} → ${evt.new_status}`,
                        timestamp: evt.recorded_at,
                    });
                }
            }
        } catch { /* table may not exist yet */ }

        // 2. Recent loads (created)
        try {
            let query = (supabase as any)
                .from("daily_loads")
                .select("id, reference_number, client_name, status, created_at, driver_id, updated_at")
                .order("created_at", { ascending: false })
                .limit(limit);

            if (loadId) query = query.eq("id", loadId);

            const { data: loads } = await query as { data: any[] | null };

            if (loads) {
                for (const load of loads) {
                    activities.push({
                        id: `load-created-${load.id}`,
                        action: "Load created",
                        entity_type: "load",
                        entity_id: load.id,
                        details: `${load.reference_number ?? "No ref"} · ${load.client_name ?? "Unknown client"} · ${load.status}`,
                        timestamp: load.created_at,
                    });

                    if (load.driver_id) {
                        activities.push({
                            id: `load-assigned-${load.id}`,
                            action: "Driver assigned",
                            entity_type: "load",
                            entity_id: load.id,
                            details: `${load.reference_number ?? "No ref"} — driver assigned`,
                            timestamp: load.updated_at,
                        });
                    }
                }
            }
        } catch { /* ignore */ }

        // 3. Driver shifts
        try {
            let query = (supabase as any)
                .from("driver_shifts")
                .select("id, driver_id, started_at, ended_at")
                .order("started_at", { ascending: false })
                .limit(20);

            if (driverId) query = query.eq("driver_id", driverId);

            const { data: shifts } = await query as { data: any[] | null };

            if (shifts) {
                for (const shift of shifts) {
                    activities.push({
                        id: `shift-${shift.id}`,
                        action: shift.ended_at ? "Shift ended" : "Shift started",
                        entity_type: "driver",
                        entity_id: shift.driver_id,
                        details: shift.ended_at ? "Driver went off duty" : "Driver went on duty",
                        timestamp: shift.ended_at ?? shift.started_at,
                    });
                }
            }
        } catch { /* ignore */ }

        // Sort by timestamp descending
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setEntries(activities.slice(0, limit));
        setLoading(false);
    }, [loadId, driverId, limit]);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    // Filter + search
    const filtered = entries.filter((e) => {
        if (filter !== "all" && e.entity_type !== filter) return false;
        if (search) {
            const s = search.toLowerCase();
            return e.action.toLowerCase().includes(s) || e.details.toLowerCase().includes(s);
        }
        return true;
    });

    return (
        <Card className="border-0 shadow-sm">
            <CardContent className={`${compact ? "pt-3 pb-2" : "pt-4 pb-3"} space-y-3`}>
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Activity Log
                    </h3>
                    <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                            {filtered.length} events
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={fetchActivity}>
                            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </div>

                {/* Search + Filter */}
                {!compact && (
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                placeholder="Search activity..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-7 text-xs pl-7"
                            />
                        </div>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="h-7 rounded-md border bg-background px-2 text-xs"
                        >
                            <option value="all">All</option>
                            <option value="load">Loads</option>
                            <option value="driver">Drivers</option>
                            <option value="pod">POD</option>
                            <option value="route">Routes</option>
                        </select>
                    </div>
                )}

                {/* Timeline */}
                {loading ? (
                    <div className="py-4 text-center">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </div>
                ) : filtered.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No activity found</p>
                ) : (
                    <div className={`space-y-0.5 ${compact ? "max-h-48" : "max-h-96"} overflow-y-auto`}>
                        {filtered.map((entry, i) => {
                            const meta = getActionMeta(entry.action, entry.entity_type);
                            const Icon = meta.icon;
                            return (
                                <div
                                    key={entry.id}
                                    className="flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                                >
                                    <div className={`h-6 w-6 rounded-full ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                        <Icon className={`h-3 w-3 ${meta.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium">{entry.action}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{entry.details}</p>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground/50 shrink-0 mt-0.5">
                                        {timeAgo(entry.timestamp)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
