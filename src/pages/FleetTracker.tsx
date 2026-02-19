// ═══════════════════════════════════════════════════════════
// FLEET TRACKER — Vehicle & Equipment Management
// Tab 1: Vehicles     — CRUD + status + mileage + inspections
// Tab 2: Maintenance  — Service records & upcoming alerts
// Tab 3: Drivers      — Driver roster management
// + Walk-Around Inspection System + Car Wash Tracking
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/formatters";
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
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
    Truck, Plus, Pencil, Trash2, Wrench, Users, AlertTriangle,
    CheckCircle, Gauge, Shield, Fuel, ClipboardCheck,
    Droplets, ArrowUp, ArrowDown, Minus, Eye, Flag, X,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import InspectionForm from "@/components/InspectionForm";

// ─── Types ──────────────────────────────────────────
type Vehicle = {
    id: string; vehicle_name: string; vehicle_type: string;
    make: string | null; model: string | null; year: number | null;
    vin: string | null; license_plate: string | null;
    hub: string; status: string; current_mileage: number;
    next_service_mileage: number | null; next_service_date: string | null;
    insurance_expiry: string | null; registration_expiry: string | null;
    fuel_type: string; avg_mpg: number | null; daily_rate: number;
    notes: string | null; created_at: string;
};
type MaintenanceRecord = {
    id: string; vehicle_id: string; maintenance_type: string;
    description: string | null; cost: number; mileage_at_service: number | null;
    service_date: string; next_service_date: string | null;
    next_service_mileage: number | null; vendor: string | null;
    notes: string | null; created_at: string;
};
type Driver = {
    id: string; full_name: string; phone: string | null; email: string | null;
    hub: string; status: string; license_number: string | null;
    license_expiry: string | null; hired_date: string | null;
    hourly_rate: number; notes: string | null; created_at: string;
};
type FleetInspectionStatus = {
    vehicle_id: string; vehicle_name: string; plate: string | null;
    inspection_done: boolean; inspection_status: string;
    last_odometer: number | null; last_car_wash: string | null;
    days_since_wash: number; car_wash_overdue: boolean;
};
type OdometerHistory = {
    inspection_date: string; odometer_reading: number; driver_name: string | null;
};
type InspectionRecord = {
    id: string; vehicle_id: string | null; driver_id: string | null;
    inspection_date: string; odometer_reading: number;
    checklist: {
        tires_ok: boolean; lights_ok: boolean; brakes_ok: boolean;
        fluids_ok: boolean; exterior_damage: boolean; interior_clean: boolean;
        fuel_level: string;
    };
    photos: string[]; notes: string | null; car_wash_done: boolean;
    status: string; submitted_by: string | null; reviewed_by: string | null;
    created_at: string;
};

// ─── Constants ──────────────────────────────────────
const VEHICLE_TYPES = [
    { value: "cargo_van", label: "Cargo Van" },
    { value: "box_truck", label: "Box Truck" },
    { value: "sprinter", label: "Sprinter" },
    { value: "flatbed", label: "Flatbed" },
    { value: "pickup", label: "Pickup" },
];
const VEHICLE_STATUSES = [
    { value: "active", label: "Active", badge: "bg-green-500/15 text-green-700 dark:text-green-400" },
    { value: "maintenance", label: "In Maintenance", badge: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    { value: "retired", label: "Retired", badge: "bg-gray-500/15 text-gray-700 dark:text-gray-400" },
];
const DRIVER_STATUSES = [
    { value: "active", label: "Active", badge: "bg-green-500/15 text-green-700 dark:text-green-400" },
    { value: "inactive", label: "Inactive", badge: "bg-gray-500/15 text-gray-600" },
    { value: "on_leave", label: "On Leave", badge: "bg-yellow-500/15 text-yellow-700" },
];
const MAINT_TYPES = [
    { value: "oil_change", label: "Oil Change" },
    { value: "tire_rotation", label: "Tire Rotation" },
    { value: "brake_service", label: "Brake Service" },
    { value: "inspection", label: "Inspection" },
    { value: "repair", label: "Repair" },
    { value: "other", label: "Other" },
];
const HUBS = CITY_HUBS;

// ─── Helper Components ───────────────────────────────
function InspectionBadge({ done, status }: { done: boolean; status: string }) {
    if (done) {
        if (status === "flagged") return (
            <Badge className="bg-red-500/15 text-red-700 text-[10px] gap-1">
                <Flag className="h-2.5 w-2.5" /> Flagged
            </Badge>
        );
        if (status === "approved") return (
            <Badge className="bg-green-500/15 text-green-700 text-[10px] gap-1">
                <CheckCircle className="h-2.5 w-2.5" /> Approved
            </Badge>
        );
        return (
            <Badge className="bg-blue-500/15 text-blue-700 text-[10px] gap-1">
                <CheckCircle className="h-2.5 w-2.5" /> Inspected
            </Badge>
        );
    }
    return (
        <Badge className="bg-red-500/15 text-red-700 text-[10px] gap-1">
            <AlertTriangle className="h-2.5 w-2.5" /> Pending
        </Badge>
    );
}

function CarWashBadge({ daysSince, overdue }: { daysSince: number; overdue: boolean }) {
    if (daysSince >= 999) return (
        <Badge className="bg-red-500/15 text-red-700 text-[10px] gap-1">
            <Droplets className="h-2.5 w-2.5" /> Never washed
        </Badge>
    );
    if (overdue) return (
        <Badge className="bg-red-500/15 text-red-700 text-[10px] gap-1">
            <Droplets className="h-2.5 w-2.5" /> Wash overdue ({daysSince}d)
        </Badge>
    );
    if (daysSince >= 8) return (
        <Badge className="bg-yellow-500/15 text-yellow-700 text-[10px] gap-1">
            <Droplets className="h-2.5 w-2.5" /> Wash soon ({daysSince}d)
        </Badge>
    );
    return (
        <Badge className="bg-green-500/15 text-green-700 text-[10px] gap-1">
            <Droplets className="h-2.5 w-2.5" /> Clean ({daysSince}d)
        </Badge>
    );
}

// ═══════════════════════════════════════════════════════════
export default function FleetTracker() {
    const { user } = useAuth();
    const { toast } = useToast();
    const db = supabase;

    const queryClient = useQueryClient();

    const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
        queryKey: ["fleet-vehicles"],
        queryFn: async () => {
            const { data, error } = await db.from("vehicles").select("*").order("vehicle_name");
            if (error) throw error;
            return (data ?? []) as Vehicle[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const { data: maintenance = [], isLoading: maintLoading } = useQuery({
        queryKey: ["fleet-maintenance"],
        queryFn: async () => {
            const { data, error } = await db.from("vehicle_maintenance").select("*").order("service_date", { ascending: false });
            if (error) throw error;
            return (data ?? []) as MaintenanceRecord[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const { data: drivers = [], isLoading: driversLoading } = useQuery({
        queryKey: ["fleet-drivers"],
        queryFn: async () => {
            const { data, error } = await db.from("drivers").select("*").order("full_name");
            if (error) throw error;
            return (data ?? []) as Driver[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const { data: fleetStatus = [], isLoading: fleetStatusLoading } = useQuery({
        queryKey: ["fleet-inspection-status"],
        queryFn: async () => {
            const { data, error } = await db.rpc("get_fleet_inspection_status");
            if (error) throw error;
            return (data ?? []) as FleetInspectionStatus[];
        },
        staleTime: 30_000,
        retry: 3,
        enabled: !!user,
    });

    const loading = vehiclesLoading || maintLoading || driversLoading || fleetStatusLoading;

    // Helpers to invalidate fleet queries after mutations
    const refetchAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
        queryClient.invalidateQueries({ queryKey: ["fleet-maintenance"] });
        queryClient.invalidateQueries({ queryKey: ["fleet-drivers"] });
    }, [queryClient]);

    const refetchFleetStatus = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["fleet-inspection-status"] });
    }, [queryClient]);

    // Inspection state
    // (fleetStatus now comes from useQuery above)
    const [inspectionDialog, setInspectionDialog] = useState(false);
    const [selectedVehicleForInspection, setSelectedVehicleForInspection] = useState<string | undefined>();
    const [historySheet, setHistorySheet] = useState(false);
    const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null);
    const [odometerHistory, setOdometerHistory] = useState<OdometerHistory[]>([]);
    const [inspectionHistory, setInspectionHistory] = useState<InspectionRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

    // CRUD Dialogs
    const [vehDialog, setVehDialog] = useState(false);
    const [editVeh, setEditVeh] = useState<Vehicle | null>(null);
    const [maintDialog, setMaintDialog] = useState(false);
    const [editMaint, setEditMaint] = useState<MaintenanceRecord | null>(null);
    const [drvDialog, setDrvDialog] = useState(false);
    const [editDrv, setEditDrv] = useState<Driver | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

    // fetchAll / fetchFleetStatus replaced by React Query above

    // ── Open inspection history ──────────────
    const openHistory = useCallback(async (vehicle: Vehicle) => {
        setHistoryVehicle(vehicle);
        setHistorySheet(true);
        setHistoryLoading(true);
        setOdometerHistory([]);
        setInspectionHistory([]);

        const [odo, insp] = await Promise.all([
            db.rpc("get_vehicle_odometer_history", { p_vehicle_id: vehicle.id }),
            db.from("vehicle_inspections")
                .select("*")
                .eq("vehicle_id", vehicle.id)
                .order("inspection_date", { ascending: false })
                .limit(30),
        ]);

        if (odo.data) setOdometerHistory(odo.data as OdometerHistory[]);
        if (insp.data) setInspectionHistory(insp.data as unknown as InspectionRecord[]);
        setHistoryLoading(false);
    }, []);

    // ── Log car wash ─────────────────────────
    const logCarWash = useCallback(async (vehicle: Vehicle) => {
        const today = new Date().toISOString().split("T")[0];
        const { error } = await db.from("vehicle_car_washes").insert({
            vehicle_id: vehicle.id,
            wash_date: today,
            notes: "Logged by dispatcher",
            recorded_by: user?.id ?? null,
        });
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({ title: `🚿 Car wash logged for ${vehicle.vehicle_name}` });
            refetchFleetStatus();
        }
    }, [user, refetchFleetStatus, toast]);

    // ── Flag / Approve inspection ────────────
    const flagInspection = useCallback(async (inspectionId: string) => {
        const { error } = await db.from("vehicle_inspections")
            .update({ status: "flagged", reviewed_by: user?.id ?? null })
            .eq("id", inspectionId);
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Inspection flagged" });
            if (historyVehicle) openHistory(historyVehicle);
            refetchFleetStatus();
        }
    }, [user, historyVehicle, openHistory, refetchFleetStatus, toast]);

    const approveInspection = useCallback(async (inspectionId: string) => {
        const { error } = await db.from("vehicle_inspections")
            .update({ status: "approved", reviewed_by: user?.id ?? null })
            .eq("id", inspectionId);
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Inspection approved" });
            if (historyVehicle) openHistory(historyVehicle);
            refetchFleetStatus();
        }
    }, [user, historyVehicle, openHistory, refetchFleetStatus, toast]);

    // ── Stats ────────────────────────────────
    const stats = useMemo(() => {
        const active = vehicles.filter((v) => v.status === "active").length;
        const inMaint = vehicles.filter((v) => v.status === "maintenance").length;
        const totalMileage = vehicles.reduce((s, v) => s + (v.current_mileage || 0), 0);
        const today = new Date().toISOString().split("T")[0];
        const serviceDue = vehicles.filter((v) => {
            if (v.next_service_date && v.next_service_date <= today) return true;
            if (v.next_service_mileage && v.current_mileage >= v.next_service_mileage) return true;
            return false;
        });
        const expiringInsurance = vehicles.filter((v) => v.insurance_expiry && differenceInDays(new Date(v.insurance_expiry), new Date()) <= 30);
        const activeDrivers = drivers.filter((d) => d.status === "active").length;
        const totalMaintCost = maintenance.reduce((s, m) => s + Number(m.cost), 0);
        return { active, inMaint, totalMileage, serviceDue, expiringInsurance, activeDrivers, totalMaintCost };
    }, [vehicles, maintenance, drivers]);

    const inspectionStats = useMemo(() => {
        const total = fleetStatus.length;
        const inspected = fleetStatus.filter((f) => f.inspection_done).length;
        const pending = total - inspected;
        const washOverdue = fleetStatus.filter((f) => f.car_wash_overdue).length;
        return { total, inspected, pending, washOverdue };
    }, [fleetStatus]);

    const getVehicleFleetStatus = (vehicleId: string) =>
        fleetStatus.find((f) => f.vehicle_id === vehicleId);

    // ── Vehicle CRUD ─────────────────────────
    const handleVehSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const vName = fd.get("vehicle_name") as string;
        const vType = fd.get("vehicle_type") as string || "cargo_van";
        const plateFd = (fd.get("license_plate") as string) || "N/A";
        const rawNextSvcMi = fd.get("next_service_mileage") as string;
        const rawYear = fd.get("year") as string;
        const rawAvgMpg = fd.get("avg_mpg") as string;
        const payload = {
            vehicle_name: vName,
            vehicle_type: vType,
            license_plate: plateFd !== "N/A" ? plateFd : null,
            name: vName,
            type: vType,
            plate_number: plateFd,
            make: fd.get("make") as string || null,
            model: fd.get("model") as string || null,
            year: rawYear !== "" ? Number(rawYear) : null,
            vin: fd.get("vin") as string || null,
            hub: fd.get("hub") as string || "phoenix",
            status: fd.get("status") as string || "active",
            current_mileage: Number(fd.get("current_mileage")) || 0,
            next_service_mileage: rawNextSvcMi !== "" ? Number(rawNextSvcMi) : null,
            next_service_date: fd.get("next_service_date") as string || null,
            insurance_expiry: fd.get("insurance_expiry") as string || null,
            registration_expiry: fd.get("registration_expiry") as string || null,
            fuel_type: fd.get("fuel_type") as string || "gasoline",
            avg_mpg: rawAvgMpg !== "" ? Number(rawAvgMpg) : null,
            daily_rate: Number(fd.get("daily_rate")) || 0,
            notes: fd.get("notes") as string || null,
            updated_at: new Date().toISOString(),
            ...(editVeh ? {} : { created_by: user!.id }),
        };
        const { error } = editVeh
            ? await db.from("vehicles").update(payload).eq("id", editVeh.id)
            : await db.from("vehicles").insert(payload);
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else {
            toast({ title: editVeh ? "Vehicle updated" : "Vehicle added" });
            setVehDialog(false); setEditVeh(null);
            refetchAll(); refetchFleetStatus();
        }
    };

    // ── Maintenance CRUD ─────────────────────
    const handleMaintSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const rawMileageAtService = fd.get("mileage_at_service") as string;
        const rawNextServiceMileage = fd.get("next_service_mileage") as string;
        const payload = {
            vehicle_id: (fd.get("vehicle_id") as string) || null,
            maintenance_type: fd.get("maintenance_type") as string,
            description: fd.get("description") as string || null,
            cost: Number(fd.get("cost")) || 0,
            mileage_at_service: rawMileageAtService !== "" ? Number(rawMileageAtService) : null,
            service_date: fd.get("service_date") as string || new Date().toISOString().split("T")[0],
            next_service_date: fd.get("next_service_date") as string || null,
            next_service_mileage: rawNextServiceMileage !== "" ? Number(rawNextServiceMileage) : null,
            vendor: fd.get("vendor") as string || null,
            notes: fd.get("notes") as string || null,
            ...(editMaint ? {} : { created_by: user!.id }),
        };
        const { error } = editMaint
            ? await db.from("vehicle_maintenance").update(payload).eq("id", editMaint.id)
            : await db.from("vehicle_maintenance").insert(payload);
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: editMaint ? "Record updated" : "Maintenance logged" }); setMaintDialog(false); setEditMaint(null); refetchAll(); }
    };

    // ── Driver CRUD ──────────────────────────
    const handleDrvSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            full_name: fd.get("full_name") as string,
            phone: fd.get("phone") as string || "",
            email: fd.get("email") as string || null,
            hub: fd.get("hub") as string || "phoenix",
            status: fd.get("status") as string || "active",
            license_number: fd.get("license_number") as string || null,
            license_expiry: fd.get("license_expiry") as string || null,
            hired_date: fd.get("hired_date") as string || null,
            hourly_rate: Number(fd.get("hourly_rate")) || 0,
            notes: fd.get("notes") as string || null,
            updated_at: new Date().toISOString(),
            ...(editDrv ? {} : { created_by: user!.id }),
        };
        const { error } = editDrv
            ? await db.from("drivers").update(payload).eq("id", editDrv.id)
            : await db.from("drivers").insert(payload);
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: editDrv ? "Driver updated" : "Driver added" }); setDrvDialog(false); setEditDrv(null); refetchAll(); }
    };

    // ── Delete ───────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget) return;
        const table = deleteTarget.type === "vehicle" ? "vehicles" : deleteTarget.type === "maintenance" ? "vehicle_maintenance" : "drivers";
        const { error } = await db.from(table).delete().eq("id", deleteTarget.id);
        setDeleteTarget(null);
        if (error) {
            toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Deleted" });
            refetchAll();
        }
    };

    const vehStatusBadge = (s: string) => VEHICLE_STATUSES.find((v) => v.value === s) ?? VEHICLE_STATUSES[0];
    const drvStatusBadge = (s: string) => DRIVER_STATUSES.find((d) => d.value === s) ?? DRIVER_STATUSES[0];
    const vehTypeLbl = (t: string) => VEHICLE_TYPES.find((v) => v.value === t)?.label ?? t;
    const maintTypeLbl = (t: string) => MAINT_TYPES.find((m) => m.value === t)?.label ?? t;
    const vehName = (id: string) => vehicles.find((v) => v.id === id)?.vehicle_name ?? "—";

    if (loading) return (
        <div className="space-y-6 p-6 animate-in">
            <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
            <Skeleton className="h-10 w-96" />
            <Skeleton className="h-96 rounded-2xl" />
        </div>
    );

    // ═══════════════════════════════════════════
    return (
        <div className="space-y-6 animate-in">
            <div>
                <h1 className="text-2xl font-bold tracking-tight gradient-text">Fleet Tracker</h1>
                <p className="text-muted-foreground text-sm mt-1">Vehicle management, maintenance scheduling & driver roster</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                {[
                    { label: "Active Vehicles", value: stats.active, icon: Truck, color: "text-green-500" },
                    { label: "In Maintenance", value: stats.inMaint, icon: Wrench, color: "text-yellow-500" },
                    { label: "Service Due", value: stats.serviceDue.length, icon: AlertTriangle, color: stats.serviceDue.length > 0 ? "text-red-500" : "text-green-500" },
                    { label: "Insurance Expiring", value: stats.expiringInsurance.length, icon: Shield, color: stats.expiringInsurance.length > 0 ? "text-orange-500" : "text-green-500" },
                    { label: "Active Drivers", value: stats.activeDrivers, icon: Users, color: "text-blue-500" },
                    { label: "Fleet Mileage", value: stats.totalMileage.toLocaleString(), icon: Gauge, color: "text-purple-500" },
                    { label: "Maint. Costs", value: fmtMoney(stats.totalMaintCost), icon: Wrench, color: "text-red-500" },
                ].map((s) => (
                    <Card key={s.label} className="glass-card rounded-2xl">
                        <CardContent className="pt-4 pb-3 px-4">
                            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xl font-bold">{s.value}</p>
                                <s.icon className={`h-4 w-4 ${s.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ─── TODAY'S FLEET STATUS ─── */}
            {fleetStatus.length > 0 && (
                <Card className="glass-card rounded-2xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-blue-500" />
                            Today&apos;s Fleet Status
                            <Badge variant="secondary" className="ml-auto text-[10px]">
                                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            {[
                                { label: "Total Vehicles", value: inspectionStats.total, color: "text-foreground" },
                                { label: "Inspected Today", value: inspectionStats.inspected, color: "text-green-500" },
                                { label: "Pending Inspection", value: inspectionStats.pending, color: inspectionStats.pending > 0 ? "text-red-500" : "text-green-500" },
                                { label: "Car Wash Overdue", value: inspectionStats.washOverdue, color: inspectionStats.washOverdue > 0 ? "text-orange-500" : "text-green-500" },
                            ].map((s) => (
                                <div key={s.label} className="rounded-xl bg-muted/40 px-3 py-2.5 text-center">
                                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {fleetStatus.map((fs) => (
                                <div key={fs.vehicle_id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium truncate">{fs.vehicle_name}</p>
                                        {fs.plate && <p className="text-[10px] text-muted-foreground">{fs.plate}</p>}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <InspectionBadge done={fs.inspection_done} status={fs.inspection_status} />
                                        {fs.car_wash_overdue && (
                                            <Badge className="bg-orange-500/15 text-orange-700 text-[10px]">
                                                <Droplets className="h-2.5 w-2.5" />
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* TABS */}
            <Tabs defaultValue="vehicles" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="vehicles" className="gap-1.5"><Truck className="h-3.5 w-3.5" /> Vehicles ({vehicles.length})</TabsTrigger>
                    <TabsTrigger value="maintenance" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Maintenance ({maintenance.length})</TabsTrigger>
                    <TabsTrigger value="drivers" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Drivers ({drivers.length})</TabsTrigger>
                </TabsList>

                {/* ──── VEHICLES TAB ──── */}
                <TabsContent value="vehicles" className="space-y-4">
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => { setSelectedVehicleForInspection(undefined); setInspectionDialog(true); }}
                        >
                            <ClipboardCheck className="h-4 w-4" /> Log Inspection
                        </Button>
                        <Button className="btn-gradient gap-2" onClick={() => { setEditVeh(null); setVehDialog(true); }}>
                            <Plus className="h-4 w-4" /> Add Vehicle
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vehicles.map((v) => {
                            const stBadge = vehStatusBadge(v.status);
                            const today = new Date();
                            const serviceDue = (v.next_service_date && new Date(v.next_service_date) <= today) ||
                                (v.next_service_mileage && v.current_mileage >= v.next_service_mileage);
                            const insuranceWarn = v.insurance_expiry && differenceInDays(new Date(v.insurance_expiry), today) <= 30;
                            const fs = getVehicleFleetStatus(v.id);
                            return (
                                <Card key={v.id} className={`glass-card rounded-2xl relative overflow-hidden ${serviceDue ? "ring-2 ring-red-500/30" : ""}`}>
                                    {serviceDue && <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />}
                                    <CardContent className="pt-5 pb-4 px-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-bold text-lg">{v.vehicle_name}</h3>
                                                <p className="text-xs text-muted-foreground">{v.make} {v.model} {v.year ? `(${v.year})` : ""}</p>
                                            </div>
                                            <Badge className={`${stBadge.badge} text-[10px]`}>{stBadge.label}</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                            <div className="flex items-center gap-1.5 text-muted-foreground"><Gauge className="h-3 w-3" />{(v.current_mileage || 0).toLocaleString()} mi</div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground"><Fuel className="h-3 w-3" />{v.avg_mpg ? `${v.avg_mpg} mpg` : "—"}</div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground"><Truck className="h-3 w-3" />{vehTypeLbl(v.vehicle_type)}</div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground">{v.license_plate || "No plate"}</div>
                                        </div>
                                        {/* Inspection + Car Wash Status */}
                                        {fs && (
                                            <div className="space-y-1.5 mb-3">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <InspectionBadge done={fs.inspection_done} status={fs.inspection_status} />
                                                    <CarWashBadge daysSince={fs.days_since_wash} overdue={fs.car_wash_overdue} />
                                                </div>
                                                {fs.last_odometer != null && (
                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Gauge className="h-2.5 w-2.5" />
                                                        Last odometer: {fs.last_odometer.toLocaleString()} mi
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {/* Alerts */}
                                        {serviceDue && (
                                            <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-500/10 rounded-lg px-2 py-1 mb-2">
                                                <AlertTriangle className="h-3 w-3" /> Service overdue
                                            </div>
                                        )}
                                        {insuranceWarn && (
                                            <div className="flex items-center gap-1.5 text-xs text-orange-500 bg-orange-500/10 rounded-lg px-2 py-1 mb-2">
                                                <Shield className="h-3 w-3" /> Insurance expiring soon
                                            </div>
                                        )}
                                        <div className="flex gap-1 mt-2 flex-wrap">
                                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditVeh(v); setVehDialog(true); }}>
                                                <Pencil className="h-3 w-3" /> Edit
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditMaint(null); setMaintDialog(true); }}>
                                                <Wrench className="h-3 w-3" /> Log Service
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openHistory(v)}>
                                                <Eye className="h-3 w-3" /> Inspections
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs gap-1 text-blue-600"
                                                onClick={() => logCarWash(v)}
                                            >
                                                <Droplets className="h-3 w-3" /> Car Wash
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs gap-1"
                                                onClick={() => { setSelectedVehicleForInspection(v.id); setInspectionDialog(true); }}
                                            >
                                                <ClipboardCheck className="h-3 w-3" /> Inspect
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive" onClick={() => setDeleteTarget({ type: "vehicle", id: v.id })}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                        {vehicles.length === 0 && (
                            <div className="col-span-full text-center py-12 text-muted-foreground">
                                <Truck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                <p className="font-medium">No vehicles yet</p>
                                <p className="text-xs">Add your first vehicle to start tracking your fleet.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ──── MAINTENANCE TAB ──── */}
                <TabsContent value="maintenance" className="space-y-4">
                    <div className="flex justify-end">
                        <Button className="btn-gradient gap-2" onClick={() => { setEditMaint(null); setMaintDialog(true); }}>
                            <Plus className="h-4 w-4" /> Log Maintenance
                        </Button>
                    </div>
                    <Card className="glass-card rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead>Mileage</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead className="w-20">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {maintenance.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8}>
                                            <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                                                <Wrench className="h-10 w-10 opacity-30" />
                                                <p className="text-sm font-medium">No maintenance records yet</p>
                                                <p className="text-xs opacity-60">Log your first service record to start tracking vehicle health.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {maintenance.map((m) => (
                                    <TableRow key={m.id}>
                                        <TableCell className="text-sm">{m.service_date}</TableCell>
                                        <TableCell className="font-medium text-sm">{vehName(m.vehicle_id)}</TableCell>
                                        <TableCell><Badge variant="secondary" className="text-[10px]">{maintTypeLbl(m.maintenance_type)}</Badge></TableCell>
                                        <TableCell className="text-sm max-w-48 truncate">{m.description || "—"}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">{fmtMoney(Number(m.cost))}</TableCell>
                                        <TableCell className="font-mono text-xs">{m.mileage_at_service?.toLocaleString() ?? "—"}</TableCell>
                                        <TableCell className="text-sm">{m.vendor || "—"}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditMaint(m); setMaintDialog(true); }}><Pencil className="h-3 w-3" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ type: "maintenance", id: m.id })}><Trash2 className="h-3 w-3" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    </Card>
                </TabsContent>

                {/* ──── DRIVERS TAB ──── */}
                <TabsContent value="drivers" className="space-y-4">
                    <div className="flex justify-end">
                        <Button className="btn-gradient gap-2" onClick={() => { setEditDrv(null); setDrvDialog(true); }}>
                            <Plus className="h-4 w-4" /> Add Driver
                        </Button>
                    </div>
                    <Card className="glass-card rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Hub</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>License Exp.</TableHead>
                                    <TableHead className="text-right">Rate ($/hr)</TableHead>
                                    <TableHead>Hired</TableHead>
                                    <TableHead className="w-20">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {drivers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8}>
                                            <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                                                <Users className="h-10 w-10 opacity-30" />
                                                <p className="text-sm font-medium">No drivers yet</p>
                                                <p className="text-xs opacity-60">Add your first driver to start assigning loads and tracking shifts.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {drivers.map((d) => {
                                    const dBadge = drvStatusBadge(d.status);
                                    const licenseWarn = d.license_expiry && differenceInDays(new Date(d.license_expiry), new Date()) <= 30;
                                    return (
                                        <TableRow key={d.id} className={licenseWarn ? "bg-orange-500/5" : ""}>
                                            <TableCell className="font-medium">{d.full_name}</TableCell>
                                            <TableCell className="text-sm">{HUBS.find((h) => h.value === d.hub)?.label ?? d.hub}</TableCell>
                                            <TableCell className="text-sm">{d.phone || "—"}</TableCell>
                                            <TableCell><Badge className={`${dBadge.badge} text-[10px]`}>{dBadge.label}</Badge></TableCell>
                                            <TableCell className="text-sm">
                                                {d.license_expiry ? (
                                                    <span className={licenseWarn ? "text-orange-500 font-medium" : ""}>{d.license_expiry}{licenseWarn && " ⚠️"}</span>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">${d.hourly_rate}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{d.hired_date || "—"}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditDrv(d); setDrvDialog(true); }}><Pencil className="h-3 w-3" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ type: "driver", id: d.id })}><Trash2 className="h-3 w-3" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ═══ VEHICLE DIALOG ═══ */}
            <Dialog open={vehDialog} onOpenChange={(o) => { setVehDialog(o); if (!o) setEditVeh(null); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editVeh ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
                        <DialogDescription>Enter the vehicle details below.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleVehSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div><Label>Name *</Label><Input name="vehicle_name" required defaultValue={editVeh?.vehicle_name ?? ""} placeholder="CV-001" /></div>
                            <div><Label>Type</Label><Select name="vehicle_type" defaultValue={editVeh?.vehicle_type ?? "cargo_van"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VEHICLE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Hub</Label><Select name="hub" defaultValue={editVeh?.hub ?? "phoenix"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{HUBS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Make</Label><Input name="make" defaultValue={editVeh?.make ?? ""} placeholder="Ford" /></div>
                            <div><Label>Model</Label><Input name="model" defaultValue={editVeh?.model ?? ""} placeholder="Transit 250" /></div>
                            <div><Label>Year</Label><Input name="year" type="number" defaultValue={editVeh?.year ?? ""} placeholder="2024" /></div>
                            <div><Label>VIN</Label><Input name="vin" defaultValue={editVeh?.vin ?? ""} /></div>
                            <div><Label>License Plate</Label><Input name="license_plate" defaultValue={editVeh?.license_plate ?? ""} /></div>
                            <div><Label>Status</Label><Select name="status" defaultValue={editVeh?.status ?? "active"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VEHICLE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Current Mileage</Label><Input name="current_mileage" type="number" defaultValue={editVeh?.current_mileage ?? 0} /></div>
                            <div><Label>Next Service (mi)</Label><Input name="next_service_mileage" type="number" defaultValue={editVeh?.next_service_mileage ?? ""} /></div>
                            <div><Label>Next Service Date</Label><Input name="next_service_date" type="date" defaultValue={editVeh?.next_service_date ?? ""} /></div>
                            <div><Label>Insurance Expiry</Label><Input name="insurance_expiry" type="date" defaultValue={editVeh?.insurance_expiry ?? ""} /></div>
                            <div><Label>Registration Expiry</Label><Input name="registration_expiry" type="date" defaultValue={editVeh?.registration_expiry ?? ""} /></div>
                            <div><Label>Fuel Type</Label><Input name="fuel_type" defaultValue={editVeh?.fuel_type ?? "gasoline"} /></div>
                            <div><Label>Avg MPG</Label><Input name="avg_mpg" type="number" step="0.1" defaultValue={editVeh?.avg_mpg ?? ""} /></div>
                            <div><Label>Daily Rate ($)</Label><Input name="daily_rate" type="number" step="0.01" defaultValue={editVeh?.daily_rate ?? 0} /></div>
                        </div>
                        <div><Label>Notes</Label><Textarea name="notes" defaultValue={editVeh?.notes ?? ""} rows={2} /></div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setVehDialog(false); setEditVeh(null); }}>Cancel</Button>
                            <Button type="submit" className="btn-gradient">{editVeh ? "Save" : "Add Vehicle"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ═══ MAINTENANCE DIALOG ═══ */}
            <Dialog open={maintDialog} onOpenChange={(o) => { setMaintDialog(o); if (!o) setEditMaint(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editMaint ? "Edit Maintenance" : "Log Maintenance"}</DialogTitle>
                        <DialogDescription>Record a service or repair for a vehicle.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleMaintSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>Vehicle *</Label><Select name="vehicle_id" defaultValue={editMaint?.vehicle_id ?? ""}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicle_name}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Type *</Label><Select name="maintenance_type" defaultValue={editMaint?.maintenance_type ?? "oil_change"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MAINT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Service Date</Label><Input name="service_date" type="date" defaultValue={editMaint?.service_date ?? new Date().toISOString().split("T")[0]} /></div>
                            <div><Label>Cost ($)</Label><Input name="cost" type="number" step="0.01" defaultValue={editMaint?.cost ?? ""} /></div>
                            <div><Label>Mileage at Service</Label><Input name="mileage_at_service" type="number" defaultValue={editMaint?.mileage_at_service ?? ""} /></div>
                            <div><Label>Vendor</Label><Input name="vendor" defaultValue={editMaint?.vendor ?? ""} /></div>
                            <div><Label>Next Service Date</Label><Input name="next_service_date" type="date" defaultValue={editMaint?.next_service_date ?? ""} /></div>
                            <div><Label>Next Service (mi)</Label><Input name="next_service_mileage" type="number" defaultValue={editMaint?.next_service_mileage ?? ""} /></div>
                        </div>
                        <div><Label>Description</Label><Input name="description" defaultValue={editMaint?.description ?? ""} /></div>
                        <div><Label>Notes</Label><Textarea name="notes" defaultValue={editMaint?.notes ?? ""} rows={2} /></div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setMaintDialog(false); setEditMaint(null); }}>Cancel</Button>
                            <Button type="submit" className="btn-gradient">{editMaint ? "Save" : "Log Service"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ═══ DRIVER DIALOG ═══ */}
            <Dialog open={drvDialog} onOpenChange={(o) => { setDrvDialog(o); if (!o) setEditDrv(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editDrv ? "Edit Driver" : "Add Driver"}</DialogTitle>
                        <DialogDescription>Enter driver information.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleDrvSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>Full Name *</Label><Input name="full_name" required defaultValue={editDrv?.full_name ?? ""} /></div>
                            <div><Label>Phone</Label><Input name="phone" defaultValue={editDrv?.phone ?? ""} /></div>
                            <div><Label>Email</Label><Input name="email" type="email" defaultValue={editDrv?.email ?? ""} /></div>
                            <div><Label>Hub</Label><Select name="hub" defaultValue={editDrv?.hub ?? "phoenix"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{HUBS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Status</Label><Select name="status" defaultValue={editDrv?.status ?? "active"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DRIVER_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Hourly Rate ($)</Label><Input name="hourly_rate" type="number" step="0.01" defaultValue={editDrv?.hourly_rate ?? ""} /></div>
                            <div><Label>License #</Label><Input name="license_number" defaultValue={editDrv?.license_number ?? ""} /></div>
                            <div><Label>License Expiry</Label><Input name="license_expiry" type="date" defaultValue={editDrv?.license_expiry ?? ""} /></div>
                            <div><Label>Hired Date</Label><Input name="hired_date" type="date" defaultValue={editDrv?.hired_date ?? ""} /></div>
                        </div>
                        <div><Label>Notes</Label><Textarea name="notes" defaultValue={editDrv?.notes ?? ""} rows={2} /></div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setDrvDialog(false); setEditDrv(null); }}>Cancel</Button>
                            <Button type="submit" className="btn-gradient">{editDrv ? "Save" : "Add Driver"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ═══ INSPECTION FORM DIALOG ═══ */}
            <Dialog open={inspectionDialog} onOpenChange={setInspectionDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-blue-500" />
                            Walk-Around Inspection
                        </DialogTitle>
                        <DialogDescription>
                            Record daily vehicle inspection. Minimum 2 photos required.
                        </DialogDescription>
                    </DialogHeader>
                    <InspectionForm
                        vehicles={vehicles.map((v) => ({ id: v.id, vehicle_name: v.vehicle_name, license_plate: v.license_plate }))}
                        drivers={drivers.map((d) => ({ id: d.id, full_name: d.full_name }))}
                        defaultVehicleId={selectedVehicleForInspection}
                        onSuccess={() => {
                            setInspectionDialog(false);
                            refetchFleetStatus();
                        }}
                        onCancel={() => setInspectionDialog(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* ═══ INSPECTION HISTORY SLIDE-OVER ═══ */}
            <Sheet open={historySheet} onOpenChange={setHistorySheet}>
                <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-blue-500" />
                            {historyVehicle?.vehicle_name} — Inspection History
                        </SheetTitle>
                        <SheetDescription>
                            Last 30 days of walk-around inspections and odometer readings
                        </SheetDescription>
                    </SheetHeader>

                    {historyLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Odometer Trend */}
                            {odometerHistory.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <Gauge className="h-4 w-4 text-purple-500" /> Odometer Trend
                                    </h3>
                                    <div className="space-y-1">
                                        {odometerHistory.map((o, i) => {
                                            const prev = odometerHistory[i + 1];
                                            const diff = prev ? o.odometer_reading - prev.odometer_reading : null;
                                            return (
                                                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                                                    <div>
                                                        <span className="font-mono font-semibold">{o.odometer_reading.toLocaleString()} mi</span>
                                                        {o.driver_name && <span className="text-muted-foreground text-xs ml-2">— {o.driver_name}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {diff !== null && (
                                                            <span className={`text-xs flex items-center gap-0.5 ${diff >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                                {diff > 0 ? <ArrowUp className="h-3 w-3" /> : diff < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                                                {Math.abs(diff).toLocaleString()} mi
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-muted-foreground">{o.inspection_date}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Inspection Records */}
                            {inspectionHistory.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <ClipboardCheck className="h-4 w-4 text-blue-500" /> Inspection Records
                                    </h3>
                                    <div className="space-y-3">
                                        {inspectionHistory.map((insp) => (
                                            <div key={insp.id} className="rounded-xl border border-border/60 p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium">{insp.inspection_date}</span>
                                                        <InspectionBadge done={true} status={insp.status} />
                                                        {insp.car_wash_done && (
                                                            <Badge className="bg-blue-500/15 text-blue-700 text-[10px]">
                                                                <Droplets className="h-2.5 w-2.5 mr-0.5" /> Washed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {insp.status !== "flagged" && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 text-[10px] gap-1 text-red-600"
                                                                onClick={() => flagInspection(insp.id)}
                                                            >
                                                                <Flag className="h-2.5 w-2.5" /> Flag
                                                            </Button>
                                                        )}
                                                        {insp.status !== "approved" && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 text-[10px] gap-1 text-green-600"
                                                                onClick={() => approveInspection(insp.id)}
                                                            >
                                                                <CheckCircle className="h-2.5 w-2.5" /> Approve
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> {insp.odometer_reading.toLocaleString()} mi</span>
                                                    {insp.checklist.fuel_level && <span>⛽ {insp.checklist.fuel_level}</span>}
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {insp.checklist.tires_ok && <Badge variant="secondary" className="text-[9px] bg-green-500/10 text-green-700">Tires ✓</Badge>}
                                                    {insp.checklist.lights_ok && <Badge variant="secondary" className="text-[9px] bg-green-500/10 text-green-700">Lights ✓</Badge>}
                                                    {insp.checklist.brakes_ok && <Badge variant="secondary" className="text-[9px] bg-green-500/10 text-green-700">Brakes ✓</Badge>}
                                                    {insp.checklist.fluids_ok && <Badge variant="secondary" className="text-[9px] bg-green-500/10 text-green-700">Fluids ✓</Badge>}
                                                    {insp.checklist.interior_clean && <Badge variant="secondary" className="text-[9px] bg-green-500/10 text-green-700">Interior ✓</Badge>}
                                                    {insp.checklist.exterior_damage && <Badge variant="secondary" className="text-[9px] bg-orange-500/10 text-orange-700">Damage ⚠️</Badge>}
                                                </div>
                                                {insp.photos && insp.photos.length > 0 && (
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {insp.photos.map((url, pi) => (
                                                            <button
                                                                key={pi}
                                                                type="button"
                                                                onClick={() => setLightboxPhoto(url)}
                                                                className="h-12 w-12 rounded-md overflow-hidden border border-border/60 hover:opacity-80 transition-opacity"
                                                            >
                                                                <img src={url} alt={`Photo ${pi + 1}`} className="w-full h-full object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {insp.notes && (
                                                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-2 py-1.5 italic">
                                                        {insp.notes}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {inspectionHistory.length === 0 && odometerHistory.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground">
                                    <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                    <p className="font-medium text-sm">No inspections yet</p>
                                    <p className="text-xs">No walk-around inspections in the last 30 days.</p>
                                    <Button
                                        className="mt-3 btn-gradient gap-2 text-xs h-8"
                                        onClick={() => {
                                            setHistorySheet(false);
                                            setSelectedVehicleForInspection(historyVehicle?.id);
                                            setInspectionDialog(true);
                                        }}
                                    >
                                        <ClipboardCheck className="h-3.5 w-3.5" /> Start First Inspection
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* ═══ PHOTO LIGHTBOX ═══ */}
            {lightboxPhoto && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxPhoto(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors"
                        onClick={() => setLightboxPhoto(null)}
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <img
                        src={lightboxPhoto}
                        alt="Inspection photo"
                        className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteTarget && (
                <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Confirm Delete</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}