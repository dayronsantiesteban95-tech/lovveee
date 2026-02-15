// ═══════════════════════════════════════════════════════════
// DISPATCH TRACKER — Daily Load Tracking & Analytics
// Tab 1: Load Board   — CRUD (full OnTime 360 parity)
// Tab 2: Live Ops     — Real-time GPS feed
// Tab 3: Wait Time    — Analytics & detention tracking
// Tab 4: Daily Report — Operations summary / export
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from "react";
import { fmtMoney, fmtWait, todayISO, daysAgoISO } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { CITY_HUBS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Truck, Clock, DollarSign, Plus, Pencil, Trash2, MapPin,
    AlertTriangle, CheckCircle, BarChart3, FileText, Copy, Timer, Package,
    Navigation, Download, History, Zap, PanelRightClose, PanelRightOpen, Layers, Radio,
    ChevronRight, Gauge, Shield,
} from "lucide-react";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import LiveDriverMap from "@/components/LiveDriverMap";
import IntegrationSyncPanel from "@/components/IntegrationSyncPanel";
import RouteOptimizerPanel from "@/components/RouteOptimizerPanel";
import CSVImportPanel, { exportToCSV } from "@/components/CSVImportPanel";
import QuickLoadEntry, { cloneLoadData } from "@/components/QuickLoadEntry";
import AutoDispatchPanel from "@/components/AutoDispatchPanel";
import DispatchBlastPanel from "@/components/DispatchBlast";
import CustomerOrderHistory from "@/components/CustomerOrderHistory";
import ActivityLog from "@/components/ActivityLog";
import { useRealtimeDriverMap } from "@/hooks/useRealtimeDriverMap";
import LoadDetailPanel from "@/components/LoadDetailPanel";
import type { LoadDetail } from "@/components/LoadDetailPanel";

// ─── Types ──────────────────────────────────────────
type Driver = { id: string; full_name: string; hub: string; status: string };
type Vehicle = { id: string; vehicle_name: string; vehicle_type: string; hub: string; status: string };
type Load = {
    id: string; load_date: string; reference_number: string | null;
    dispatcher_id: string | null; driver_id: string | null; vehicle_id: string | null;
    shift: string; hub: string; client_name: string | null;
    pickup_address: string | null; delivery_address: string | null;
    miles: number; deadhead_miles: number;
    start_time: string | null; end_time: string | null; wait_time_minutes: number;
    revenue: number; driver_pay: number; fuel_cost: number;
    status: string; detention_eligible: boolean; detention_billed: number;
    service_type: string; packages: number; weight_lbs: number | null;
    comments: string | null; pod_confirmed: boolean;
    created_at: string; updated_at: string;
    // OnTime-parity fields
    shipper_name?: string | null;
    requested_by?: string | null;
    pickup_company?: string | null;
    delivery_company?: string | null;
    collection_time?: string | null;
    delivery_time?: string | null;
    description?: string | null;
    dimensions_text?: string | null;
    vehicle_required?: string | null;
    po_number?: string | null;
    inbound_tracking?: string | null;
    outbound_tracking?: string | null;
    estimated_pickup?: string | null;
    estimated_delivery?: string | null;
    actual_pickup?: string | null;
    actual_delivery?: string | null;
    current_eta?: string | null;
    eta_status?: string | null;
    sla_deadline?: string | null;
    route_distance_meters?: number | null;
    route_duration_seconds?: number | null;
};
type Profile = { user_id: string; full_name: string };

// ─── Constants ──────────────────────────────────────
const SHIFTS = [{ value: "day", label: "Día" }, { value: "night", label: "Noche" }];
const STATUSES = [
    { value: "pending", label: "Pending", color: "bg-gray-500" },
    { value: "assigned", label: "Assigned", color: "bg-blue-500" },
    { value: "blasted", label: "Blasted", color: "bg-violet-500" },
    { value: "in_progress", label: "In Transit", color: "bg-yellow-500" },
    { value: "delivered", label: "Delivered", color: "bg-green-500" },
    { value: "cancelled", label: "Cancelled", color: "bg-gray-500" },
    { value: "failed", label: "Failed", color: "bg-red-500" },
];
const HUBS = CITY_HUBS;
const WAIT_COLORS = [
    { max: 15, label: "Good", class: "bg-green-500/15 text-green-700 dark:text-green-400" },
    { max: 30, label: "Caution", class: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    { max: 60, label: "High", class: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    { max: Infinity, label: "Critical", class: "bg-red-500/15 text-red-700 dark:text-red-400" },
];
const DETENTION_THRESHOLD = 30; // minutes — industry standard

function waitBadgeClass(mins: number) {
    return (WAIT_COLORS.find((w) => mins <= w.max) ?? WAIT_COLORS[3]).class;
}

// ═══════════════════════════════════════════════════════════
export default function DispatchTracker() {
    const { user } = useAuth();
    const { toast } = useToast();

    // ── Data ─────────────────────────────────
    const [loads, setLoads] = useState<Load[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Live GPS (own tracking — replaces Onfleet/OT360) ──
    const { drivers: liveDrivers, loading: liveDriversLoading, connected: liveDriversConnected, refresh: refreshLiveDrivers } = useRealtimeDriverMap();

    // ── Filters ──────────────────────────────
    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [dateRangeStart, setDateRangeStart] = useState(daysAgoISO(7));
    const [dateRangeEnd, setDateRangeEnd] = useState(todayISO());

    // ── Dialog ───────────────────────────────
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editLoad, setEditLoad] = useState<Load | null>(null);
    // ── Tools sidebar ───────────────────────
    const [toolsOpen, setToolsOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<"quick" | "import" | "history" | "log" | "blast" | null>("quick");
    const [autoDispatchLoadId, setAutoDispatchLoadId] = useState<string | null>(null);
    const [clonePrefill, setClonePrefill] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    // ── Detail panel ─────────────────────────
    const [selectedLoadDetail, setSelectedLoadDetail] = useState<Load | null>(null);

    // ── Fetch helpers ────────────────────────
    const db = supabase;

    const fetchLoads = useCallback(async () => {
        const { data } = await db.from("daily_loads")
            .select("*")
            .gte("load_date", dateRangeStart)
            .lte("load_date", dateRangeEnd)
            .order("load_date", { ascending: false });
        if (data) setLoads(data);
    }, [dateRangeStart, dateRangeEnd]);

    const fetchDrivers = useCallback(async () => {
        const { data } = await db.from("drivers").select("id, full_name, hub, status").eq("status", "active");
        if (data) setDrivers(data);
    }, []);

    const fetchVehicles = useCallback(async () => {
        const { data } = await db.from("vehicles").select("id, vehicle_name, vehicle_type, hub, status").eq("status", "active");
        if (data) setVehicles(data);
    }, []);

    const fetchProfiles = useCallback(async () => {
        const { data } = await supabase.from("profiles").select("user_id, full_name");
        if (data) setProfiles(data as Profile[]);
    }, []);

    useEffect(() => {
        if (!user) return;
        Promise.all([fetchLoads(), fetchDrivers(), fetchVehicles(), fetchProfiles()])
            .finally(() => setLoading(false));
    }, [user, fetchLoads, fetchDrivers, fetchVehicles, fetchProfiles]);

    // ── CRUD ─────────────────────────────────
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const waitMins = Number(fd.get("wait_time_minutes")) || 0;
        const payload = {
            load_date: fd.get("load_date") as string || todayISO(),
            reference_number: fd.get("reference_number") as string || null,
            shift: fd.get("shift") as string || "day",
            hub: fd.get("hub") as string || "phoenix",
            driver_id: fd.get("driver_id") as string || null,
            vehicle_id: (fd.get("vehicle_id") as string) || null,
            client_name: fd.get("client_name") as string || null,
            pickup_address: fd.get("pickup_address") as string || null,
            delivery_address: fd.get("delivery_address") as string || null,
            miles: Number(fd.get("miles")) || 0,
            deadhead_miles: Number(fd.get("deadhead_miles")) || 0,
            start_time: fd.get("start_time") as string || null,
            end_time: fd.get("end_time") as string || null,
            wait_time_minutes: waitMins,
            revenue: Number(fd.get("revenue")) || 0,
            driver_pay: Number(fd.get("driver_pay")) || 0,
            fuel_cost: Number(fd.get("fuel_cost")) || 0,
            status: fd.get("status") as string || "assigned",
            service_type: fd.get("service_type") as string || "last_mile",
            packages: Number(fd.get("packages")) || 1,
            comments: fd.get("comments") as string || null,
            detention_eligible: waitMins >= DETENTION_THRESHOLD,
            detention_billed: Number(fd.get("detention_billed")) || 0,
            // OnTime-parity fields
            shipper_name: fd.get("shipper_name") as string || null,
            requested_by: fd.get("requested_by") as string || null,
            pickup_company: fd.get("pickup_company") as string || null,
            delivery_company: fd.get("delivery_company") as string || null,
            description: fd.get("description") as string || null,
            dimensions_text: fd.get("dimensions_text") as string || null,
            vehicle_required: fd.get("vehicle_required") as string || null,
            po_number: fd.get("po_number") as string || null,
            inbound_tracking: fd.get("inbound_tracking") as string || null,
            outbound_tracking: fd.get("outbound_tracking") as string || null,
            dispatcher_id: user!.id,
            ...(editLoad ? {} : { created_by: user!.id }),
            updated_at: new Date().toISOString(),
        };

        const { error } = editLoad
            ? await db.from("daily_loads").update(payload).eq("id", editLoad.id)
            : await db.from("daily_loads").insert(payload);

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({ title: editLoad ? "Load updated" : "Load added" });
            setDialogOpen(false);
            setEditLoad(null);
            fetchLoads();
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const { error } = await db.from("daily_loads").delete().eq("id", deleteId);
        setDeleteId(null);
        if (error) {
            toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Load deleted" });
            fetchLoads();
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        const { error } = await db.from("daily_loads").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) {
            toast({ title: "Status update failed", description: error.message, variant: "destructive" });
        } else {
            fetchLoads();
        }
    };

    // ── Lookups ──────────────────────────────
    const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.full_name ?? "—";
    const vehicleName = (id: string | null) => vehicles.find((v) => v.id === id)?.vehicle_name ?? "—";
    const dispatcherName = (id: string | null) => profiles.find((p) => p.user_id === id)?.full_name ?? "—";
    const statusInfo = (s: string) => STATUSES.find((st) => st.value === s) ?? STATUSES[0];

    // ── Computed / Analytics ──────────────────
    const todayLoads = useMemo(() => loads.filter((l) => l.load_date === todayISO()), [loads]);
    const todayStats = useMemo(() => ({
        count: todayLoads.length,
        miles: todayLoads.reduce((s, l) => s + Number(l.miles), 0),
        revenue: todayLoads.reduce((s, l) => s + Number(l.revenue), 0),
        avgWait: todayLoads.length ? Math.round(todayLoads.reduce((s, l) => s + Number(l.wait_time_minutes), 0) / todayLoads.length) : 0,
    }), [todayLoads]);

    const boardLoads = useMemo(
        () => loads.filter((l) => l.load_date === selectedDate),
        [loads, selectedDate],
    );

    // Wait time analytics
    const waitAnalytics = useMemo(() => {
        const all = loads.filter((l) => l.wait_time_minutes > 0);
        const avgAll = all.length ? Math.round(all.reduce((s, l) => s + l.wait_time_minutes, 0) / all.length) : 0;
        const detentionEligible = loads.filter((l) => l.wait_time_minutes >= DETENTION_THRESHOLD);
        const detentionBilled = loads.reduce((s, l) => s + Number(l.detention_billed), 0);

        // By client
        const byClient: Record<string, { total: number; count: number }> = {};
        loads.forEach((l) => {
            const c = l.client_name || "Unknown";
            if (!byClient[c]) byClient[c] = { total: 0, count: 0 };
            byClient[c].total += l.wait_time_minutes;
            byClient[c].count += 1;
        });
        const clientWait = Object.entries(byClient)
            .map(([name, v]) => ({ name, avg: Math.round(v.total / v.count), loads: v.count }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 10);

        // By driver
        const byDriver: Record<string, { total: number; count: number }> = {};
        loads.forEach((l) => {
            const d = driverName(l.driver_id);
            if (!byDriver[d]) byDriver[d] = { total: 0, count: 0 };
            byDriver[d].total += l.wait_time_minutes;
            byDriver[d].count += 1;
        });
        const driverWait = Object.entries(byDriver)
            .map(([name, v]) => ({ name, avg: Math.round(v.total / v.count), loads: v.count }))
            .sort((a, b) => b.avg - a.avg);

        return { avgAll, detentionEligible, detentionBilled, clientWait, driverWait };
    }, [loads, drivers]);

    // Daily report
    const dailyReport = useMemo(() => {
        const dayLoads = loads.filter((l) => l.load_date === selectedDate);
        const totalRevenue = dayLoads.reduce((s, l) => s + Number(l.revenue), 0);
        const totalCosts = dayLoads.reduce((s, l) => s + Number(l.driver_pay) + Number(l.fuel_cost), 0);
        const totalMiles = dayLoads.reduce((s, l) => s + Number(l.miles), 0);
        const delivered = dayLoads.filter((l) => l.status === "delivered").length;

        // Per-driver breakdown
        const byDriver: Record<string, { loads: number; miles: number; revenue: number; waitTotal: number }> = {};
        dayLoads.forEach((l) => {
            const d = driverName(l.driver_id);
            if (!byDriver[d]) byDriver[d] = { loads: 0, miles: 0, revenue: 0, waitTotal: 0 };
            byDriver[d].loads += 1;
            byDriver[d].miles += Number(l.miles);
            byDriver[d].revenue += Number(l.revenue);
            byDriver[d].waitTotal += l.wait_time_minutes;
        });
        const driverRows = Object.entries(byDriver).map(([name, v]) => ({
            name, ...v, avgWait: v.loads ? Math.round(v.waitTotal / v.loads) : 0,
        })).sort((a, b) => b.revenue - a.revenue);

        // Per-shift
        const dayShift = dayLoads.filter((l) => l.shift === "day");
        const nightShift = dayLoads.filter((l) => l.shift === "night");

        return {
            total: dayLoads.length, delivered, totalRevenue, totalCosts,
            profit: totalRevenue - totalCosts,
            margin: totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue * 100) : 0,
            totalMiles, driverRows,
            shifts: [
                { label: "Day", loads: dayShift.length, miles: dayShift.reduce((s, l) => s + Number(l.miles), 0), revenue: dayShift.reduce((s, l) => s + Number(l.revenue), 0) },
                { label: "Night", loads: nightShift.length, miles: nightShift.reduce((s, l) => s + Number(l.miles), 0), revenue: nightShift.reduce((s, l) => s + Number(l.revenue), 0) },
            ],
        };
    }, [loads, selectedDate, drivers]);

    const copyReport = () => {
        const r = dailyReport;
        const text = `📋 DAILY OPS REPORT — ${selectedDate}\n${"═".repeat(40)}\n` +
            `Loads: ${r.total} (${r.delivered} delivered)\nMiles: ${r.totalMiles}\n` +
            `Revenue: ${fmtMoney(r.totalRevenue)}\nCosts: ${fmtMoney(r.totalCosts)}\n` +
            `Profit: ${fmtMoney(r.profit)} (${r.margin.toFixed(1)}%)\n\n` +
            `DRIVER BREAKDOWN:\n${r.driverRows.map((d) => `  ${d.name}: ${d.loads} loads, ${d.miles} mi, ${fmtMoney(d.revenue)}, wait avg ${fmtWait(d.avgWait)}`).join("\n")}\n\n` +
            `SHIFTS:\n${r.shifts.map((s) => `  ${s.label}: ${s.loads} loads, ${s.miles} mi, ${fmtMoney(s.revenue)}`).join("\n")}`;
        navigator.clipboard.writeText(text);
        toast({ title: "Report copied to clipboard" });
    };

    // ── Skeleton ─────────────────────────────
    if (loading) return (
        <div className="space-y-4 animate-in">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
            <Skeleton className="h-96 rounded-2xl" />
        </div>
    );

    // ═══════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════
    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight gradient-text">Dispatch Tracker</h1>
                    <p className="text-muted-foreground text-sm mt-1">Daily load tracking, wait time analytics & operations reports</p>
                </div>
                <Button className="btn-gradient gap-2" onClick={() => { setEditLoad(null); setDialogOpen(true); }}>
                    <Plus className="h-4 w-4" /> New Load
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Loads Today", value: todayStats.count, icon: Truck, color: "text-accent" },
                    { label: "Miles Today", value: todayStats.miles.toFixed(0), icon: MapPin, color: "text-blue-500" },
                    { label: "Revenue Today", value: fmtMoney(todayStats.revenue), icon: DollarSign, color: "text-green-500" },
                    { label: "Avg Wait Today", value: fmtWait(todayStats.avgWait), icon: Clock, color: todayStats.avgWait > 30 ? "text-red-500" : "text-yellow-500" },
                ].map((s) => (
                    <Card key={s.label} className="glass-card rounded-2xl relative accent-bar">
                        <CardContent className="pt-5 pb-4 px-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                                    <s.icon className={`h-5 w-5 ${s.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-3 flex-wrap">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" className="w-40 h-9" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} />
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" className="w-40 h-9" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} />
                <Button variant="outline" size="sm" onClick={() => { setDateRangeStart(todayISO()); setDateRangeEnd(todayISO()); setSelectedDate(todayISO()); }}>Today</Button>
                <Button variant="outline" size="sm" onClick={() => { setDateRangeStart(daysAgoISO(7)); setDateRangeEnd(todayISO()); }}>This Week</Button>
                <Button variant="outline" size="sm" onClick={fetchLoads}>Refresh</Button>
            </div>

            {/* ═══ TABS ═══ */}
            <Tabs defaultValue="board" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="board" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Load Board</TabsTrigger>
                    <TabsTrigger value="live" className="gap-1.5"><Navigation className="h-3.5 w-3.5" /> Live Ops</TabsTrigger>
                    <TabsTrigger value="wait" className="gap-1.5"><Timer className="h-3.5 w-3.5" /> Wait Time Intelligence</TabsTrigger>
                    <TabsTrigger value="report" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Daily Report</TabsTrigger>
                </TabsList>

                {/* ──────── TAB: LIVE OPS ──────── */}
                <TabsContent value="live">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                            <LiveDriverMap
                                drivers={liveDrivers.map(d => ({
                                    id: d.driverId,
                                    name: d.name,
                                    lat: d.lat,
                                    lng: d.lng,
                                    status: d.isMoving ? "active" as const : d.shiftStatus === "on_duty" ? "idle" as const : "offline" as const,
                                    speed: d.speed ?? undefined,
                                    heading: d.heading ?? undefined,
                                    battery: d.battery ?? undefined,
                                    lastSeen: d.lastSeen,
                                    activeLoadId: d.activeLoadId ?? undefined,
                                    source: "own" as const,
                                }))
                                }
                                loading={liveDriversLoading}
                                pollActive={liveDriversConnected}
                                onRefresh={refreshLiveDrivers}
                            />
                        </div>
                        <div className="space-y-4">
                            <IntegrationSyncPanel
                                onfleetConnected={false}
                                ontime360Connected={false}
                                onOpenSettings={() => toast({ title: "Coming soon", description: "Integration settings will be in Team Management → Integrations." })}
                            />
                            <RouteOptimizerPanel
                                loads={boardLoads.map(l => ({
                                    id: l.id,
                                    client_name: l.client_name,
                                    delivery_address: l.delivery_address,
                                    pickup_address: l.pickup_address,
                                    delivery_lat: (l as any).delivery_lat ?? null,
                                    delivery_lng: (l as any).delivery_lng ?? null,
                                    status: l.status,
                                    packages: l.packages,
                                    tracking_token: (l as any).tracking_token ?? null,
                                }))}
                                onRouteApplied={() => fetchLoads()}
                            />
                            {/* Quick Stats */}
                            <Card className="border-0 shadow-sm">
                                <CardContent className="pt-4 pb-3">
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-primary" />
                                        Today's Sync Status
                                    </h3>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                            <span className="text-muted-foreground">Board loads</span>
                                            <Badge variant="secondary">{boardLoads.length}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                            <span className="text-muted-foreground">Active drivers</span>
                                            <Badge variant="secondary">{drivers.filter(d => d.status === "active").length}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                            <span className="text-muted-foreground">Delivered today</span>
                                            <Badge className="bg-green-500/15 text-green-600 border-0">{boardLoads.filter(l => l.status === "delivered").length}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                            <span className="text-muted-foreground">In transit</span>
                                            <Badge className="bg-yellow-500/15 text-yellow-600 border-0">{boardLoads.filter(l => l.status === "in_progress").length}</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="board">
                    <div className="flex items-center gap-3 mb-3">
                        <Label className="text-xs text-muted-foreground">Board Date</Label>
                        <Input type="date" className="w-40 h-9" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                        <Badge variant="secondary">{boardLoads.length} loads</Badge>
                        <div className="ml-auto flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                                onClick={() => exportToCSV(boardLoads.map(l => ({
                                    reference: l.reference_number ?? "",
                                    client: l.client_name ?? "",
                                    driver: driverName(l.driver_id),
                                    pickup: l.pickup_address ?? "",
                                    delivery: l.delivery_address ?? "",
                                    status: l.status,
                                    miles: l.miles,
                                    revenue: l.revenue,
                                    packages: l.packages,
                                    wait_min: l.wait_time_minutes,
                                    start_time: l.start_time ?? "",
                                    end_time: l.end_time ?? "",
                                    pod: l.pod_confirmed ? "Yes" : "No",
                                })), `loads_${selectedDate}.csv`)}
                            >
                                <Download className="h-3.5 w-3.5" /> Export CSV
                            </Button>
                            <Button
                                variant={toolsOpen ? "default" : "outline"}
                                size="sm" className="h-8 gap-1.5 text-xs"
                                onClick={() => setToolsOpen(!toolsOpen)}
                            >
                                {toolsOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                                Tools
                            </Button>
                        </div>
                    </div>

                    <div className={`grid gap-4 ${toolsOpen ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
                        {/* Load Table */}
                        <div className={toolsOpen ? "lg:col-span-2" : ""}>
                            <Card className="glass-card rounded-2xl overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-24">Ref #</TableHead>
                                            <TableHead>Shift</TableHead>
                                            <TableHead>Driver</TableHead>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Miles</TableHead>
                                            <TableHead className="text-right">Revenue</TableHead>
                                            <TableHead>Wait</TableHead>
                                            <TableHead>ETA</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead className="w-20">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {boardLoads.length === 0 && (
                                            <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-12">No loads for {selectedDate}. Click "New Load" to add one.</TableCell></TableRow>
                                        )}
                                        {boardLoads.map((load) => {
                                            const si = statusInfo(load.status);
                                            return (
                                                <TableRow key={load.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedLoadDetail(load)}>
                                                    <TableCell className="font-mono text-xs">{load.reference_number || "—"}</TableCell>
                                                    <TableCell><Badge variant="outline" className="text-[10px]">{load.shift === "day" ? "☀️ Día" : "🌙 Noche"}</Badge></TableCell>
                                                    <TableCell className="font-medium text-sm">{driverName(load.driver_id)}</TableCell>
                                                    <TableCell className="text-sm">{load.client_name || "—"}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{load.description || "—"}</TableCell>
                                                    <TableCell className="text-right font-mono text-sm">{Number(load.miles).toFixed(0)}</TableCell>
                                                    <TableCell className="text-right font-mono text-sm">{Number(load.revenue) > 0 ? fmtMoney(Number(load.revenue)) : "—"}</TableCell>
                                                    <TableCell>
                                                        {load.wait_time_minutes > 0 ? (
                                                            <Badge className={`${waitBadgeClass(load.wait_time_minutes)} text-[10px]`}>
                                                                {fmtWait(load.wait_time_minutes)}
                                                                {load.wait_time_minutes >= DETENTION_THRESHOLD && " ⚠️"}
                                                            </Badge>
                                                        ) : <span className="text-muted-foreground text-xs">—</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {load.eta_status && load.eta_status !== "unknown" ? (
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${load.eta_status === "on_time" ? "status-on-time" :
                                                                load.eta_status === "at_risk" ? "status-at-risk" :
                                                                    load.eta_status === "late" ? "status-late" : "status-idle"
                                                                }`}>
                                                                {load.eta_status === "late" && <AlertTriangle className="h-2.5 w-2.5" />}
                                                                {load.eta_status === "on_time" && <CheckCircle className="h-2.5 w-2.5" />}
                                                                {load.eta_status === "at_risk" && <Gauge className="h-2.5 w-2.5" />}
                                                                {load.eta_status?.replace("_", " ")}
                                                            </span>
                                                        ) : <span className="text-muted-foreground text-xs">—</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select value={load.status} onValueChange={(v) => handleStatusChange(load.id, v)}>
                                                            <SelectTrigger className="h-7 w-28 text-[10px]">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`h-2 w-2 rounded-full ${si.color}`} />
                                                                    <SelectValue />
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {STATUSES.map((s) => (
                                                                    <SelectItem key={s.value} value={s.value} className="text-xs">
                                                                        <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${s.color}`} />{s.label}</div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {load.start_time && load.end_time ? `${load.start_time}–${load.end_time}` : load.start_time || "—"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditLoad(load); setDialogOpen(true); }}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Clone load"
                                                                onClick={(e) => { e.stopPropagation(); setClonePrefill(cloneLoadData(load)); setActiveTool("quick"); setToolsOpen(true); toast({ title: "📋 Load cloned", description: "Edit and save the cloned load" }); }}>
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                            {!load.driver_id && (
                                                                <>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" title="Auto-assign"
                                                                        onClick={(e) => { e.stopPropagation(); setAutoDispatchLoadId(load.id); setToolsOpen(true); setActiveTool(null); }}>
                                                                        <Zap className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Blast to drivers"
                                                                        onClick={(e) => { e.stopPropagation(); setActiveTool("blast"); setToolsOpen(true); }}>
                                                                        <Radio className="h-3 w-3" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(load.id); }}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={(e) => { e.stopPropagation(); setSelectedLoadDetail(load); }}>
                                                                <ChevronRight className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </Card>
                        </div>

                        {/* Tools Sidebar */}
                        {toolsOpen && (
                            <div className="space-y-4">
                                {/* Tool Tabs */}
                                <div className="flex gap-1 flex-wrap">
                                    {([
                                        { key: "quick" as const, label: "New", icon: Plus },
                                        { key: "blast" as const, label: "Blast", icon: Radio },
                                        { key: "import" as const, label: "Import", icon: Layers },
                                        { key: "history" as const, label: "History", icon: History },
                                        { key: "log" as const, label: "Log", icon: FileText },
                                    ] as const).map((tool) => (
                                        <Button
                                            key={tool.key}
                                            variant={activeTool === tool.key ? "default" : "outline"}
                                            size="sm" className="h-7 text-[10px] gap-1"
                                            onClick={() => setActiveTool(tool.key)}
                                        >
                                            <tool.icon className="h-3 w-3" /> {tool.label}
                                        </Button>
                                    ))}
                                </div>

                                {/* Auto-dispatch (shows when triggered from a load row) */}
                                {autoDispatchLoadId && (
                                    <AutoDispatchPanel
                                        loadId={autoDispatchLoadId}
                                        loadPickupAddress={boardLoads.find(l => l.id === autoDispatchLoadId)?.pickup_address}
                                        loadHub={boardLoads.find(l => l.id === autoDispatchLoadId)?.hub}
                                        onAssigned={() => { fetchLoads(); setAutoDispatchLoadId(null); }}
                                        onClose={() => setAutoDispatchLoadId(null)}
                                    />
                                )}

                                {activeTool === "quick" && (
                                    <QuickLoadEntry
                                        loadDate={selectedDate}
                                        hub={boardLoads[0]?.hub}
                                        drivers={drivers.filter(d => d.status === "active").map(d => ({ id: d.id, full_name: d.full_name }))}
                                        onLoadCreated={fetchLoads}
                                        prefill={clonePrefill ?? undefined}
                                    />
                                )}

                                {activeTool === "import" && (
                                    <CSVImportPanel
                                        loadDate={selectedDate}
                                        hub={boardLoads[0]?.hub}
                                        onImportComplete={() => fetchLoads()}
                                    />
                                )}

                                {activeTool === "history" && (
                                    <CustomerOrderHistory
                                        onClone={(load) => {
                                            setClonePrefill(cloneLoadData(load));
                                            setActiveTool("quick");
                                        }}
                                    />
                                )}

                                {activeTool === "blast" && (
                                    <DispatchBlastPanel
                                        loads={boardLoads.map(l => ({
                                            id: l.id,
                                            reference_number: l.reference_number,
                                            client_name: l.client_name,
                                            pickup_address: l.pickup_address,
                                            delivery_address: l.delivery_address,
                                            miles: Number(l.miles),
                                            revenue: Number(l.revenue),
                                            packages: l.packages,
                                            status: l.status,
                                            hub: l.hub,
                                            service_type: l.service_type,
                                        }))}
                                        drivers={drivers.map(d => ({
                                            id: d.id,
                                            full_name: d.full_name,
                                            hub: d.hub,
                                            status: d.status,
                                        }))}
                                        onLoadAssigned={() => fetchLoads()}
                                    />
                                )}

                                {activeTool === "log" && (
                                    <ActivityLog compact />
                                )}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ──────── TAB: WAIT TIME INTELLIGENCE ──────── */}
                <TabsContent value="wait" className="space-y-6">
                    {/* Wait Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Avg Wait (Period)", value: fmtWait(waitAnalytics.avgAll), icon: Clock, color: waitAnalytics.avgAll > 30 ? "text-red-500" : "text-green-500" },
                            { label: "Detention Eligible", value: waitAnalytics.detentionEligible.length, icon: AlertTriangle, color: "text-orange-500" },
                            { label: "Detention Billed", value: fmtMoney(waitAnalytics.detentionBilled), icon: DollarSign, color: "text-green-500" },
                            { label: "Recovery Rate", value: waitAnalytics.detentionEligible.length > 0 ? `${Math.round(waitAnalytics.detentionEligible.filter((l) => l.detention_billed > 0).length / waitAnalytics.detentionEligible.length * 100)}%` : "N/A", icon: BarChart3, color: "text-blue-500" },
                        ].map((s) => (
                            <Card key={s.label} className="glass-card rounded-2xl">
                                <CardContent className="pt-5 pb-4 px-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                                            <p className="text-2xl font-bold mt-1">{s.value}</p>
                                        </div>
                                        <s.icon className={`h-5 w-5 ${s.color}`} />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Wait by Client */}
                        <Card className="glass-card rounded-2xl">
                            <CardHeader className="pb-2"><CardTitle className="text-base">Wait Time by Client</CardTitle></CardHeader>
                            <CardContent>
                                {waitAnalytics.clientWait.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No wait time data yet</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={waitAnalytics.clientWait} layout="vertical">
                                            <XAxis type="number" tick={{ fontSize: 11 }} unit="m" />
                                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                                            <Tooltip formatter={(v: number) => [`${v} min`, "Avg Wait"]} />
                                            <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                                                {waitAnalytics.clientWait.map((_, i) => (
                                                    <Cell key={i} fill={waitAnalytics.clientWait[i].avg >= 30 ? "hsl(0,70%,55%)" : waitAnalytics.clientWait[i].avg >= 15 ? "hsl(40,90%,50%)" : "hsl(140,60%,45%)"} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>

                        {/* Wait by Driver */}
                        <Card className="glass-card rounded-2xl">
                            <CardHeader className="pb-2"><CardTitle className="text-base">Wait Time by Driver</CardTitle></CardHeader>
                            <CardContent>
                                {waitAnalytics.driverWait.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No wait time data yet</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={waitAnalytics.driverWait} layout="vertical">
                                            <XAxis type="number" tick={{ fontSize: 11 }} unit="m" />
                                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                                            <Tooltip formatter={(v: number) => [`${v} min`, "Avg Wait"]} />
                                            <Bar dataKey="avg" fill="hsl(200,80%,50%)" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detention-Eligible Loads */}
                    <Card className="glass-card rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500" /> Detention-Eligible Loads (≥{DETENTION_THRESHOLD}min)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {waitAnalytics.detentionEligible.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">No detention-eligible loads in this period 🎉</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Ref #</TableHead>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Driver</TableHead>
                                            <TableHead>Wait</TableHead>
                                            <TableHead className="text-right">Detention Billed</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {waitAnalytics.detentionEligible.map((l) => (
                                            <TableRow key={l.id}>
                                                <TableCell className="text-sm">{l.load_date}</TableCell>
                                                <TableCell className="font-mono text-xs">{l.reference_number || "—"}</TableCell>
                                                <TableCell className="text-sm">{l.client_name || "—"}</TableCell>
                                                <TableCell className="text-sm">{driverName(l.driver_id)}</TableCell>
                                                <TableCell><Badge className={`${waitBadgeClass(l.wait_time_minutes)} text-xs`}>{fmtWait(l.wait_time_minutes)}</Badge></TableCell>
                                                <TableCell className="text-right font-mono">{l.detention_billed > 0 ? fmtMoney(l.detention_billed) : <span className="text-red-500 text-xs">Not billed</span>}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ──────── TAB: DAILY REPORT ──────── */}
                <TabsContent value="report" className="space-y-6">
                    <div className="flex items-center gap-3">
                        <Label className="text-xs text-muted-foreground">Report Date</Label>
                        <Input type="date" className="w-40 h-9" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={copyReport}>
                            <Copy className="h-3.5 w-3.5" /> Copy Report
                        </Button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {[
                            { label: "Total Loads", value: dailyReport.total, sub: `${dailyReport.delivered} delivered` },
                            { label: "Total Miles", value: dailyReport.totalMiles.toFixed(0), sub: "load miles" },
                            { label: "Revenue", value: fmtMoney(dailyReport.totalRevenue), sub: "gross" },
                            { label: "Costs", value: fmtMoney(dailyReport.totalCosts), sub: "driver + fuel" },
                            { label: "Profit", value: fmtMoney(dailyReport.profit), sub: dailyReport.profit >= 0 ? "▲" : "▼" },
                            { label: "Margin", value: `${dailyReport.margin.toFixed(1)}%`, sub: dailyReport.margin >= 30 ? "Healthy" : dailyReport.margin >= 15 ? "OK" : "Low" },
                        ].map((s) => (
                            <Card key={s.label} className="glass-card rounded-2xl">
                                <CardContent className="pt-4 pb-3 px-4 text-center">
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                                    <p className="text-xl font-bold mt-1">{s.value}</p>
                                    <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Driver Performance Table */}
                    <Card className="glass-card rounded-2xl">
                        <CardHeader className="pb-2"><CardTitle className="text-base">Driver Performance</CardTitle></CardHeader>
                        <CardContent>
                            {dailyReport.driverRows.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">No loads for this date</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Driver</TableHead>
                                            <TableHead className="text-center">Loads</TableHead>
                                            <TableHead className="text-right">Miles</TableHead>
                                            <TableHead className="text-right">Revenue</TableHead>
                                            <TableHead className="text-right">Rev/Mile</TableHead>
                                            <TableHead>Avg Wait</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dailyReport.driverRows.map((d) => (
                                            <TableRow key={d.name}>
                                                <TableCell className="font-medium">{d.name}</TableCell>
                                                <TableCell className="text-center">{d.loads}</TableCell>
                                                <TableCell className="text-right font-mono">{d.miles.toFixed(0)}</TableCell>
                                                <TableCell className="text-right font-mono">{fmtMoney(d.revenue)}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{d.miles > 0 ? fmtMoney(d.revenue / d.miles) : "—"}</TableCell>
                                                <TableCell><Badge className={`${waitBadgeClass(d.avgWait)} text-xs`}>{fmtWait(d.avgWait)}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {/* Shift Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dailyReport.shifts.map((s) => (
                            <Card key={s.label} className="glass-card rounded-2xl">
                                <CardContent className="pt-5 pb-4 px-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-lg">{s.label === "Day" ? "☀️" : "🌙"}</span>
                                        <p className="font-semibold">{s.label} Shift</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div><p className="text-xs text-muted-foreground">Loads</p><p className="text-lg font-bold">{s.loads}</p></div>
                                        <div><p className="text-xs text-muted-foreground">Miles</p><p className="text-lg font-bold">{s.miles.toFixed(0)}</p></div>
                                        <div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-lg font-bold">{fmtMoney(s.revenue)}</p></div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* ═══ ADD / EDIT LOAD DIALOG ═══ */}
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditLoad(null); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editLoad ? "Edit Load" : "New Load"}</DialogTitle>
                        <DialogDescription>Fill in the load details. Fields marked with * are recommended.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Section: Logistics */}
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Logistics
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div><Label>Date *</Label><Input name="load_date" type="date" defaultValue={editLoad?.load_date ?? selectedDate} /></div>
                                <div>
                                    <Label>Shift</Label>
                                    <Select name="shift" defaultValue={editLoad?.shift ?? "day"}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{SHIFTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Hub</Label>
                                    <Select name="hub" defaultValue={editLoad?.hub ?? "phoenix"}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{HUBS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div><Label>Reference # *</Label><Input name="reference_number" defaultValue={editLoad?.reference_number ?? ""} placeholder="e.g. ANK-260213-A1B2" /></div>
                                <div>
                                    <Label>Driver *</Label>
                                    <Select name="driver_id" defaultValue={editLoad?.driver_id ?? ""}>
                                        <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                                        <SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Vehicle</Label>
                                    <Select name="vehicle_id" defaultValue={editLoad?.vehicle_id ?? ""}>
                                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                                        <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicle_name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div><Label>Client Name</Label><Input name="client_name" defaultValue={editLoad?.client_name ?? ""} placeholder="e.g. Amazon" /></div>
                                <div>
                                    <Label>Service Type</Label>
                                    <Select name="service_type" defaultValue={editLoad?.service_type ?? "standard"}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="standard">Standard</SelectItem>
                                            <SelectItem value="same_day">Same Day</SelectItem>
                                            <SelectItem value="rush">Rush</SelectItem>
                                            <SelectItem value="scheduled">Scheduled</SelectItem>
                                            <SelectItem value="round_trip">Round Trip</SelectItem>
                                            <SelectItem value="white_glove">White Glove</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Status</Label>
                                    <Select name="status" defaultValue={editLoad?.status ?? "assigned"}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Section: Addresses */}
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Addresses
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div><Label>Pickup Address</Label><Input name="pickup_address" defaultValue={editLoad?.pickup_address ?? ""} placeholder="123 Main St, Phoenix, AZ" /></div>
                                <div><Label>Delivery Address</Label><Input name="delivery_address" defaultValue={editLoad?.delivery_address ?? ""} placeholder="456 Oak Ave, Scottsdale, AZ" /></div>
                            </div>
                        </div>

                        {/* Section: Timing & Distance */}
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Timing & Distance
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div><Label>Start Time</Label><Input name="start_time" type="time" defaultValue={editLoad?.start_time ?? ""} /></div>
                                <div><Label>End Time</Label><Input name="end_time" type="time" defaultValue={editLoad?.end_time ?? ""} /></div>
                                <div><Label>Miles *</Label><Input name="miles" type="number" step="0.1" defaultValue={editLoad?.miles ?? ""} placeholder="31" /></div>
                                <div><Label>Deadhead Miles</Label><Input name="deadhead_miles" type="number" step="0.1" defaultValue={editLoad?.deadhead_miles ?? ""} placeholder="0" /></div>
                                <div><Label>Wait Time (min)</Label><Input name="wait_time_minutes" type="number" defaultValue={editLoad?.wait_time_minutes ?? ""} placeholder="0" /></div>
                                <div><Label>Packages</Label><Input name="packages" type="number" defaultValue={editLoad?.packages ?? 1} /></div>
                            </div>
                        </div>

                        {/* Section: Revenue */}
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Revenue & Costs
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div><Label>Revenue ($)</Label><Input name="revenue" type="number" step="0.01" defaultValue={editLoad?.revenue ?? ""} placeholder="0" /></div>
                                <div><Label>Driver Pay ($)</Label><Input name="driver_pay" type="number" step="0.01" defaultValue={editLoad?.driver_pay ?? ""} placeholder="0" /></div>
                                <div><Label>Fuel Cost ($)</Label><Input name="fuel_cost" type="number" step="0.01" defaultValue={editLoad?.fuel_cost ?? ""} placeholder="0" /></div>
                                <div><Label>Detention Billed ($)</Label><Input name="detention_billed" type="number" step="0.01" defaultValue={editLoad?.detention_billed ?? ""} placeholder="0" /></div>
                            </div>
                        </div>
                        <div><Label>Comments</Label><Textarea name="comments" defaultValue={editLoad?.comments ?? ""} placeholder="Optional notes..." rows={2} /></div>

                        {/* Section: Shipper & Cargo (OnTime parity) */}
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Shipper & Cargo Details
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div><Label>Shipper Name</Label><Input name="shipper_name" defaultValue={editLoad?.shipper_name ?? ""} placeholder="e.g. UNICAL AVIATION" /></div>
                                <div><Label>Requested By</Label><Input name="requested_by" defaultValue={editLoad?.requested_by ?? ""} placeholder="Contact name" /></div>
                                <div><Label>Description</Label><Input name="description" defaultValue={editLoad?.description ?? ""} placeholder="e.g. CIVIL AIRCRAFT PART" /></div>
                                <div><Label>Dimensions</Label><Input name="dimensions_text" defaultValue={editLoad?.dimensions_text ?? ""} placeholder="12 x 8 x 59 (L×W×H)" /></div>
                                <div><Label>Vehicle Required</Label><Input name="vehicle_required" defaultValue={editLoad?.vehicle_required ?? ""} placeholder="e.g. Sprinter, Box Truck" /></div>
                                <div><Label>Pickup Company</Label><Input name="pickup_company" defaultValue={editLoad?.pickup_company ?? ""} placeholder="Facility name" /></div>
                                <div><Label>Delivery Company</Label><Input name="delivery_company" defaultValue={editLoad?.delivery_company ?? ""} placeholder="Facility name" /></div>
                            </div>
                        </div>

                        {/* Section: Tracking Numbers */}
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" /> Tracking Numbers
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div><Label>PO Number</Label><Input name="po_number" defaultValue={editLoad?.po_number ?? ""} placeholder="Purchase Order" /></div>
                                <div><Label>Inbound Tracking</Label><Input name="inbound_tracking" defaultValue={editLoad?.inbound_tracking ?? ""} placeholder="AWB / Tracking #" /></div>
                                <div><Label>Outbound Tracking</Label><Input name="outbound_tracking" defaultValue={editLoad?.outbound_tracking ?? ""} placeholder="AWB / Tracking #" /></div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditLoad(null); }}>Cancel</Button>
                            <Button type="submit" className="btn-gradient">{editLoad ? "Save Changes" : "Add Load"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            {
                deleteId && (
                    <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Delete Load?</DialogTitle>
                                <DialogDescription>This action cannot be undone.</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                                <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )
            }

            {/* Load Detail Slide-Over */}
            {selectedLoadDetail && (
                <LoadDetailPanel
                    load={selectedLoadDetail as LoadDetail}
                    driverName={driverName(selectedLoadDetail.driver_id)}
                    vehicleName={vehicleName(selectedLoadDetail.vehicle_id)}
                    dispatcherName={dispatcherName(selectedLoadDetail.dispatcher_id)}
                    onClose={() => setSelectedLoadDetail(null)}
                    onStatusChange={(id, status) => { handleStatusChange(id, status); setSelectedLoadDetail(null); }}
                    onEdit={(load) => { setEditLoad(load as Load); setDialogOpen(true); setSelectedLoadDetail(null); }}
                    onRefresh={() => { fetchLoads(); setSelectedLoadDetail(null); }}
                />
            )}
        </div>
    );
}
