/**
 * ═══════════════════════════════════════════════════════════
 * DRIVER PORTAL — Mobile-First PWA
 *
 * This replaces Onfleet / OnTime 360 driver apps entirely.
 * Drivers open this on their phone's browser — no app store needed.
 *
 * Features:
 *   1. Go on-duty / off-duty (starts/stops GPS tracking)
 *   2. See assigned loads for today
 *   3. Update load status (tap → picked up → in transit → delivered)
 *   4. Capture POD (photo + signature)
 *   5. Live GPS tracked in background (30s intervals)
 *
 * Cost: $0 — browser Geolocation API + Supabase
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDriverGPS } from "@/hooks/useDriverGPS";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    MapPin, Navigation, Truck, Package, Clock, Battery,
    CheckCircle2, AlertCircle, Wifi, WifiOff,
    ChevronRight, Phone, Camera, ArrowRight,
    Power, Pause, Play, Radio,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────

interface DriverLoad {
    id: string;
    reference_number: string | null;
    client_name: string | null;
    pickup_address: string | null;
    delivery_address: string | null;
    status: string;
    packages: number;
    service_type: string;
    start_time: string | null;
    end_time: string | null;
    wait_time_minutes: number;
    comments: string | null;
}

interface DriverProfile {
    id: string;
    full_name: string;
    hub: string;
    status: string;
}

const STATUS_FLOW: { value: string; label: string; icon: typeof Package; color: string }[] = [
    { value: "assigned", label: "Assigned", icon: Package, color: "bg-blue-500" },
    { value: "picked_up", label: "Picked Up", icon: Truck, color: "bg-indigo-500" },
    { value: "in_progress", label: "In Transit", icon: Navigation, color: "bg-yellow-500" },
    { value: "delivered", label: "Delivered", icon: CheckCircle2, color: "bg-green-500" },
];

function getNextStatus(current: string): string | null {
    const idx = STATUS_FLOW.findIndex((s) => s.value === current);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1].value;
}

function getStatusInfo(status: string) {
    return STATUS_FLOW.find((s) => s.value === status) ?? STATUS_FLOW[0];
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
}

// ═══════════════════════════════════════════════════════════
export default function DriverPortal() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [driver, setDriver] = useState<DriverProfile | null>(null);
    const [loads, setLoads] = useState<DriverLoad[]>([]);
    const [loading, setLoading] = useState(true);
    const [onDuty, setOnDuty] = useState(false);
    const [shiftId, setShiftId] = useState<string | null>(null);
    const [activeLoadId, setActiveLoadId] = useState<string | null>(null);
    const [statusNote, setStatusNote] = useState("");
    const [updatingLoadId, setUpdatingLoadId] = useState<string | null>(null);

    // ── GPS Hook ─────────────────────────────
    const gps = useDriverGPS({
        driverId: driver?.id ?? "",
        activeLoadId,
        intervalMs: 30_000,
        enabled: onDuty && !!driver,
    });

    // ── Fetch driver profile ─────────────────
    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data } = (await supabase
                .from("drivers")
                .select("id, full_name, hub, status")
                .eq("user_id", user.id)
                .single()) as { data: DriverProfile | null; error: any };
            if (data) {
                setDriver(data);
                // Check for active shift
                const { data: shift } = await supabase
                    .from("driver_shifts")
                    .select("id")
                    .eq("driver_id", data.id)
                    .is("shift_end", null)
                    .single() as { data: { id: string } | null };
                if (shift) {
                    setShiftId(shift.id);
                    setOnDuty(true);
                }
            }
            setLoading(false);
        })();
    }, [user]);

    // ── Fetch today's loads ──────────────────
    const fetchLoads = useCallback(async () => {
        if (!driver) return;
        const today = new Date().toISOString().split("T")[0];
        const { data } = await supabase
            .from("daily_loads")
            .select("id, reference_number, client_name, pickup_address, delivery_address, status, packages, service_type, start_time, end_time, wait_time_minutes, comments")
            .eq("driver_id", driver.id)
            .eq("load_date", today)
            .order("start_time", { ascending: true });
        if (data) setLoads(data as DriverLoad[]);
    }, [driver]);

    useEffect(() => { fetchLoads(); }, [fetchLoads]);

    // Set active load (first non-delivered load)
    useEffect(() => {
        const active = loads.find((l) => l.status !== "delivered" && l.status !== "cancelled");
        setActiveLoadId(active?.id ?? null);
    }, [loads]);

    // ── Toggle duty ──────────────────────────
    const toggleDuty = async () => {
        if (!driver) return;

        if (!onDuty) {
            // Go on duty
            const granted = await gps.requestPermission();
            if (!granted) {
                toast({ title: "Location needed", description: "Please allow location access to go on duty.", variant: "destructive" });
                return;
            }
            const { data, error } = await supabase
                .from("driver_shifts")
                .insert({
                    driver_id: driver.id,
                    hub: driver.hub,
                    start_lat: gps.position?.latitude,
                    start_lng: gps.position?.longitude,
                })
                .select("id")
                .single();
            if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
                return;
            }
            setShiftId(data.id);
            setOnDuty(true);
            gps.startTracking();
            toast({ title: "🟢 On Duty", description: "GPS tracking started. Drive safe!" });
        } else {
            // Go off duty
            if (shiftId) {
                await supabase.from("driver_shifts").update({
                    shift_end: new Date().toISOString(),
                    status: "off_duty",
                    end_lat: gps.position?.latitude,
                    end_lng: gps.position?.longitude,
                }).eq("id", shiftId);
            }
            gps.stopTracking();
            setOnDuty(false);
            setShiftId(null);
            toast({ title: "🔴 Off Duty", description: "GPS tracking stopped. Good job today!" });
        }
    };

    // ── Update load status ───────────────────
    const advanceStatus = async (load: DriverLoad) => {
        const nextStatus = getNextStatus(load.status);
        if (!nextStatus || !driver) return;
        setUpdatingLoadId(load.id);

        // Update the load
        const updatePayload: Record<string, unknown> = { status: nextStatus, updated_at: new Date().toISOString() };

        // Auto-fill timestamps
        if (nextStatus === "picked_up" || nextStatus === "in_progress") {
            updatePayload.start_time = new Date().toTimeString().slice(0, 5);
        }
        if (nextStatus === "delivered") {
            updatePayload.end_time = new Date().toTimeString().slice(0, 5);
            updatePayload.pod_confirmed = false; // will be set true when POD is captured
        }

        const { error } = await supabase.from("daily_loads").update(updatePayload).eq("id", load.id);
        if (error) {
            toast({ title: "Update failed", description: error.message, variant: "destructive" });
            setUpdatingLoadId(null);
            return;
        }

        // Log the status event with GPS
        await supabase.from("load_status_events").insert({
            load_id: load.id,
            driver_id: driver.id,
            old_status: load.status,
            new_status: nextStatus,
            latitude: gps.position?.latitude,
            longitude: gps.position?.longitude,
            note: statusNote || null,
        });

        setStatusNote("");
        setUpdatingLoadId(null);
        toast({ title: `✅ ${getStatusInfo(nextStatus).label}`, description: load.client_name ?? "Load updated" });
        fetchLoads();
    };

    // ── Render ───────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-3">
                    <Truck className="h-10 w-10 mx-auto text-primary animate-pulse" />
                    <p className="text-sm text-muted-foreground">Loading Driver Portal...</p>
                </div>
            </div>
        );
    }

    if (!driver) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <Card className="max-w-sm w-full border-0 shadow-lg">
                    <CardContent className="pt-8 pb-6 text-center space-y-4">
                        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
                        <h2 className="text-lg font-bold">Driver Profile Not Found</h2>
                        <p className="text-sm text-muted-foreground">
                            Your account isn't linked to a driver profile. Ask your dispatcher to assign you.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const activeLoads = loads.filter((l) => l.status !== "delivered" && l.status !== "cancelled");
    const completedLoads = loads.filter((l) => l.status === "delivered");

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* ── Header ── */}
            <div className={`px-4 py-4 ${onDuty ? "bg-green-600" : "bg-slate-800"} text-white transition-colors duration-500`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold">{driver.full_name}</h1>
                        <p className="text-xs opacity-80 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {driver.hub.charAt(0).toUpperCase() + driver.hub.slice(1)} Hub
                        </p>
                    </div>
                    <div className="text-right">
                        <Badge className={`${onDuty ? "bg-white/20 text-white" : "bg-white/10 text-white/60"} text-xs`}>
                            {onDuty ? "🟢 On Duty" : "🔴 Off Duty"}
                        </Badge>
                        {gps.tracking && (
                            <p className="text-[10px] opacity-60 mt-1 flex items-center gap-1 justify-end">
                                <Radio className="h-2.5 w-2.5 animate-pulse" /> GPS active · {gps.pingCount} pings
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── GPS Status Bar ── */}
            {onDuty && (
                <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                        {gps.position ? (
                            <><Wifi className="h-3 w-3 text-green-500" /> GPS locked</>
                        ) : (
                            <><WifiOff className="h-3 w-3 text-yellow-500" /> Acquiring GPS...</>
                        )}
                    </span>
                    {gps.position?.accuracy && (
                        <span className="text-muted-foreground">±{Math.round(gps.position.accuracy)}m</span>
                    )}
                    {gps.position?.speed !== null && gps.position?.speed !== undefined && (
                        <span className="text-muted-foreground">{Math.round(gps.position.speed * 2.237)} mph</span>
                    )}
                    {gps.lastPingAt && (
                        <span className="ml-auto text-muted-foreground">Last ping: {timeAgo(gps.lastPingAt)}</span>
                    )}
                </div>
            )}

            <div className="px-4 py-4 space-y-4">
                {/* ── Duty Toggle ── */}
                <Button
                    onClick={toggleDuty}
                    className={`w-full h-14 text-base font-bold rounded-2xl transition-all shadow-lg ${onDuty
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-green-500 hover:bg-green-600 text-white"
                        }`}
                >
                    <Power className="h-5 w-5 mr-2" />
                    {onDuty ? "End Shift" : "Start Shift"}
                </Button>

                {/* ── GPS Permission Warning ── */}
                {gps.permissionStatus === "denied" && (
                    <Card className="border-red-500/30 bg-red-500/5">
                        <CardContent className="py-3 px-4 flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-600">Location blocked</p>
                                <p className="text-xs text-muted-foreground">Allow location access in your browser settings to use GPS tracking.</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ── Active Loads ── */}
                <div>
                    <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        Active Loads ({activeLoads.length})
                    </h2>

                    {activeLoads.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="py-8 text-center">
                                <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">No loads assigned for today</p>
                                <p className="text-xs text-muted-foreground mt-1">Check with your dispatcher</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {activeLoads.map((load) => {
                                const statusInfo = getStatusInfo(load.status);
                                const nextStatus = getNextStatus(load.status);
                                const nextInfo = nextStatus ? getStatusInfo(nextStatus) : null;
                                const isUpdating = updatingLoadId === load.id;
                                const StatusIcon = statusInfo.icon;

                                return (
                                    <Card key={load.id} className="border-0 shadow-sm overflow-hidden">
                                        {/* Status stripe */}
                                        <div className={`h-1 ${statusInfo.color}`} />
                                        <CardContent className="pt-3 pb-3 space-y-3">
                                            {/* Header row */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-semibold text-sm">{load.client_name ?? "Unknown Client"}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {load.reference_number ? `#${load.reference_number}` : ""} · {load.packages} pkg · {load.service_type}
                                                    </p>
                                                </div>
                                                <Badge className={`${statusInfo.color} text-white text-[10px]`}>
                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                    {statusInfo.label}
                                                </Badge>
                                            </div>

                                            {/* Addresses */}
                                            <div className="space-y-1.5">
                                                {load.pickup_address && (
                                                    <div className="flex items-start gap-2 text-xs">
                                                        <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                                                            <ChevronRight className="h-2.5 w-2.5 text-white" />
                                                        </div>
                                                        <span className="text-muted-foreground">{load.pickup_address}</span>
                                                    </div>
                                                )}
                                                {load.delivery_address && (
                                                    <div className="flex items-start gap-2 text-xs">
                                                        <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center shrink-0 mt-0.5">
                                                            <MapPin className="h-2.5 w-2.5 text-white" />
                                                        </div>
                                                        <span className="text-muted-foreground">{load.delivery_address}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quick Actions: Navigate, Call, Camera */}
                                            <div className="flex gap-2">
                                                {load.delivery_address && (
                                                    <Button
                                                        variant="outline" size="sm"
                                                        className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
                                                        onClick={() => {
                                                            const addr = encodeURIComponent(load.delivery_address!);
                                                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, "_blank");
                                                        }}
                                                    >
                                                        <Navigation className="h-3.5 w-3.5 text-blue-500" /> Navigate
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline" size="sm"
                                                    className="h-9 w-9 p-0 rounded-lg shrink-0"
                                                    onClick={() => {
                                                        toast({ title: "📞 Call client", description: "Client phone not yet configured for this load." });
                                                    }}
                                                >
                                                    <Phone className="h-3.5 w-3.5 text-green-500" />
                                                </Button>
                                                <Button
                                                    variant="outline" size="sm"
                                                    className="h-9 w-9 p-0 rounded-lg shrink-0"
                                                    onClick={() => {
                                                        // Trigger POD photo capture using device camera
                                                        const input = document.createElement("input");
                                                        input.type = "file";
                                                        input.accept = "image/*";
                                                        input.capture = "environment";
                                                        input.onchange = async (e) => {
                                                            const file = (e.target as HTMLInputElement).files?.[0];
                                                            if (!file) return;
                                                            // Upload POD photo to Supabase Storage
                                                            const path = `pod/${load.id}/${Date.now()}_${file.name}`;
                                                            const { error: uploadErr } = await supabase.storage
                                                                .from("documents")
                                                                .upload(path, file, { contentType: file.type });
                                                            if (uploadErr) {
                                                                toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
                                                            } else {
                                                                await supabase.from("daily_loads").update({ pod_confirmed: true }).eq("id", load.id);
                                                                toast({ title: "📸 POD captured!", description: "Photo uploaded successfully." });
                                                                fetchLoads();
                                                            }
                                                        };
                                                        input.click();
                                                    }}
                                                >
                                                    <Camera className="h-3.5 w-3.5 text-orange-500" />
                                                </Button>
                                            </div>

                                            {/* Note input (optional) */}
                                            {nextStatus && (
                                                <Textarea
                                                    placeholder="Add a note (optional)..."
                                                    value={activeLoadId === load.id ? statusNote : ""}
                                                    onChange={(e) => { setActiveLoadId(load.id); setStatusNote(e.target.value); }}
                                                    className="text-xs h-8 min-h-[32px] resize-none"
                                                />
                                            )}

                                            {/* Action button */}
                                            {nextInfo && (
                                                <Button
                                                    onClick={() => advanceStatus(load)}
                                                    disabled={isUpdating}
                                                    className={`w-full h-11 ${nextInfo.color} hover:opacity-90 text-white font-semibold rounded-xl`}
                                                >
                                                    {isUpdating ? (
                                                        <span className="animate-pulse">Updating...</span>
                                                    ) : (
                                                        <>
                                                            <ArrowRight className="h-4 w-4 mr-2" />
                                                            Mark as {nextInfo.label}
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Completed Loads ── */}
                {completedLoads.length > 0 && (
                    <div>
                        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Completed ({completedLoads.length})
                        </h2>
                        <div className="space-y-2">
                            {completedLoads.map((load) => (
                                <Card key={load.id} className="border-0 shadow-sm opacity-70">
                                    <CardContent className="py-2.5 px-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{load.client_name ?? "Unknown"}</p>
                                            <p className="text-[10px] text-muted-foreground">{load.reference_number ?? ""}</p>
                                        </div>
                                        <Badge className="bg-green-500/15 text-green-600 border-0 text-[10px]">
                                            ✅ Delivered
                                        </Badge>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Stats Footer ── */}
                {onDuty && gps.tracking && (
                    <Card className="border-0 bg-muted/30">
                        <CardContent className="py-3 px-4">
                            <div className="grid grid-cols-3 gap-4 text-center text-xs">
                                <div>
                                    <p className="text-muted-foreground">GPS Pings</p>
                                    <p className="text-lg font-bold">{gps.pingCount}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Loads Done</p>
                                    <p className="text-lg font-bold text-green-600">{completedLoads.length}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Remaining</p>
                                    <p className="text-lg font-bold text-yellow-600">{activeLoads.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
