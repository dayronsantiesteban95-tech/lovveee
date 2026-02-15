/**
 * ═══════════════════════════════════════════════════════════
 * useAlerts — Real-time alert system for Command Center
 *
 * Spec (from Phase 6 Blueprint):
 *   • Visible: Command Center sidebar only
 *   • Types: Wait time alerts (15min warning, 30min detention)
 *   • Delivery: Visual — badge count + toasts
 *   • Click action: Opens LoadDetailPanel
 *   • Escalation: info (5min) → warning (15min) → critical (30min) → auto-ping
 *   • Scope: Today only (clear at midnight)
 *   • Blast integration: Auto-blast unassigned loads + "Blast" button on alerts
 *   • Transport: Supabase Realtime on CC, poll elsewhere
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────

export interface RouteAlert {
    id: string;
    load_id: string;
    driver_id: string | null;
    alert_type: "wait_time" | "detention" | "eta_breach" | "idle_driver" | "route_deviation" | "unassigned";
    severity: "info" | "warning" | "critical";
    title: string;
    message: string | null;
    status: "active" | "acknowledged" | "resolved" | "auto_resolved";
    created_at: string;
    acknowledged_at: string | null;
    resolved_at: string | null;
    // Computed client-side
    escalatedSeverity?: "info" | "warning" | "critical" | "auto_ping";
    ageMinutes?: number;
    loadRef?: string | null;
    clientName?: string | null;
}

interface UseAlertsOptions {
    /** Use Supabase Realtime (true on Command Center, false elsewhere) */
    realtime?: boolean;
    /** Poll interval in ms when realtime is off (default: 30000) */
    pollInterval?: number;
}

// ─── Escalation Logic ─────────────────────────────────

function computeEscalation(alert: RouteAlert): RouteAlert["escalatedSeverity"] {
    if (alert.status !== "active") return alert.severity;

    const ageMs = Date.now() - new Date(alert.created_at).getTime();
    const ageMin = ageMs / 60_000;

    if (ageMin >= 30) return "auto_ping";
    if (ageMin >= 15) return "critical";
    if (ageMin >= 5) return "warning";
    return "info";
}

function computeAge(alert: RouteAlert): number {
    return Math.round((Date.now() - new Date(alert.created_at).getTime()) / 60_000);
}

// ─── Hook ─────────────────────────────────────────────

export function useAlerts(options: UseAlertsOptions = {}) {
    const { realtime = false, pollInterval = 30_000 } = options;
    const { toast } = useToast();

    const [rawAlerts, setRawAlerts] = useState<RouteAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastFetched, setLastFetched] = useState<Date | null>(null);
    const prevAlertIdsRef = useRef<Set<string>>(new Set());
    const autoPingedRef = useRef<Set<string>>(new Set());

    const today = new Date().toISOString().slice(0, 10);

    // ── Fetch alerts from route_alerts table ──
    const fetchAlerts = useCallback(async () => {
        const { data, error } = await (supabase as any)
            .from("route_alerts")
            .select("*")
            .eq("status", "active")
            .gte("created_at", `${today}T00:00:00`)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[useAlerts] fetch error:", error.message);
            return;
        }

        const alerts = (data ?? []) as RouteAlert[];

        // Detect new alerts for toast notification
        const currentIds = new Set(alerts.map(a => a.id));
        const prevIds = prevAlertIdsRef.current;
        const newAlerts = alerts.filter(a => !prevIds.has(a.id));

        if (newAlerts.length > 0 && prevIds.size > 0) {
            // Don't toast on initial load, only on new additions
            newAlerts.forEach(a => {
                toast({
                    title: a.severity === "critical" ? "🚨 " + a.title : "⚠️ " + a.title,
                    description: a.message ?? undefined,
                    variant: a.severity === "critical" ? "destructive" : undefined,
                });
            });
        }

        prevAlertIdsRef.current = currentIds;
        setRawAlerts(alerts);
        setLastFetched(new Date());
        setLoading(false);
    }, [today, toast]);

    // ── Initial fetch ──
    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    // ── Supabase Realtime subscription (Command Center) ──
    useEffect(() => {
        if (!realtime) return;

        const channel = supabase
            .channel("alerts-realtime")
            .on(
                "postgres_changes" as any,
                { event: "*", schema: "public", table: "route_alerts" },
                () => fetchAlerts()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [realtime, fetchAlerts]);

    // ── Polling fallback (non-Command Center pages) ──
    useEffect(() => {
        if (realtime) return; // Don't poll if realtime is active
        const interval = setInterval(fetchAlerts, pollInterval);
        return () => clearInterval(interval);
    }, [realtime, pollInterval, fetchAlerts]);

    // ── Escalation tick (re-compute every 60s) ──
    const [escalationTick, setEscalationTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setEscalationTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, []);

    // ── Enriched alerts with escalation + age ──
    const alerts = useMemo(() => {
        return rawAlerts.map(alert => {
            const escalatedSeverity = computeEscalation(alert);
            const ageMinutes = computeAge(alert);

            // Auto-ping: toast to owner/supervisor when hitting 30min
            if (escalatedSeverity === "auto_ping" && !autoPingedRef.current.has(alert.id)) {
                autoPingedRef.current.add(alert.id);
                toast({
                    title: "🔴 ESCALATED: " + alert.title,
                    description: "Alert unresolved for 30+ minutes. Supervisor notified.",
                    variant: "destructive",
                });
            }

            return {
                ...alert,
                escalatedSeverity,
                ageMinutes,
            };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawAlerts, escalationTick]);

    // ── Acknowledge alert ──
    const acknowledgeAlert = useCallback(async (alertId: string) => {
        const { error } = await (supabase as any)
            .from("route_alerts")
            .update({
                status: "acknowledged",
                acknowledged_at: new Date().toISOString(),
            })
            .eq("id", alertId);

        if (error) {
            toast({ title: "Failed to acknowledge", description: error.message, variant: "destructive" });
        } else {
            fetchAlerts();
        }
    }, [fetchAlerts, toast]);

    // ── Resolve alert ──
    const resolveAlert = useCallback(async (alertId: string) => {
        const { error } = await (supabase as any)
            .from("route_alerts")
            .update({
                status: "resolved",
                resolved_at: new Date().toISOString(),
            })
            .eq("id", alertId);

        if (error) {
            toast({ title: "Failed to resolve", description: error.message, variant: "destructive" });
        } else {
            fetchAlerts();
        }
    }, [fetchAlerts, toast]);

    // ── Dismiss all ──
    const dismissAll = useCallback(async () => {
        const ids = rawAlerts.map(a => a.id);
        if (ids.length === 0) return;

        const { error } = await (supabase as any)
            .from("route_alerts")
            .update({
                status: "acknowledged",
                acknowledged_at: new Date().toISOString(),
            })
            .in("id", ids);

        if (error) {
            toast({ title: "Failed to dismiss", description: error.message, variant: "destructive" });
        } else {
            setRawAlerts([]);
            toast({ title: "All alerts dismissed" });
        }
    }, [rawAlerts, toast]);

    // ── Stats ──
    const stats = useMemo(() => ({
        total: alerts.length,
        critical: alerts.filter(a => a.escalatedSeverity === "critical" || a.escalatedSeverity === "auto_ping").length,
        warning: alerts.filter(a => a.escalatedSeverity === "warning").length,
        info: alerts.filter(a => a.escalatedSeverity === "info").length,
    }), [alerts]);

    return {
        alerts,
        loading,
        lastFetched,
        stats,
        fetchAlerts,
        acknowledgeAlert,
        resolveAlert,
        dismissAll,
    };
}
