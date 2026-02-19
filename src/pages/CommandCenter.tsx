import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAlerts } from "@/hooks/useAlerts";
import type { RouteAlert } from "@/hooks/useAlerts";
import { useRealtimeDriverLocations } from "@/hooks/useRealtimeDriverLocations";
import {
    Activity, AlertTriangle, CheckCircle2, Clock, Crosshair, Layers,
    MapPin, Radio, RefreshCw, Truck, Users, Zap, ChevronRight,
    CircleDot, Timer, ArrowUpRight, Package, Signal, TrendingUp,
    Eye, EyeOff, Filter, Maximize2, BarChart3, Navigation,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import LoadDetailPanel from "@/components/LoadDetailPanel";
import type { LoadDetail } from "@/components/LoadDetailPanel";
import LiveDriverMap from "@/components/LiveDriverMap";

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface Load {
    id: string;
    reference_number: string | null;
    client_name: string | null;
    driver_id: string | null;
    pickup_address: string | null;
    delivery_address: string | null;
    miles: number;
    revenue: number;
    packages: number;
    status: string;
    hub: string;
    service_type: string;
    start_time: string | null;
    end_time: string | null;
    wait_time_minutes: number;
    load_date: string;
    shift: string;
    created_at: string;
}

interface Driver {
    id: string;
    full_name: string;
    phone: string | null;
    hub: string;
    status: string;
}



// ═══════════════════════════════════════════
// Metric Card Component
// ═══════════════════════════════════════════

function MetricCard({
    label,
    value,
    icon: Icon,
    trend,
    variant = "default",
    compact = false,
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    trend?: { direction: "up" | "down" | "flat"; label: string };
    variant?: "default" | "success" | "warning" | "danger" | "live";
    compact?: boolean;
}) {
    const variantClasses = {
        default: "text-foreground",
        success: "text-emerald-400",
        warning: "text-amber-400",
        danger: "text-red-400",
        live: "text-emerald-400",
    };

    const glowClasses = {
        default: "",
        success: "glow-success",
        warning: "glow-warning",
        danger: "glow-danger",
        live: "glow-success",
    };

    return (
        <div className={`metric-card p-4 ${compact ? "p-3" : ""} ${glowClasses[variant]} animate-in`}>
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        {label}
                    </p>
                    <p className={`text-2xl font-bold text-data tracking-tight ${compact ? "text-xl" : ""} ${variantClasses[variant]}`}>
                        {value}
                    </p>
                    {trend && (
                        <div className="flex items-center gap-1">
                            <ArrowUpRight
                                className={`h-3 w-3 ${trend.direction === "up" ? "text-emerald-400" : trend.direction === "down" ? "text-red-400 rotate-180" : "text-muted-foreground rotate-90"}`}
                            />
                            <span className="text-[10px] text-muted-foreground">{trend.label}</span>
                        </div>
                    )}
                </div>
                <div className={`relative p-2 rounded-lg ${variant === "live" ? "bg-emerald-500/10" : "bg-muted/50"}`}>
                    <Icon className={`h-4 w-4 ${variantClasses[variant]}`} />
                    {variant === "live" && (
                        <div className="absolute top-1 right-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-marker-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// Live Status Dot
// ═══════════════════════════════════════════

function LiveDot({ status, size = "sm" }: { status: string; size?: "xs" | "sm" | "md" }) {
    const sizeClass = { xs: "h-1.5 w-1.5", sm: "h-2 w-2", md: "h-2.5 w-2.5" }[size];
    const colors: Record<string, string> = {
        pending: "bg-gray-400",
        assigned: "bg-blue-400",
        in_transit: "bg-yellow-400",
        in_progress: "bg-yellow-400",
        arrived_pickup: "bg-orange-400",
        arrived_delivery: "bg-purple-400",
        delivered: "bg-emerald-400",
        cancelled: "bg-red-400",
        failed: "bg-red-500",
        blasted: "bg-violet-400",
    };
    const isLive = status === "in_transit" || status === "in_progress";

    return (
        <span className="relative flex">
            {isLive && (
                <span className={`animate-marker-ping absolute inline-flex ${sizeClass} rounded-full ${colors[status] ?? "bg-muted-foreground"} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full ${sizeClass} ${colors[status] ?? "bg-muted-foreground"}`} />
        </span>
    );
}

// ═══════════════════════════════════════════
// Status Badge
// ═══════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { label: string; className: string }> = {
        pending: { label: "Pending", className: "bg-gray-500/15 text-gray-400 border border-gray-500/25" },
        assigned: { label: "Assigned", className: "bg-blue-500/15 text-blue-400 border border-blue-500/25" },
        in_transit: { label: "In Transit", className: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25" },
        in_progress: { label: "In Transit", className: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25" },
        arrived_pickup: { label: "At Pickup", className: "bg-orange-500/15 text-orange-400 border border-orange-500/25" },
        arrived_delivery: { label: "At Delivery", className: "bg-purple-500/15 text-purple-400 border border-purple-500/25" },
        delivered: { label: "Delivered", className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" },
        cancelled: { label: "Cancelled", className: "bg-red-500/15 text-red-400 border border-red-500/25" },
        failed: { label: "Failed", className: "bg-red-500/15 text-red-400 border border-red-500/25" },
        blasted: { label: "Blasted", className: "bg-violet-500/15 text-violet-400 border border-violet-500/25" },
    };

    const config = configs[status] ?? { label: status, className: "bg-gray-500/15 text-gray-400 border border-gray-500/25" };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-full tracking-wide uppercase ${config.className}`}>
            <LiveDot status={status} size="xs" />
            {config.label}
        </span>
    );
}

// ═══════════════════════════════════════════
// Alert Item
// ═══════════════════════════════════════════

function AlertItem({
    alert,
    onClickLoad,
    onBlast,
}: {
    alert: RouteAlert;
    onClickLoad?: (loadId: string) => void;
    onBlast?: (loadId: string) => void;
}) {
    const severity = alert.escalatedSeverity ?? alert.severity;
    const iconMap = {
        info: { Icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10", ring: "" },
        warning: { Icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", ring: "" },
        critical: { Icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", ring: "animate-glow-danger" },
        auto_ping: { Icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/15", ring: "animate-glow-danger" },
    };
    const cfg = iconMap[severity] ?? iconMap.info;
    const ageLabel = alert.ageMinutes != null
        ? alert.ageMinutes < 1 ? "just now" : `${alert.ageMinutes}m ago`
        : "";

    return (
        <div
            className={`flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group ${cfg.ring}`}
            onClick={() => onClickLoad?.(alert.load_id)}
        >
            <div className={`mt-0.5 p-1.5 rounded-md ${cfg.bg}`}>
                <cfg.Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground leading-tight">{alert.title}</p>
                    {severity === "auto_ping" && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">ESCALATED</span>
                    )}
                    {severity === "critical" && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400 font-semibold">CRITICAL</span>
                    )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{alert.message}</p>
                {/* Blast button for unassigned loads */}
                {alert.alert_type === "unassigned" && onBlast && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 mt-1 text-[9px] gap-1 text-primary hover:text-primary px-1.5"
                        onClick={(e) => { e.stopPropagation(); onBlast(alert.load_id); }}
                    >
                        <Radio className="h-2.5 w-2.5" /> Blast this load
                    </Button>
                )}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{ageLabel}</span>
        </div>
    );
}

// ═══════════════════════════════════════════
// Driver Row (sidebar)
// ═══════════════════════════════════════════

function DriverRow({ driver, assignedLoad }: { driver: Driver; assignedLoad?: Load }) {
    const statusColor = driver.status === "active"
        ? "bg-emerald-400"
        : driver.status === "on_leave"
            ? "bg-amber-400"
            : "bg-muted-foreground";

    return (
        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors group cursor-pointer">
            <div className="relative">
                <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">
                    {driver.full_name.split(" ").map(n => n[0]).join("")}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${statusColor}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{driver.full_name}</p>
                <p className="text-[10px] text-muted-foreground">
                    {assignedLoad ? assignedLoad.client_name ?? "Active load" : "Idle"}
                </p>
            </div>
            {assignedLoad && <StatusBadge status={assignedLoad.status} />}
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}

// ═══════════════════════════════════════════
// Load Row (compact, for sidebar)
// ═══════════════════════════════════════════

function LoadRow({
    load,
    driverName,
    onClick,
}: {
    load: Load;
    driverName: string;
    onClick?: () => void;
}) {
    return (
        <div
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={onClick}
        >
            <LiveDot status={load.status} size="md" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-data text-[11px] text-muted-foreground">
                        {load.reference_number || "—"}
                    </span>
                    <StatusBadge status={load.status} />
                </div>
                <p className="text-xs font-medium text-foreground truncate mt-0.5">
                    {load.client_name || "Unassigned"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                    {driverName} • {Number(load.miles).toFixed(0)} mi • ${Number(load.revenue).toFixed(0)}
                </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}

// ═══════════════════════════════════════════
// Map Placeholder (Google Maps will go here)
// ═══════════════════════════════════════════

function MapPlaceholder({ driverCount, loadCount }: { driverCount: number; loadCount: number }) {
    return (
        <div className="absolute inset-0 bg-[hsl(224,40%,4%)] flex items-center justify-center overflow-hidden">
            {/* Animated grid background */}
            <div className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `
                        linear-gradient(hsl(222 84% 55% / 0.3) 1px, transparent 1px),
                        linear-gradient(90deg, hsl(222 84% 55% / 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Simulated map elements */}
            <div className="relative z-10 text-center space-y-6">
                {/* Radar ping animation */}
                <div className="relative mx-auto w-32 h-32">
                    <div className="absolute inset-0 rounded-full border border-primary/20 animate-marker-ping" />
                    <div className="absolute inset-4 rounded-full border border-primary/15 animate-marker-ping" style={{ animationDelay: '0.5s' }} />
                    <div className="absolute inset-8 rounded-full border border-primary/10 animate-marker-ping" style={{ animationDelay: '1s' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="p-4 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20">
                            <Crosshair className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                        Google Maps Rendering Here
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Live driver positions, load routes, and status overlays will render on the map.
                        <br />
                        Add <code className="text-data text-primary text-xs">GOOGLE_MAPS_API_KEY</code> to enable.
                    </p>
                </div>

                {/* Simulated driver dots */}
                <div className="flex items-center justify-center gap-8 mt-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-marker-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
                        </span>
                        {driverCount} Drivers
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-marker-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400" />
                        </span>
                        {loadCount} Active Loads
                    </div>
                </div>
            </div>

            {/* Corner decorations */}
            <div className="absolute top-8 left-8 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                <Signal className="h-3 w-3 text-emerald-400" />
                <span>LIVE FEED READY</span>
            </div>
            <div className="absolute bottom-8 right-8 text-[10px] text-muted-foreground font-mono">
                33.4484° N, 112.0740° W — PHX
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// ═══ MAIN: COMMAND CENTER ═══════════════
// ═══════════════════════════════════════════

export default function CommandCenter() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loads, setLoads] = useState<Load[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [sidebarView, setSidebarView] = useState<"loads" | "drivers" | "alerts">("loads");
    const [filterHub, setFilterHub] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [showSidebar, setShowSidebar] = useState(true);
    const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
    const [clock, setClock] = useState(() => new Date());
    const today = new Date().toISOString().slice(0, 10);

    // ── Alerts (real-time from route_alerts table) ──
    const {
        alerts: routeAlerts,
        stats: alertStats,
        dismissAll: dismissAllAlerts,
        loading: alertsLoading,
    } = useAlerts({ realtime: true });

    // ── Singleton realtime driver locations (shared with LiveDriverMap — one subscription) ──
    const { realtimeStatus } = useRealtimeDriverLocations();

    // ── Fetch ──
    const fetchData = useCallback(async () => {
        setLoading(true);
        const [loadsRes, driversRes] = await Promise.all([
            supabase.from("daily_loads").select("*").eq("load_date", today).order("created_at", { ascending: false }).limit(500),
            supabase.from("drivers").select("*").order("full_name").limit(200),
        ]);
        if (loadsRes.data) setLoads(loadsRes.data);
        if (driversRes.data) setDrivers(driversRes.data);
        setLoading(false);
    }, [today]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Real-time clock ──
    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // ── Realtime subscriptions ──
    useEffect(() => {
        const channel = supabase
            .channel("cc-realtime")
            .on("postgres_changes" as any, { event: "*", schema: "public", table: "daily_loads" }, () => fetchData())
            .on("postgres_changes" as any, { event: "*", schema: "public", table: "drivers" }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchData]);

    // ── Computed ──
    const driverMap = useMemo(() => {
        const m = new Map<string, Driver>();
        drivers.forEach(d => m.set(d.id, d));
        return m;
    }, [drivers]);

    const driverName = useCallback((id: string | null) => {
        if (!id) return "Unassigned";
        return driverMap.get(id)?.full_name ?? "Unknown";
    }, [driverMap]);

    const hubs = useMemo(() => [...new Set(loads.map(l => l.hub).filter(Boolean))], [loads]);

    const filteredLoads = useMemo(() => {
        let result = loads;
        if (filterHub !== "all") result = result.filter(l => l.hub === filterHub);
        if (filterStatus !== "all") result = result.filter(l => l.status === filterStatus);
        return result;
    }, [loads, filterHub, filterStatus]);

    const metrics = useMemo(() => {
        const total = loads.length;
        const delivered = loads.filter(l => l.status === "delivered").length;
        const inProgress = loads.filter(l => ["in_progress", "in_transit", "arrived_pickup", "arrived_delivery"].includes(l.status)).length;
        const unassigned = loads.filter(l => !l.driver_id).length;
        const activeDrivers = drivers.filter(d => d.status === "active").length;
        const activeLoadDriverIds = new Set(
            loads
                .filter(l => ["assigned", "in_progress", "in_transit", "arrived_pickup", "arrived_delivery"].includes(l.status))
                .map(l => l.driver_id)
                .filter(Boolean)
        );
        const idleDrivers = Math.max(0, activeDrivers - activeLoadDriverIds.size);
        const totalRevenue = loads.reduce((sum, l) => sum + Number(l.revenue), 0);
        const onTimeRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
        const atRisk = loads.filter(l => l.wait_time_minutes > 30 && l.status !== "delivered").length;

        return { total, delivered, inProgress, unassigned, activeDrivers, idleDrivers, totalRevenue, onTimeRate, atRisk };
    }, [loads, drivers]);

    // ── Client-generated supplemental alerts (unassigned loads for blast integration) ──
    const combinedAlerts = useMemo(() => {
        // Start with real DB alerts
        const dbAlerts = [...routeAlerts];

        // Add synthetic unassigned-load alerts for blast integration (Q7: D)
        const unassignedLoads = loads.filter(l => !l.driver_id && l.status !== "delivered" && l.status !== "cancelled");
        unassignedLoads.forEach(l => {
            // Don't duplicate if a real DB alert exists for this load
            if (dbAlerts.some(a => a.load_id === l.id)) return;
            dbAlerts.push({
                id: `synth-${l.id}`,
                load_id: l.id,
                driver_id: null,
                alert_type: "unassigned",
                severity: "info",
                title: "Unassigned load",
                message: `${l.client_name ?? "Unknown"} — ${l.reference_number ?? "No ref"}`,
                status: "active",
                created_at: l.created_at,
                acknowledged_at: null,
                resolved_at: null,
                escalatedSeverity: "info",
                ageMinutes: Math.round((Date.now() - new Date(l.created_at).getTime()) / 60_000),
            });
        });

        return dbAlerts.slice(0, 20);
    }, [routeAlerts, loads]);



    // ── Format helpers ──
    const fmtMoney = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

    // Format helpers for header
    const fmtDate = (d: Date) =>
        d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const fmtTime = (d: Date) =>
        d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    return (
        <div className="cc-layout">
            {/* ────── MAP ────── */}
            <div className="cc-map-container">
                <LiveDriverMap />
            </div>

            {/* ────── METRICS BAR (top) ────── */}
            <div className="cc-metrics-bar">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    {/* Header / title card */}
                    <div className="metric-card p-3 flex flex-col justify-between col-span-2 md:col-span-1">
                        <div>
                            <p className="text-[11px] font-bold text-foreground tracking-tight leading-tight">Live Ops</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{fmtDate(clock)}</p>
                        </div>
                        <p className="text-data text-[13px] font-semibold text-primary tabular-nums mt-1">
                            {fmtTime(clock)}
                        </p>
                    </div>
                    <MetricCard label="Total Loads" value={metrics.total} icon={Package} compact />
                    <MetricCard
                        label="In Transit"
                        value={metrics.inProgress}
                        icon={Navigation}
                        variant="live"
                        compact
                    />
                    <MetricCard
                        label="Delivered"
                        value={metrics.delivered}
                        icon={CheckCircle2}
                        variant="success"
                        trend={{ direction: "up", label: `${metrics.onTimeRate}% on-time` }}
                        compact
                    />
                    <MetricCard
                        label="Unassigned"
                        value={metrics.unassigned}
                        icon={AlertTriangle}
                        variant={metrics.unassigned > 0 ? "warning" : "default"}
                        compact
                    />
                    <MetricCard
                        label="Active Drivers"
                        value={metrics.activeDrivers}
                        icon={Users}
                        trend={{ direction: "flat", label: `${metrics.idleDrivers} idle` }}
                        compact
                    />
                    <MetricCard
                        label="Total Revenue"
                        value={fmtMoney(metrics.totalRevenue)}
                        icon={TrendingUp}
                        variant="success"
                        compact
                    />
                </div>
                {/* Realtime connection indicator + Sidebar toggle */}
                <div className="flex items-start gap-2">
                    {/* Connection status pill */}
                    <div className="flex items-center gap-1.5 h-9 px-3 rounded-lg glass-card text-[10px] font-medium whitespace-nowrap">
                        {realtimeStatus === "connected" && (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                                </span>
                                <span className="text-emerald-400">Connected</span>
                            </>
                        )}
                        {realtimeStatus === "reconnecting" && (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse" />
                                </span>
                                <span className="text-amber-400">Reconnecting</span>
                            </>
                        )}
                        {realtimeStatus === "disconnected" && (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                                </span>
                                <span className="text-red-400">Disconnected</span>
                            </>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 text-xs glass-card border-0 hover:bg-primary/10"
                        onClick={() => setShowSidebar(!showSidebar)}
                    >
                        {showSidebar ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        Panel
                    </Button>
                </div>
            </div>

            {/* ────── SIDEBAR PANEL (right) ────── */}
            {showSidebar && (
                <div className="cc-sidebar-panel cc-overlay-panel animate-in-right">
                    {/* Tab switcher */}
                    <div className="p-3 pb-0 space-y-3">
                        <div className="flex items-center gap-1.5">
                            {([
                                { key: "loads" as const, label: "Loads", icon: Layers, count: filteredLoads.length },
                                { key: "drivers" as const, label: "Drivers", icon: Users, count: metrics.activeDrivers },
                                { key: "alerts" as const, label: "Alerts", icon: AlertTriangle, count: combinedAlerts.length },
                            ]).map(tab => (
                                <Button
                                    key={tab.key}
                                    variant={sidebarView === tab.key ? "default" : "ghost"}
                                    size="sm"
                                    className={`h-7 text-[10px] gap-1 flex-1 ${sidebarView === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                    onClick={() => setSidebarView(tab.key)}
                                >
                                    <tab.icon className="h-3 w-3" />
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span className={`text-data text-[9px] ml-0.5 ${sidebarView === tab.key ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </Button>
                            ))}
                        </div>

                        {/* Filters */}
                        {sidebarView === "loads" && (
                            <div className="flex gap-1.5">
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger className="h-7 text-[10px] flex-1 bg-muted/30 border-0">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">All Status</SelectItem>
                                        <SelectItem value="assigned" className="text-xs">Assigned</SelectItem>
                                        <SelectItem value="in_progress" className="text-xs">In Transit</SelectItem>
                                        <SelectItem value="delivered" className="text-xs">Delivered</SelectItem>
                                        <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                                        <SelectItem value="blasted" className="text-xs">Blasted</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={filterHub} onValueChange={setFilterHub}>
                                    <SelectTrigger className="h-7 text-[10px] flex-1 bg-muted/30 border-0">
                                        <SelectValue placeholder="Hub" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">All Hubs</SelectItem>
                                        {hubs.map(h => (
                                            <SelectItem key={h} value={h} className="text-xs capitalize">{h}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => fetchData()}
                                >
                                    <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto sleek-scroll p-3 pt-2 space-y-1">
                        {loading && (
                            <div className="space-y-2 mt-2">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="h-16 rounded-lg shimmer" />
                                ))}
                            </div>
                        )}

                        {!loading && sidebarView === "loads" && (
                            <>
                                {filteredLoads.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                                        <Package className="h-10 w-10 opacity-20" />
                                        <p className="text-xs font-medium">No active loads today</p>
                                        <p className="text-[10px] opacity-60">Loads will appear here in real time</p>
                                    </div>
                                )}
                                {filteredLoads.map((load, i) => (
                                    <div key={load.id} className={`stagger-${Math.min(i + 1, 6)} animate-in`}>
                                        <LoadRow
                                            load={load}
                                            driverName={driverName(load.driver_id)}
                                            onClick={() => setSelectedLoad(load)}
                                        />
                                    </div>
                                ))}
                            </>
                        )}

                        {!loading && sidebarView === "drivers" && (
                            <>
                                {drivers.filter(d => d.status === "active").length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-xs">No active drivers</p>
                                    </div>
                                )}
                                {drivers
                                    .filter(d => d.status === "active")
                                    .map((driver, i) => {
                                        const assignedLoad = loads.find(l =>
                                            l.driver_id === driver.id && ["assigned", "in_progress"].includes(l.status)
                                        );
                                        return (
                                            <div key={driver.id} className={`stagger-${Math.min(i + 1, 6)} animate-in`}>
                                                <DriverRow driver={driver} assignedLoad={assignedLoad} />
                                            </div>
                                        );
                                    })}
                            </>
                        )}

                        {!loading && sidebarView === "alerts" && (
                            <>
                                {combinedAlerts.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-400" />
                                        <p className="text-xs">All clear — no alerts</p>
                                    </div>
                                )}
                                {combinedAlerts.map((alert, i) => (
                                    <div key={alert.id} className={`stagger-${Math.min(i + 1, 6)} animate-in`}>
                                        <AlertItem
                                            alert={alert}
                                            onClickLoad={(loadId) => {
                                                const load = loads.find(l => l.id === loadId);
                                                if (load) setSelectedLoad(load);
                                            }}
                                            onBlast={(loadId) => {
                                                window.location.href = "/dispatch";
                                                toast({ title: "Opening Blast Panel...", description: "Select the load to blast" });
                                            }}
                                        />
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Bottom action bar */}
                    <div className="p-3 pt-0">
                        <div className="flex gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-8 text-[10px] gap-1 hover:bg-primary/10"
                                onClick={() => window.location.href = "/dispatch"}
                            >
                                <Layers className="h-3 w-3" />
                                Full Board
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 h-8 text-[10px] gap-1 btn-gradient"
                                onClick={() => {
                                    window.location.href = "/dispatch";
                                    toast({ title: "Opening Dispatch Board..." });
                                }}
                            >
                                <Radio className="h-3 w-3" />
                                Blast Load
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ────── ALERT PANEL (bottom-left) ────── */}
            {combinedAlerts.length > 0 && !showSidebar && (
                <div className="cc-alert-panel cc-overlay-panel animate-panel-up p-3 space-y-2 sleek-scroll">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-[11px] font-semibold text-foreground">
                                {combinedAlerts.length} Alert{combinedAlerts.length !== 1 ? "s" : ""}
                            </span>
                            {alertStats.critical > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold animate-live-pulse">
                                    {alertStats.critical} critical
                                </span>
                            )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-5 text-[9px] text-muted-foreground" onClick={dismissAllAlerts}>
                            Dismiss All
                        </Button>
                    </div>
                    {combinedAlerts.slice(0, 4).map((alert) => (
                        <AlertItem
                            key={alert.id}
                            alert={alert}
                            onClickLoad={(loadId) => {
                                const load = loads.find(l => l.id === loadId);
                                if (load) setSelectedLoad(load);
                            }}
                            onBlast={(loadId) => {
                                window.location.href = "/dispatch";
                            }}
                        />
                    ))}
                </div>
            )}

            {/* ────── LIVE INDICATOR (bottom-right when sidebar hidden) ────── */}
            {!showSidebar && (
                <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 glass-card rounded-full px-3 py-1.5 animate-panel-up">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-marker-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                        {metrics.inProgress} in transit • {metrics.activeDrivers} drivers
                    </span>
                </div>
            )}

            {/* ────── LOAD DETAIL PANEL (from alert click) ────── */}
            {selectedLoad && (
                <LoadDetailPanel
                    load={selectedLoad as unknown as LoadDetail}
                    driverName={driverName(selectedLoad.driver_id)}
                    vehicleName="—"
                    dispatcherName="—"
                    onClose={() => setSelectedLoad(null)}
                    onStatusChange={() => { fetchData(); setSelectedLoad(null); }}
                    onEdit={() => { window.location.href = "/dispatch"; }}
                    onRefresh={() => { fetchData(); setSelectedLoad(null); }}
                />
            )}
        </div>
    );
}
