// ═══════════════════════════════════════════════════════════
// FLEET TRACKER — Vehicle & Equipment Management
// Tab 1: Vehicles     — CRUD + status + mileage tracking
// Tab 2: Maintenance  — Service records & upcoming alerts
// Tab 3: Drivers      — Driver roster management
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from "react";
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
    Truck, Plus, Pencil, Trash2, Wrench, Users, AlertTriangle,
    CheckCircle, Gauge, Calendar, Shield, Fuel,
} from "lucide-react";
import { differenceInDays } from "date-fns";

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

// ─── Constants ──────────────────────────────────────
const VEHICLE_TYPES = [
    { value: "cargo_van", label: "Cargo Van" },
    { value: "box_truck", label: "Box Truck" },
    { value: "sprinter", label: "Sprinter" },
    { value: "flatbed", label: "Flatbed" },
    { value: "pickup", label: "Pickup" },
];
const VEHICLE_STATUSES = [
    { value: "active", label: "Active", color: "bg-green-500", badge: "bg-green-500/15 text-green-700 dark:text-green-400" },
    { value: "maintenance", label: "In Maintenance", color: "bg-yellow-500", badge: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    { value: "retired", label: "Retired", color: "bg-gray-500", badge: "bg-gray-500/15 text-gray-700 dark:text-gray-400" },
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

// ═══════════════════════════════════════════════════════════
export default function FleetTracker() {
    const { user } = useAuth();
    const { toast } = useToast();
    const db = supabase;

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialogs
    const [vehDialog, setVehDialog] = useState(false);
    const [editVeh, setEditVeh] = useState<Vehicle | null>(null);
    const [maintDialog, setMaintDialog] = useState(false);
    const [editMaint, setEditMaint] = useState<MaintenanceRecord | null>(null);
    const [drvDialog, setDrvDialog] = useState(false);
    const [editDrv, setEditDrv] = useState<Driver | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

    // ── Fetch ────────────────────────────────
    const fetchAll = useCallback(async () => {
        const [v, m, d] = await Promise.all([
            db.from("vehicles").select("*").order("vehicle_name"),
            db.from("vehicle_maintenance").select("*").order("service_date", { ascending: false }),
            db.from("drivers").select("*").order("full_name"),
        ]);
        if (v.data) setVehicles(v.data);
        if (m.data) setMaintenance(m.data);
        if (d.data) setDrivers(d.data);
        setLoading(false);
    }, []);

    useEffect(() => { if (user) fetchAll(); }, [user, fetchAll]);

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

    // ── Vehicle CRUD ─────────────────────────
    const handleVehSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const vName = fd.get("vehicle_name") as string;
        const vType = fd.get("vehicle_type") as string || "cargo_van";
        const plateFd = (fd.get("license_plate") as string) || "N/A";
        const payload = {
            // Canonical UI columns
            vehicle_name: vName,
            vehicle_type: vType,
            license_plate: plateFd !== "N/A" ? plateFd : null,
            // Legacy NOT NULL columns (kept in sync)
            name: vName,
            type: vType,
            plate_number: plateFd,
            make: fd.get("make") as string || null,
            model: fd.get("model") as string || null,
            year: Number(fd.get("year")) || null,
            vin: fd.get("vin") as string || null,
            hub: fd.get("hub") as string || "phoenix",
            status: fd.get("status") as string || "active",
            current_mileage: Number(fd.get("current_mileage")) || 0,
            next_service_mileage: Number(fd.get("next_service_mileage")) || null,
            next_service_date: fd.get("next_service_date") as string || null,
            insurance_expiry: fd.get("insurance_expiry") as string || null,
            registration_expiry: fd.get("registration_expiry") as string || null,
            fuel_type: fd.get("fuel_type") as string || "gasoline",
            avg_mpg: Number(fd.get("avg_mpg")) || null,
            daily_rate: Number(fd.get("daily_rate")) || 0,
            notes: fd.get("notes") as string || null,
            updated_at: new Date().toISOString(),
            ...(editVeh ? {} : { created_by: user!.id }),
        };
        const { error } = editVeh
            ? await db.from("vehicles").update(payload).eq("id", editVeh.id)
            : await db.from("vehicles").insert(payload);
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: editVeh ? "Vehicle updated" : "Vehicle added" }); setVehDialog(false); setEditVeh(null); fetchAll(); }
    };

    // ── Maintenance CRUD ─────────────────────
    const handleMaintSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            vehicle_id: (fd.get("vehicle_id") as string) || null,
            maintenance_type: fd.get("maintenance_type") as string,
            description: fd.get("description") as string || null,
            cost: Number(fd.get("cost")) || 0,
            mileage_at_service: Number(fd.get("mileage_at_service")) || null,
            service_date: fd.get("service_date") as string || new Date().toISOString().split("T")[0],
            next_service_date: fd.get("next_service_date") as string || null,
            next_service_mileage: Number(fd.get("next_service_mileage")) || null,
            vendor: fd.get("vendor") as string || null,
            notes: fd.get("notes") as string || null,
            ...(editMaint ? {} : { created_by: user!.id }),
        };
        const { error } = editMaint
            ? await db.from("vehicle_maintenance").update(payload).eq("id", editMaint.id)
            : await db.from("vehicle_maintenance").insert(payload);
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: editMaint ? "Record updated" : "Maintenance logged" }); setMaintDialog(false); setEditMaint(null); fetchAll(); }
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
        else { toast({ title: editDrv ? "Driver updated" : "Driver added" }); setDrvDialog(false); setEditDrv(null); fetchAll(); }
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
            fetchAll();
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

            {/* TABS */}
            <Tabs defaultValue="vehicles" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="vehicles" className="gap-1.5"><Truck className="h-3.5 w-3.5" /> Vehicles ({vehicles.length})</TabsTrigger>
                    <TabsTrigger value="maintenance" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Maintenance ({maintenance.length})</TabsTrigger>
                    <TabsTrigger value="drivers" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Drivers ({drivers.length})</TabsTrigger>
                </TabsList>

                {/* ──── VEHICLES TAB ──── */}
                <TabsContent value="vehicles" className="space-y-4">
                    <div className="flex justify-end">
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
                                        <div className="flex gap-1 mt-2">
                                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditVeh(v); setVehDialog(true); }}>
                                                <Pencil className="h-3 w-3" /> Edit
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditMaint(null); setMaintDialog(true); }}>
                                                <Wrench className="h-3 w-3" /> Log Service
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
