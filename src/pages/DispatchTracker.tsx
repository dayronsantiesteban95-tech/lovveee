// ═══════════════════════════════════════════════════════════
// DISPATCH TRACKER — Daily Load Tracking & Analytics
// Tab 1: Load Board   — CRUD (full OnTime 360 parity)
// Tab 2: Live Ops     — Real-time GPS feed
// Tab 3: Wait Time    — Analytics & detention tracking
// Tab 4: Daily Report — Operations summary / export
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { fmtMoney, fmtWait, todayISO, daysAgoISO } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { sendPushToDrivers } from "@/lib/sendPushNotification";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Truck, Clock, DollarSign, Plus, Pencil, Trash2, MapPin,
    AlertTriangle, CheckCircle, BarChart3, FileText, Timer, Package,
    Navigation, Download, Zap, Radio,
} from "lucide-react";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import LiveDriverMap from "@/components/LiveDriverMap";
import IntegrationSyncPanel from "@/components/IntegrationSyncPanel";
import RouteOptimizerPanel from "@/components/RouteOptimizerPanel";
import BlastLoadDialog from "@/components/BlastLoadDialog";
import { useRealtimeDriverMap } from "@/hooks/useRealtimeDriverMap";
import { useLoadStatusActions } from "@/hooks/useLoadStatusActions";
import type { LoadStatus } from "@/hooks/useLoadStatusActions";
import { useDispatchData } from "@/hooks/useDispatchData";
import { EMPTY_LOAD_FILTERS, type LoadFilters } from "@/components/LoadSearchFilters";
import NewLoadForm from "./dispatch/NewLoadForm";
import LoadBoard from "./dispatch/LoadBoard";
import DailyReport from "./dispatch/DailyReport";
import type { Load } from "./dispatch/types";

const LoadDetailPanel = lazy(() => import("@/components/LoadDetailPanel"));
import type { LoadDetail } from "@/components/LoadDetailPanel";

// ════════════════════Constants ======================================
const SHIFTS = [{ value: "day", label: "Día" }, { value: "night", label: "Noche" }];
const STATUSES = [
    { value: "pending", label: "Pending", color: "bg-gray-500" },
    { value: "assigned", label: "Assigned", color: "bg-blue-500" },
    { value: "blasted", label: "Blasted", color: "bg-violet-500" },
    { value: "in_progress", label: "In Transit", color: "bg-yellow-500" },
    { value: "arrived_pickup", label: "At Pickup 📍", color: "bg-blue-400" },
    { value: "in_transit", label: "In Transit", color: "bg-yellow-500" },
    { value: "arrived_delivery", label: "At Delivery 📍", color: "bg-purple-400" },
    { value: "delivered", label: "Delivered", color: "bg-green-500" },
    { value: "completed", label: "Completed", color: "bg-green-600" },
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
const DETENTION_THRESHOLD = 30;

function waitBadgeClass(mins: number) {
    return (WAIT_COLORS.find((w) => mins <= w.max) ?? WAIT_COLORS[3]).class;
}

// ═══════════════════════════════════════════════════════════
export default function DispatchTracker() {
    const { user } = useAuth();
    const { toast } = useToast();

    // ════════════════════Date range ────────────────
    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [dateRangeStart, setDateRangeStart] = useState(daysAgoISO(7));
    const [dateRangeEnd, setDateRangeEnd] = useState(todayISO());

    // ════════════════════Data hook ─────────────────
    const {
        loads,
        loadsLoading,
        loadsUpdatedAt,
        drivers,
        vehicles,
        profiles,
        companies,
        rateCards,
        recentAddresses,
        refetchLoads,
    } = useDispatchData(dateRangeStart, dateRangeEnd);

    const loading = loadsLoading;

    // ════════════════════Live GPS ══════════════════
    const { drivers: liveDrivers, loading: liveDriversLoading, connected: liveDriversConnected, refresh: refreshLiveDrivers } = useRealtimeDriverMap();

    // ════════════════════Load Board Filters ════════
    const [loadFilters, setLoadFilters] = useState<LoadFilters>(EMPTY_LOAD_FILTERS);

    // ════════════════════Dialogs / Detail ═════════
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editLoad, setEditLoad] = useState<Load | null>(null);
    const [newLoadOpen, setNewLoadOpen] = useState(false);
    const [blastDialogLoad, setBlastDialogLoad] = useState<Load | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [selectedLoadDetail, setSelectedLoadDetail] = useState<Load | null>(null);

    // ════════════════════Auto-refresh counters ═════
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const [secondsAgo, setSecondsAgo] = useState(0);

    // ════════════════════Status action hook ════════
    const { updateStatus } = useLoadStatusActions();
    const db = supabase;

    // ════════════════════Realtime: geofence arrival toasts ════════
    useEffect(() => {
        if (!user) return;

        const geofenceChannel = supabase
            .channel("geofence-arrivals")
            .on(
                "postgres_changes" as any,
                { event: "INSERT", schema: "public", table: "load_status_events" } as any,
                async (payload: any) => {
                    const evt = payload.new as {
                        load_id: string;
                        new_status: string;
                        previous_status: string;
                    };
                    if (evt.new_status !== "arrived_pickup" && evt.new_status !== "arrived_delivery") return;

                    const { data: loadData } = await supabase
                        .from("daily_loads")
                        .select("reference_number, driver_id, client_name")
                        .eq("id", evt.load_id)
                        .single();

                    const refNumber = loadData?.reference_number ?? "—";
                    const driverRecord = drivers.find(d => d.id === loadData?.driver_id);
                    const driverName = driverRecord?.full_name ?? "Driver";
                    const eventLabel = evt.new_status === "arrived_pickup" ? "pickup" : "delivery";

                    toast({
                        title: "📍 Driver Arrived",
                        description: `${driverName} arrived at ${eventLabel} — Ref #${refNumber}`,
                    });

                    if (loadData?.driver_id) {
                        sendPushToDrivers(
                            [loadData.driver_id],
                            '📍 Arrival Confirmed',
                            `Dispatch has been notified of your arrival at ${eventLabel} — Ref #${refNumber}`,
                            { load_id: evt.load_id, type: 'arrival_confirmation', event: evt.new_status }
                        ).catch((err: unknown) => {
                            console.warn('[DispatchTracker] Arrival push failed:', err);
                        });
                    }

                    refetchLoads();
                }
            )
            .subscribe();

        const loadsChannel = supabase
            .channel("dispatch-loads-realtime")
            .on(
                "postgres_changes" as any,
                { event: "UPDATE", schema: "public", table: "daily_loads" } as any,
                () => { refetchLoads(); }
            )
            .subscribe();

        const loadRefreshTimer = setInterval(() => refetchLoads(), 60_000);

        return () => {
            supabase.removeChannel(geofenceChannel);
            supabase.removeChannel(loadsChannel);
            clearInterval(loadRefreshTimer);
        };
    }, [user, drivers, refetchLoads, toast]);

    // ════════════════════Keep lastRefreshed in sync ════════════════
    useEffect(() => {
        if (loadsUpdatedAt) {
            setLastRefreshed(new Date(loadsUpdatedAt));
            setSecondsAgo(0);
        }
    }, [loadsUpdatedAt]);

    useEffect(() => {
        const ticker = setInterval(() => {
            setSecondsAgo(Math.floor((Date.now() - lastRefreshed.getTime()) / 1000));
        }, 5_000);
        return () => clearInterval(ticker);
    }, [lastRefreshed]);

    // ════════════════════CRUD =================================
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const waitMins = Number(fd.get("wait_time_minutes")) || 0;
        const payload = {
            load_date: fd.get("load_date") as string || todayISO(),
            reference_number: fd.get("reference_number") as string || null,
            shift: fd.get("shift") as string || "day",
            hub: fd.get("hub") as string || "PHX",
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
            refetchLoads();
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
            refetchLoads();
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        const currentLoad = loads.find((l) => l.id === id);
        await updateStatus({
            loadId: id,
            previousStatus: currentLoad?.status ?? "pending",
            newStatus: newStatus as LoadStatus,
            onSuccess: () => refetchLoads(),
        });
    };

    // ════════════════════Lookups ══════════════════
    const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.full_name ?? "—";
    const vehicleName = (id: string | null) => vehicles.find((v) => v.id === id)?.vehicle_name ?? "—";
    const dispatcherName = (id: string | null) => profiles.find((p) => p.user_id === id)?.full_name ?? "—";

    // ════════════════════Computed / Analytics ═════
    const todayLoads = useMemo(() => loads.filter((l) => l.load_date === todayISO()), [loads]);
    const todayStats = useMemo(() => ({
        count: todayLoads.length,
        miles: todayLoads.reduce((s, l) => s + Number(l.miles), 0),
        revenue: todayLoads.reduce((s, l) => s + Number(l.revenue), 0),
        avgWait: todayLoads.length ? Math.round(todayLoads.reduce((s, l) => s + Number(l.wait_time_minutes), 0) / todayLoads.length) : 0,
    }), [todayLoads]);

    const rawBoardLoads = useMemo(
        () => loads.filter((l) => l.load_date === selectedDate),
        [loads, selectedDate],
    );

    const filterDateMatches = useCallback((loadDate: string, dateRange: LoadFilters["dateRange"]) => {
        if (!dateRange) return true;
        const today = todayISO();
        const yesterday = daysAgoISO(1);
        const weekAgo = daysAgoISO(6);
        if (dateRange === "today") return loadDate === today;
        if (dateRange === "yesterday") return loadDate === yesterday;
        if (dateRange === "this_week") return loadDate >= weekAgo && loadDate <= today;
        return true;
    }, []);

    const boardLoads = useMemo(() => {
        let result = rawBoardLoads;
        const { search, status, driverId, serviceType, dateRange, sort } = loadFilters;

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            result = result.filter((l) => {
                return (
                    (l.reference_number?.toLowerCase().includes(q) ?? false) ||
                    (l.client_name?.toLowerCase().includes(q) ?? false) ||
                    (l.pickup_address?.toLowerCase().includes(q) ?? false) ||
                    (l.delivery_address?.toLowerCase().includes(q) ?? false) ||
                    (l.pickup_company?.toLowerCase().includes(q) ?? false) ||
                    (l.delivery_company?.toLowerCase().includes(q) ?? false)
                );
            });
        }
        if (status) result = result.filter((l) => l.status === status);
        if (driverId) result = result.filter((l) => l.driver_id === driverId);
        if (serviceType) result = result.filter((l) => l.service_type === serviceType);
        if (dateRange) result = result.filter((l) => filterDateMatches(l.load_date, dateRange));

        result = [...result].sort((a, b) => {
            if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
            if (sort === "revenue_desc") return Number(b.revenue) - Number(a.revenue);
            if (sort === "status") return a.status.localeCompare(b.status);
            return b.created_at.localeCompare(a.created_at);
        });

        return result;
    }, [rawBoardLoads, loadFilters, filterDateMatches]);

    const waitAnalytics = useMemo(() => {
        const all = loads.filter((l) => l.wait_time_minutes > 0);
        const avgAll = all.length ? Math.round(all.reduce((s, l) => s + l.wait_time_minutes, 0) / all.length) : 0;
        const detentionEligible = loads.filter((l) => l.wait_time_minutes >= DETENTION_THRESHOLD);
        const detentionBilled = loads.reduce((s, l) => s + Number(l.detention_billed), 0);

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

    // ════════════════════Skeleton ═════════════════
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
                <Button className="btn-gradient gap-2" onClick={() => setNewLoadOpen(true)}>
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
                <Button variant="outline" size="sm" onClick={refetchLoads}>Refresh</Button>
            </div>

            {/* ═══ TABS ═══ */}
            <Tabs defaultValue="board" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="board" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Load Board</TabsTrigger>
                    <TabsTrigger value="live" className="gap-1.5"><Navigation className="h-3.5 w-3.5" /> Live Ops</TabsTrigger>
                    <TabsTrigger value="wait" className="gap-1.5"><Timer className="h-3.5 w-3.5" /> Wait Time Intelligence</TabsTrigger>
                    <TabsTrigger value="report" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Daily Report</TabsTrigger>
                </TabsList>

                {/* ======== TAB: LIVE OPS ======== */}
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
                                }))}
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
                                onRouteApplied={() => refetchLoads()}
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

                {/* ======== TAB: LOAD BOARD ======== */}
                <TabsContent value="board">
                    <LoadBoard
                        loads={boardLoads}
                        rawLoads={rawBoardLoads}
                        drivers={drivers}
                        loading={loading}
                        selectedDate={selectedDate}
                        onSelectedDateChange={setSelectedDate}
                        secondsAgo={secondsAgo}
                        onLoadClick={setSelectedLoadDetail}
                        onStatusChange={handleStatusChange}
                        onDelete={setDeleteId}
                        onEdit={(load) => { setEditLoad(load); setDialogOpen(true); }}
                        onSetBlastLoad={setBlastDialogLoad}
                        filters={loadFilters}
                        onFiltersChange={setLoadFilters}
                        onRefetchLoads={refetchLoads}
                    />
                </TabsContent>

                {/* ======== TAB: WAIT TIME INTELLIGENCE ======== */}
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

                {/* ======== TAB: DAILY REPORT ======== */}
                <TabsContent value="report">
                    <DailyReport
                        loads={loads}
                        drivers={drivers}
                        selectedDate={selectedDate}
                        onSelectedDateChange={setSelectedDate}
                    />
                </TabsContent>
            </Tabs>

            {/* ═══ NEW LOAD DIALOG (multi-step) ═══ */}
            <NewLoadForm
                open={newLoadOpen}
                onClose={() => setNewLoadOpen(false)}
                onSuccess={() => refetchLoads()}
                drivers={drivers}
                companies={companies}
                rateCards={rateCards}
                recentAddresses={recentAddresses}
            />

            {/* ═══ EDIT LOAD DIALOG ═══ */}
            <Dialog open={dialogOpen} onOpenChange={(o) => {
                setDialogOpen(o);
                if (!o) { setEditLoad(null); }
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {editLoad && (
                        <>
                            <DialogHeader className="px-6 pt-6">
                                <DialogTitle>Edit Load</DialogTitle>
                                <DialogDescription>Update load details below.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6 overflow-y-auto">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Logistics</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div><Label>Date *</Label><Input name="load_date" type="date" defaultValue={editLoad.load_date ?? selectedDate} /></div>
                                        <div><Label>Shift</Label><Select name="shift" defaultValue={editLoad.shift ?? "day"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SHIFTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                                        <div><Label>Hub</Label><Select name="hub" defaultValue={editLoad.hub ?? "PHX"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{HUBS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent></Select></div>
                                        <div><Label>Reference #</Label><Input name="reference_number" defaultValue={editLoad.reference_number ?? ""} /></div>
                                        <div><Label>Driver</Label><Select name="driver_id" defaultValue={editLoad.driver_id ?? ""}><SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger><SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent></Select></div>
                                        <div><Label>Vehicle</Label><Select name="vehicle_id" defaultValue={editLoad.vehicle_id ?? ""}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicle_name}</SelectItem>)}</SelectContent></Select></div>
                                        <div><Label>Client Name</Label><Input name="client_name" defaultValue={editLoad.client_name ?? ""} /></div>
                                        <div><Label>Service Type</Label><Select name="service_type" defaultValue={editLoad.service_type ?? "standard"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AOG">AOG</SelectItem><SelectItem value="Courier">Courier</SelectItem><SelectItem value="Standard">Standard</SelectItem><SelectItem value="standard">Standard (legacy)</SelectItem><SelectItem value="same_day">Same Day</SelectItem><SelectItem value="rush">Rush</SelectItem></SelectContent></Select></div>
                                        <div><Label>Status</Label><Select name="status" defaultValue={editLoad.status ?? "assigned"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div><Label>Pickup Address</Label><Input name="pickup_address" defaultValue={editLoad.pickup_address ?? ""} /></div>
                                    <div><Label>Delivery Address</Label><Input name="delivery_address" defaultValue={editLoad.delivery_address ?? ""} /></div>
                                    <div><Label>Pickup Company</Label><Input name="pickup_company" defaultValue={editLoad.pickup_company ?? ""} /></div>
                                    <div><Label>Delivery Company</Label><Input name="delivery_company" defaultValue={editLoad.delivery_company ?? ""} /></div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div><Label>Miles</Label><Input name="miles" type="number" step="0.1" defaultValue={editLoad.miles ?? ""} /></div>
                                    <div><Label>Packages</Label><Input name="packages" type="number" defaultValue={editLoad.packages ?? 1} /></div>
                                    <div><Label>Revenue ($)</Label><Input name="revenue" type="number" step="0.01" defaultValue={editLoad.revenue ?? ""} /></div>
                                    <div><Label>Driver Pay ($)</Label><Input name="driver_pay" type="number" step="0.01" defaultValue={editLoad.driver_pay ?? ""} /></div>
                                    <div><Label>Fuel Cost ($)</Label><Input name="fuel_cost" type="number" step="0.01" defaultValue={editLoad.fuel_cost ?? ""} /></div>
                                    <div><Label>Wait (min)</Label><Input name="wait_time_minutes" type="number" defaultValue={editLoad.wait_time_minutes ?? ""} /></div>
                                    <div><Label>Start Time</Label><Input name="start_time" type="time" defaultValue={editLoad.start_time ?? ""} /></div>
                                    <div><Label>End Time</Label><Input name="end_time" type="time" defaultValue={editLoad.end_time ?? ""} /></div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div><Label>PO Number</Label><Input name="po_number" defaultValue={editLoad.po_number ?? ""} /></div>
                                    <div><Label>Description</Label><Input name="description" defaultValue={editLoad.description ?? ""} /></div>
                                    <div><Label>Dimensions</Label><Input name="dimensions_text" defaultValue={editLoad.dimensions_text ?? ""} /></div>
                                    <div><Label>SLA Deadline</Label><Input name="sla_deadline" type="datetime-local" defaultValue={editLoad.sla_deadline?.slice(0, 16) ?? ""} /></div>
                                    <div><Label>Inbound Tracking</Label><Input name="inbound_tracking" defaultValue={editLoad.inbound_tracking ?? ""} /></div>
                                    <div><Label>Outbound Tracking</Label><Input name="outbound_tracking" defaultValue={editLoad.outbound_tracking ?? ""} /></div>
                                </div>
                                <div><Label>Comments</Label><Textarea name="comments" defaultValue={editLoad.comments ?? ""} rows={2} /></div>
                                <input type="hidden" name="deadhead_miles" value={editLoad.deadhead_miles ?? 0} />
                                <input type="hidden" name="detention_billed" value={editLoad.detention_billed ?? 0} />
                                <input type="hidden" name="shipper_name" value={editLoad.shipper_name ?? ""} />
                                <input type="hidden" name="requested_by" value={editLoad.requested_by ?? ""} />
                                <input type="hidden" name="vehicle_required" value={editLoad.vehicle_required ?? ""} />
                                <input type="hidden" name="inbound_tracking" value={editLoad.inbound_tracking ?? ""} />
                                <input type="hidden" name="outbound_tracking" value={editLoad.outbound_tracking ?? ""} />
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditLoad(null); }}>Cancel</Button>
                                    <Button type="submit" className="btn-gradient">Save Changes</Button>
                                </DialogFooter>
                            </form>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Blast Load Dialog */}
            <BlastLoadDialog
                open={!!blastDialogLoad}
                onOpenChange={(open) => { if (!open) setBlastDialogLoad(null); }}
                load={blastDialogLoad ? {
                    id: blastDialogLoad.id,
                    reference_number: blastDialogLoad.reference_number ?? null,
                    client_name: blastDialogLoad.client_name ?? null,
                    pickup_address: blastDialogLoad.pickup_address ?? null,
                    delivery_address: blastDialogLoad.delivery_address ?? null,
                    miles: Number(blastDialogLoad.miles),
                    revenue: Number(blastDialogLoad.revenue),
                    packages: blastDialogLoad.packages ?? 0,
                    status: blastDialogLoad.status,
                    hub: blastDialogLoad.hub ?? "",
                    service_type: blastDialogLoad.service_type ?? "",
                } : null}
                onBlastSent={(_blastId, driverCount) => {
                    toast({ title: `📡 Blast sent to ${driverCount} driver${driverCount !== 1 ? "s" : ""}` });
                    refetchLoads();
                    setBlastDialogLoad(null);
                }}
            />

            {/* Delete Confirmation */}
            {deleteId && (
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
            )}

            {/* Load Detail Slide-Over */}
            {selectedLoadDetail && (
                <Suspense fallback={<div className="fixed inset-y-0 right-0 w-[520px] bg-background border-l border-border/50 flex items-center justify-center"><span className="text-muted-foreground text-sm animate-pulse">Loading…</span></div>}>
                    <LoadDetailPanel
                        load={selectedLoadDetail as LoadDetail}
                        driverName={driverName(selectedLoadDetail.driver_id)}
                        vehicleName={vehicleName(selectedLoadDetail.vehicle_id)}
                        dispatcherName={dispatcherName(selectedLoadDetail.dispatcher_id)}
                        onClose={() => setSelectedLoadDetail(null)}
                        onStatusChange={(id, status) => { handleStatusChange(id, status); setSelectedLoadDetail(null); }}
                        onEdit={(load) => { setEditLoad(load as Load); setDialogOpen(true); setSelectedLoadDetail(null); }}
                        onRefresh={() => { refetchLoads(); setSelectedLoadDetail(null); }}
                    />
                </Suspense>
            )}
        </div>
    );
}
