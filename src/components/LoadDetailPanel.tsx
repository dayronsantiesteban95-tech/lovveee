/**
 * ═══════════════════════════════════════════════════════════
 * LoadDetailPanel — Premium slide-over for load inspection
 *
 * Shows all OnTime-parity fields organized in sections:
 *   • Header (status, ref#, service type)
 *   • Shipper / Client details
 *   • Addresses + company names
 *   • Timing (collection, delivery windows, ETA)
 *   • Package / cargo details
 *   • Financials
 *   • Route data
 *   • Comments / notes
 * ═══════════════════════════════════════════════════════════
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    X, MapPin, Clock, Package, DollarSign, Truck, FileText, Route,
    AlertTriangle, CheckCircle2, Timer, Copy, ExternalLink, Navigation,
    Building2, User, Hash, Ruler, Weight, Gauge, History,
} from "lucide-react";
import StatusTimeline from "@/components/StatusTimeline";
import ETASection from "@/components/ETASection";
import { fmtMoney, fmtWait } from "@/lib/formatters";

// ─── Types ──────────────────────────────────────────
export interface LoadDetail {
    id: string;
    load_date: string;
    reference_number: string | null;
    dispatcher_id: string | null;
    driver_id: string | null;
    vehicle_id: string | null;
    shift: string;
    hub: string;
    client_name: string | null;
    pickup_address: string | null;
    delivery_address: string | null;
    miles: number;
    deadhead_miles: number;
    start_time: string | null;
    end_time: string | null;
    wait_time_minutes: number;
    revenue: number;
    driver_pay: number;
    fuel_cost: number;
    status: string;
    detention_eligible: boolean;
    detention_billed: number;
    service_type: string;
    packages: number;
    weight_lbs: number | null;
    comments: string | null;
    pod_confirmed: boolean;
    created_at: string;
    updated_at: string;
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
}

interface LoadDetailPanelProps {
    load: LoadDetail;
    driverName: string;
    vehicleName: string;
    dispatcherName: string;
    onClose: () => void;
    onStatusChange: (id: string, status: string) => void;
    onEdit: (load: LoadDetail) => void;
    onRefresh: () => void;
}

// ─── Helpers ─────────────────────────────────────────

const STATUSES = [
    { value: "pending", label: "Pending", color: "bg-gray-500" },
    { value: "assigned", label: "Assigned", color: "bg-blue-500" },
    { value: "blasted", label: "Blasted", color: "bg-violet-500" },
    { value: "in_progress", label: "In Transit", color: "bg-yellow-500" },
    { value: "delivered", label: "Delivered", color: "bg-green-500" },
    { value: "completed", label: "Completed", color: "bg-green-600" },
    { value: "cancelled", label: "Cancelled", color: "bg-gray-500" },
    { value: "failed", label: "Failed", color: "bg-red-500" },
];

function EtaBadge({ status }: { status: string | null | undefined }) {
    if (!status || status === "unknown") return null;
    const configs: Record<string, { label: string; className: string }> = {
        on_time: { label: "On Time", className: "status-on-time" },
        at_risk: { label: "At Risk", className: "status-at-risk" },
        late: { label: "Late", className: "status-late" },
    };
    const c = configs[status] ?? { label: status, className: "status-idle" };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${c.className}`}>
            {status === "late" && <AlertTriangle className="h-3 w-3" />}
            {status === "on_time" && <CheckCircle2 className="h-3 w-3" />}
            {c.label}
        </span>
    );
}

function fmtTimestamp(ts: string | null | undefined): string {
    if (!ts) return "—";
    try {
        return new Date(ts).toLocaleString("en-US", {
            month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit",
        });
    } catch { return "—"; }
}

function fmtDuration(seconds: number | null | undefined): string {
    if (!seconds) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDistance(meters: number | null | undefined): string {
    if (!meters) return "—";
    return `${(meters / 1609.34).toFixed(1)} mi`;
}

// ─── Section helper ──────────────────────────────────

function Section({ title, icon: Icon, children, accentColor = "bg-primary" }: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    accentColor?: string;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${accentColor}`} />
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</span>
            </div>
            <div className="pl-4 border-l border-border/30 space-y-1.5">
                {children}
            </div>
        </div>
    );
}

function Field({ label, value, mono = false, className = "" }: {
    label: string;
    value: React.ReactNode;
    mono?: boolean;
    className?: string;
}) {
    return (
        <div className={`flex items-start justify-between gap-4 py-1 ${className}`}>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</span>
            <span className={`text-[11px] text-foreground text-right ${mono ? "text-data" : ""}`}>{value || "—"}</span>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function LoadDetailPanel({
    load,
    driverName,
    vehicleName,
    dispatcherName,
    onClose,
    onStatusChange,
    onEdit,
    onRefresh,
}: LoadDetailPanelProps) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);

    const profit = Number(load.revenue) - Number(load.driver_pay) - Number(load.fuel_cost);
    const margin = Number(load.revenue) > 0 ? (profit / Number(load.revenue) * 100) : 0;
    const statusCfg = STATUSES.find(s => s.value === load.status) ?? STATUSES[0];

    const copyRef = () => {
        const ref = load.reference_number || load.id.slice(0, 8);
        navigator.clipboard.writeText(ref);
        toast({ title: "Copied", description: ref });
    };

    // Quick field update
    const quickUpdate = useCallback(async (field: string, value: any) => {
        setSaving(true);
        const { error } = await (supabase as any)
            .from("daily_loads")
            .update({ [field]: value, updated_at: new Date().toISOString() })
            .eq("id", load.id);
        setSaving(false);
        if (error) {
            toast({ title: "Update failed", description: error.message, variant: "destructive" });
        } else {
            onRefresh();
        }
    }, [load.id, toast, onRefresh]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Panel */}
            <div
                className="relative w-full max-w-lg h-full overflow-y-auto sleek-scroll animate-in-right"
                style={{
                    background: "hsl(var(--cos-glass-bg))",
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                    borderLeft: "1px solid hsl(var(--cos-glass-border))",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ────── Header ────── */}
                <div className="sticky top-0 z-10 p-4 space-y-3"
                    style={{
                        background: "hsl(var(--cos-glass-bg))",
                        backdropFilter: "blur(16px)",
                        borderBottom: "1px solid hsl(var(--border) / 0.3)",
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-data text-sm font-bold text-foreground">
                                {load.reference_number || "No Ref"}
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyRef}>
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Status selector */}
                        <Select value={load.status} onValueChange={(v) => onStatusChange(load.id, v)}>
                            <SelectTrigger className="h-7 w-32 text-[10px]">
                                <div className="flex items-center gap-1.5">
                                    <span className={`h-2 w-2 rounded-full ${statusCfg.color}`} />
                                    <SelectValue />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((s) => (
                                    <SelectItem key={s.value} value={s.value} className="text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`h-2 w-2 rounded-full ${s.color}`} />
                                            {s.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <EtaBadge status={load.eta_status} />

                        <Badge variant="outline" className="text-[10px]">
                            {load.service_type?.replace(/_/g, " ") ?? "standard"}
                        </Badge>

                        {load.pod_confirmed && (
                            <Badge className="bg-emerald-500/15 text-emerald-500 border-0 text-[10px]">
                                POD ✓
                            </Badge>
                        )}

                        {load.detention_eligible && (
                            <Badge className="bg-orange-500/15 text-orange-500 border-0 text-[10px]">
                                ⚠ Detention
                            </Badge>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 flex-1" onClick={() => onEdit(load)}>
                            <FileText className="h-3 w-3" /> Edit Full Record
                        </Button>
                    </div>
                </div>

                {/* ────── Content ────── */}
                <div className="p-4 space-y-5">
                    {/* Shipper / Client */}
                    <Section title="Client & Shipper" icon={Building2} accentColor="bg-blue-500">
                        <Field label="Client" value={load.client_name} />
                        <Field label="Shipper" value={load.shipper_name} />
                        <Field label="Requested By" value={load.requested_by} />
                    </Section>

                    {/* Addresses */}
                    <Section title="Route" icon={MapPin} accentColor="bg-green-500">
                        <Field label="Pickup Company" value={load.pickup_company} />
                        <Field label="Pickup Address" value={load.pickup_address} />
                        <Field label="Delivery Company" value={load.delivery_company} />
                        <Field label="Delivery Address" value={load.delivery_address} />
                        <Field label="Distance" value={load.route_distance_meters ? fmtDistance(load.route_distance_meters) : `${Number(load.miles).toFixed(0)} mi`} mono />
                        <Field label="Est. Drive Time" value={fmtDuration(load.route_duration_seconds)} mono />
                        <Field label="Deadhead" value={`${Number(load.deadhead_miles).toFixed(0)} mi`} mono />
                    </Section>

                    {/* Timing */}
                    <Section title="Timing & ETA" icon={Clock} accentColor="bg-amber-500">
                        {/* Live ETA (in_progress only) */}
                        {load.status === "in_progress" && (
                            <ETASection
                                pickupAddress={load.pickup_address}
                                deliveryAddress={load.delivery_address}
                                slaDeadline={load.sla_deadline}
                                enabled={load.status === "in_progress"}
                            />
                        )}
                        <Field label="Collection Window" value={fmtTimestamp(load.collection_time)} />
                        <Field label="Delivery Window" value={fmtTimestamp(load.delivery_time)} />
                        <Field label="SLA Deadline" value={fmtTimestamp(load.sla_deadline)} />
                        <div className="h-px bg-border/20 my-1" />
                        <Field label="Est. Pickup" value={fmtTimestamp(load.estimated_pickup)} />
                        <Field label="Actual Pickup" value={fmtTimestamp(load.actual_pickup)} />
                        <Field label="Est. Delivery" value={fmtTimestamp(load.estimated_delivery)} />
                        <Field label="Actual Delivery" value={fmtTimestamp(load.actual_delivery)} />
                        <Field label="Current ETA" value={
                            <span className="flex items-center gap-1.5">
                                {fmtTimestamp(load.current_eta)}
                                <EtaBadge status={load.eta_status} />
                            </span>
                        } />
                        <div className="h-px bg-border/20 my-1" />
                        <Field label="Start Time" value={load.start_time || "—"} mono />
                        <Field label="End Time" value={load.end_time || "—"} mono />
                        <Field label="Wait Time" value={
                            load.wait_time_minutes > 0 ? (
                                <span className={load.wait_time_minutes >= 30 ? "text-red-400 font-semibold" : load.wait_time_minutes >= 15 ? "text-amber-400" : "text-green-400"}>
                                    {fmtWait(load.wait_time_minutes)}
                                    {load.wait_time_minutes >= 30 && " ⚠"}
                                </span>
                            ) : "—"
                        } />
                    </Section>

                    {/* Package / Cargo */}
                    <Section title="Cargo Details" icon={Package} accentColor="bg-violet-500">
                        <Field label="Description" value={load.description} />
                        <Field label="Packages" value={load.packages} mono />
                        <Field label="Weight" value={load.weight_lbs ? `${load.weight_lbs} lbs` : null} mono />
                        <Field label="Dimensions" value={load.dimensions_text} mono />
                        <Field label="Vehicle Required" value={load.vehicle_required} />
                    </Section>

                    {/* Tracking */}
                    <Section title="Tracking Numbers" icon={Hash} accentColor="bg-cyan-500">
                        <Field label="PO Number" value={load.po_number} mono />
                        <Field label="Inbound Tracking" value={load.inbound_tracking} mono />
                        <Field label="Outbound Tracking" value={load.outbound_tracking} mono />
                    </Section>

                    {/* Assignment */}
                    <Section title="Assignment" icon={User} accentColor="bg-indigo-500">
                        <Field label="Driver" value={driverName} />
                        <Field label="Vehicle" value={vehicleName} />
                        <Field label="Dispatcher" value={dispatcherName} />
                        <Field label="Hub" value={load.hub?.replace(/_/g, " ")} />
                        <Field label="Shift" value={load.shift === "day" ? "☀️ Day" : "🌙 Night"} />
                    </Section>

                    {/* Financials */}
                    <Section title="Financials" icon={DollarSign} accentColor="bg-emerald-500">
                        <Field label="Revenue" value={fmtMoney(Number(load.revenue))} mono />
                        <Field label="Driver Pay" value={fmtMoney(Number(load.driver_pay))} mono />
                        <Field label="Fuel Cost" value={fmtMoney(Number(load.fuel_cost))} mono />
                        <div className="h-px bg-border/20 my-1" />
                        <Field label="Profit" value={
                            <span className={profit >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                                {fmtMoney(profit)}
                            </span>
                        } mono />
                        <Field label="Margin" value={`${margin.toFixed(1)}%`} mono />
                        {load.detention_eligible && (
                            <>
                                <div className="h-px bg-border/20 my-1" />
                                <Field label="Detention Billed" value={
                                    load.detention_billed > 0
                                        ? fmtMoney(Number(load.detention_billed))
                                        : <span className="text-red-400 text-[10px]">Not billed</span>
                                } mono />
                            </>
                        )}
                    </Section>

                    {/* Comments */}
                    {load.comments && (
                        <Section title="Notes" icon={FileText} accentColor="bg-gray-500">
                            <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                {load.comments}
                            </p>
                        </Section>
                    )}

                    {/* Status Timeline */}
                    <Section title="Status History" icon={History} accentColor="bg-primary">
                        <StatusTimeline loadId={load.id} />
                    </Section>

                    {/* Metadata footer */}
                    <div className="pt-4 border-t border-border/20 space-y-1">
                        <Field label="Created" value={fmtTimestamp(load.created_at)} className="text-muted-foreground/60" />
                        <Field label="Updated" value={fmtTimestamp(load.updated_at)} className="text-muted-foreground/60" />
                        <Field label="ID" value={<span className="text-data text-[9px]">{load.id}</span>} />
                    </div>
                </div>
            </div>
        </div>
    );
}
