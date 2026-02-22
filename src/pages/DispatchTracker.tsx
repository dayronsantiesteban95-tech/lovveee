// Dispatch Tracker -- orchestrates tabs: Load Board, Live Ops, Wait Time, Daily Report
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { fmtMoney, fmtWait, todayISO, daysAgoISO } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { sendPushToDrivers } from "@/lib/sendPushNotification";
import { geocodeAddress } from "@/utils/geocodeAddress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Truck, Clock, DollarSign, Plus, MapPin,
    FileText, Timer, Package,
    Navigation,
} from "lucide-react";
import LiveOpsTab from "./dispatch/LiveOpsTab";
import BlastLoadDialog from "@/components/BlastLoadDialog";
import { useRealtimeDriverMap } from "@/hooks/useRealtimeDriverMap";
import { useLoadStatusActions } from "@/hooks/useLoadStatusActions";
import type { LoadStatus } from "@/hooks/useLoadStatusActions";
import { useDispatchData } from "@/hooks/useDispatchData";
import { EMPTY_LOAD_FILTERS, type LoadFilters } from "@/components/LoadSearchFilters";
import NewLoadForm from "./dispatch/NewLoadForm";
import LoadBoard from "./dispatch/LoadBoard";
import DailyReport from "./dispatch/DailyReport";
import EditLoadDialog from "./dispatch/EditLoadDialog";
import WaitTimeTab from "./dispatch/WaitTimeTab";
import type { Load } from "./dispatch/types";

const LoadDetailPanel = lazy(() => import("@/components/LoadDetailPanel"));
import type { LoadDetail } from "@/components/LoadDetailPanel";

const WAIT_COLORS = [
    { max: 15, label: "Good", class: "bg-green-500/15 text-green-700 dark:text-green-400" },
    { max: 30, label: "Caution", class: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    { max: 60, label: "High", class: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    { max: Infinity, label: "Critical", class: "bg-red-500/15 text-red-700 dark:text-red-400" },
];
const DETENTION_THRESHOLD = 30;

// -----------------------------------------------------------
function DispatchTracker() {
    const { user } = useAuth();
    const { toast } = useToast();

    // --------------------Date range ----------------
    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [dateRangeStart, setDateRangeStart] = useState(daysAgoISO(7));
    const [dateRangeEnd, setDateRangeEnd] = useState(todayISO());

    // --------------------Data hook -----------------
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

    // --------------------Live GPS ------------------
    const { drivers: liveDrivers, loading: liveDriversLoading, connected: liveDriversConnected, refresh: refreshLiveDrivers } = useRealtimeDriverMap();

    // --------------------Load Board Filters --------
    const [loadFilters, setLoadFilters] = useState<LoadFilters>(EMPTY_LOAD_FILTERS);

    // --------------------Dialogs / Detail ---------
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editLoad, setEditLoad] = useState<Load | null>(null);
    const [newLoadOpen, setNewLoadOpen] = useState(false);
    const [blastDialogLoad, setBlastDialogLoad] = useState<Load | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [selectedLoadDetail, setSelectedLoadDetail] = useState<Load | null>(null);

    // --------------------Auto-refresh counters -----
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const [secondsAgo, setSecondsAgo] = useState(0);

    // --------------------Status action hook --------
    const { updateStatus } = useLoadStatusActions();
    const db = supabase;

    // --------------------Realtime: geofence arrival toasts --------
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

                    const refNumber = loadData?.reference_number ?? "--";
                    const driverRecord = drivers.find(d => d.id === loadData?.driver_id);
                    const driverName = driverRecord?.full_name ?? "Driver";
                    const eventLabel = evt.new_status === "arrived_pickup" ? "pickup" : "delivery";

                    toast({
                        title: "Driver Arrived",
                        description: `${driverName} arrived at ${eventLabel} -- Ref #${refNumber}`,
                    });

                    if (loadData?.driver_id) {
                        sendPushToDrivers(
                            [loadData.driver_id],
                            '?? Arrival Confirmed',
                            `Dispatch has been notified of your arrival at ${eventLabel} -- Ref #${refNumber}`,
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

    // --------------------Keep lastRefreshed in sync ----------------
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

    // --------------------CRUD =================================
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

        // Geocode addresses for geofence enforcement (on create or address change)
        const pickupAddr = fd.get("pickup_address") as string;
        const deliveryAddr = fd.get("delivery_address") as string;
        if (pickupAddr || deliveryAddr) {
            const [pickupCoords, deliveryCoords] = await Promise.all([
                pickupAddr ? geocodeAddress(pickupAddr) : null,
                deliveryAddr ? geocodeAddress(deliveryAddr) : null,
            ]);
            if (pickupCoords) { (payload as any).pickup_lat = pickupCoords.lat; (payload as any).pickup_lng = pickupCoords.lng; }
            if (deliveryCoords) { (payload as any).delivery_lat = deliveryCoords.lat; (payload as any).delivery_lng = deliveryCoords.lng; }
        }

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

    // --------------------Lookups ------------------
    const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.full_name ?? "--";
    const vehicleName = (id: string | null) => vehicles.find((v) => v.id === id)?.vehicle_name ?? "--";
    const dispatcherName = (id: string | null) => profiles.find((p) => p.user_id === id)?.full_name ?? "--";

    // --------------------Computed / Analytics -----
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

    // --------------------Skeleton -----------------
    if (loading) return (
        <div className="space-y-4 animate-in">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
            <Skeleton className="h-96 rounded-2xl" />
        </div>
    );

    // -------------------------------------------
    // RENDER
    // -------------------------------------------
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

            {/* --- TABS --- */}
            <Tabs defaultValue="board" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="board" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Load Board</TabsTrigger>
                    <TabsTrigger value="live" className="gap-1.5"><Navigation className="h-3.5 w-3.5" /> Live Ops</TabsTrigger>
                    <TabsTrigger value="wait" className="gap-1.5"><Timer className="h-3.5 w-3.5" /> Wait Time Intelligence</TabsTrigger>
                    <TabsTrigger value="report" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Daily Report</TabsTrigger>
                </TabsList>

                {/* ======== TAB: LIVE OPS ======== */}
                <TabsContent value="live">
                    <LiveOpsTab
                        liveDrivers={liveDrivers}
                        liveDriversLoading={liveDriversLoading}
                        liveDriversConnected={liveDriversConnected}
                        refreshLiveDrivers={refreshLiveDrivers}
                        boardLoads={boardLoads}
                        drivers={drivers}
                        onRefetchLoads={refetchLoads}
                        onSettingsClick={() => toast({ title: "Coming soon", description: "Integration settings will be in Team Management > Integrations." })}
                    />
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
                <TabsContent value="wait">
                    <WaitTimeTab analytics={waitAnalytics} driverName={driverName} />
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

            {/* --- NEW LOAD DIALOG (multi-step) --- */}
            <NewLoadForm
                open={newLoadOpen}
                onClose={() => setNewLoadOpen(false)}
                onSuccess={() => refetchLoads()}
                drivers={drivers}
                companies={companies}
                rateCards={rateCards}
                recentAddresses={recentAddresses}
            />

            {/* --- EDIT LOAD DIALOG --- */}
            {editLoad && (
                <EditLoadDialog
                    open={dialogOpen}
                    editLoad={editLoad}
                    drivers={drivers}
                    vehicles={vehicles}
                    selectedDate={selectedDate}
                    onSubmit={handleSubmit}
                    onClose={() => { setDialogOpen(false); setEditLoad(null); }}
                />
            )}

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
                    toast({ title: `Blast sent to ${driverCount} driver${driverCount !== 1 ? "s" : ""}` });
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
                <Suspense fallback={<div className="fixed inset-y-0 right-0 w-[520px] bg-background border-l border-border/50 flex items-center justify-center"><span className="text-muted-foreground text-sm animate-pulse">Loading...</span></div>}>
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

export default function DispatchTrackerPage() {
  return (
    <ErrorBoundary>
      <DispatchTracker />
    </ErrorBoundary>
  );
}
