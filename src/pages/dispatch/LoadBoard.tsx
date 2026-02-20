import { fmtMoney, fmtWait } from "@/lib/formatters";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Truck, MapPin, Download, PanelRightClose, PanelRightOpen, Layers,
    ChevronRight, Package, RefreshCw, Pencil, Trash2, Copy, Zap, Radio,
    PlayCircle, PackageCheck, RotateCcw, CheckCircle, MoreHorizontal,
    ReceiptText, Plus, History, FileText,
} from "lucide-react";
import { X } from "lucide-react";
import { generateInvoice } from "@/lib/generateInvoice";
import { useToast } from "@/hooks/use-toast";
import { useUnreadMessageCounts } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import ETABadge from "@/components/ETABadge";
import LoadSearchFilters, {
    EMPTY_LOAD_FILTERS,
    type LoadFilters,
} from "@/components/LoadSearchFilters";
import QuickLoadEntry, { cloneLoadData } from "@/components/QuickLoadEntry";
import CSVImportPanel, { exportToCSV } from "@/components/CSVImportPanel";
import CustomerOrderHistory from "@/components/CustomerOrderHistory";
import ActivityLog from "@/components/ActivityLog";
import AutoDispatchPanel from "@/components/AutoDispatchPanel";
import DispatchBlastPanel from "@/components/DispatchBlast";
import type { Load, Driver } from "./types";
import { useState } from "react";

// --------------------Constants ======================================
const STATUSES = [
    { value: "pending", label: "Pending", color: "bg-slate-400", pill: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
    { value: "assigned", label: "Assigned", color: "bg-blue-500", pill: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    { value: "blasted", label: "Blasted", color: "bg-violet-500", pill: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
    { value: "in_progress", label: "In Transit", color: "bg-yellow-500", pill: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    { value: "arrived_pickup", label: "At Pickup", color: "bg-blue-400", pill: "bg-blue-400/15 text-blue-300 border-blue-400/30" },
    { value: "in_transit", label: "In Transit", color: "bg-yellow-500", pill: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    { value: "arrived_delivery", label: "At Delivery", color: "bg-purple-400", pill: "bg-purple-400/15 text-purple-300 border-purple-400/30" },
    { value: "delivered", label: "Delivered", color: "bg-green-500", pill: "bg-green-500/15 text-green-400 border-green-500/30" },
    { value: "completed", label: "Completed", color: "bg-green-600", pill: "bg-green-600/15 text-green-400 border-green-600/30" },
    { value: "cancelled", label: "Cancelled", color: "bg-slate-500", pill: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
    { value: "failed", label: "Failed", color: "bg-red-500", pill: "bg-red-500/15 text-red-400 border-red-500/30" },
];

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

interface LoadBoardProps {
    loads: Load[];                           // filtered + sorted board loads
    rawLoads: Load[];                        // unfiltered loads for the selected date
    drivers: Driver[];
    loading: boolean;
    selectedDate: string;
    onSelectedDateChange: (date: string) => void;
    secondsAgo: number;
    onLoadClick: (load: Load) => void;
    onStatusChange: (id: string, status: string) => void;
    onDelete: (id: string) => void;
    onEdit: (load: Load) => void;
    onSetBlastLoad: (load: Load) => void;
    filters: LoadFilters;
    onFiltersChange: (f: LoadFilters) => void;
    onRefetchLoads: () => void;
}

export default function LoadBoard({
    loads,
    rawLoads,
    drivers,
    selectedDate,
    onSelectedDateChange,
    secondsAgo,
    onLoadClick,
    onStatusChange,
    onDelete,
    onEdit,
    onSetBlastLoad,
    filters,
    onFiltersChange,
    onRefetchLoads,
}: LoadBoardProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { unreadMap } = useUnreadMessageCounts(user?.id ?? null);

    const [toolsOpen, setToolsOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<"quick" | "import" | "history" | "log" | "blast" | null>("quick");
    const [autoDispatchLoadId, setAutoDispatchLoadId] = useState<string | null>(null);
    const [clonePrefill, setClonePrefill] = useState<ReturnType<typeof cloneLoadData> | null>(null);

    const statusInfo = (s: string) => STATUSES.find((st) => st.value === s) ?? STATUSES[0];
    const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.full_name ?? "--";

    return (
        <>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap">Board Date</Label>
                    <Input type="date" className="w-36 h-8 text-xs" value={selectedDate} onChange={(e) => onSelectedDateChange(e.target.value)} />
                </div>
                <Badge variant="secondary" className="text-[10px] font-mono">{rawLoads.length} loads</Badge>
                {/* Last updated indicator */}
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 select-none">
                    <RefreshCw className="h-2.5 w-2.5" />
                    {secondsAgo < 10
                        ? "Just updated"
                        : secondsAgo < 60
                        ? `${secondsAgo}s ago`
                        : `${Math.floor(secondsAgo / 60)}m ago`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                        onClick={() => exportToCSV(loads.map(l => ({
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

            {/* == Search + Filter Bar == */}
            <LoadSearchFilters
                filters={filters}
                onFiltersChange={onFiltersChange}
                totalCount={rawLoads.length}
                filteredCount={loads.length}
                drivers={drivers.filter((d) => d.status === "active").map((d) => ({ id: d.id, full_name: d.full_name }))}
            />

            <div className={`grid gap-4 ${toolsOpen ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
                {/* Load Table */}
                <div className={toolsOpen ? "lg:col-span-2" : ""}>
                    <Card className="glass-card rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
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
                                {loads.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={12}>
                                            {rawLoads.length > 0 ? (
                                                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                                                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-1">
                                                        <Layers className="h-6 w-6 opacity-50" />
                                                    </div>
                                                    <p className="text-sm font-semibold text-foreground">No matches</p>
                                                    <p className="text-xs opacity-60">No loads match your active filters.</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => onFiltersChange(EMPTY_LOAD_FILTERS)}
                                                        className="gap-1.5 mt-2 h-8 text-xs"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                        Clear all filters
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                                                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-1">
                                                        <Package className="h-6 w-6 opacity-50" />
                                                    </div>
                                                    <p className="text-sm font-semibold text-foreground">No loads for {selectedDate}</p>
                                                    <p className="text-xs opacity-60">Open the Tools panel -> New to add the first load for this date.</p>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {loads.map((load) => {
                                    const si = statusInfo(load.status);
                                    return (
                                        <TableRow key={load.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => onLoadClick(load)}>
                                            <TableCell className="font-mono text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    {load.reference_number || "--"}
                                                    {unreadMap[load.id] > 0 && (
                                                        <span className="inline-flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] px-0.5">
                                                            {unreadMap[load.id] > 99 ? '99+' : unreadMap[load.id]}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="outline" className="text-[10px]">{load.shift === "day" ? "?? D?a" : "?? Noche"}</Badge></TableCell>
                                            <TableCell className="font-medium text-sm">{driverName(load.driver_id)}</TableCell>
                                            <TableCell className="text-sm">{load.client_name || "--"}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{load.description || "--"}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">{Number(load.miles).toFixed(0)}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">{Number(load.revenue) > 0 ? fmtMoney(Number(load.revenue)) : "--"}</TableCell>
                                            <TableCell>
                                                {load.wait_time_minutes > 0 ? (
                                                    <Badge className={`${waitBadgeClass(load.wait_time_minutes)} text-[10px]`}>
                                                        {fmtWait(load.wait_time_minutes)}
                                                        {load.wait_time_minutes >= DETENTION_THRESHOLD && " ??"}
                                                    </Badge>
                                                ) : <span className="text-muted-foreground text-xs">--</span>}
                                            </TableCell>
                                            <TableCell>
                                                <ETABadge
                                                    pickupAddress={load.pickup_address}
                                                    deliveryAddress={load.delivery_address}
                                                    slaDeadline={load.sla_deadline}
                                                    enabled={load.status === "in_progress"}
                                                    compact
                                                />
                                                {load.status !== "in_progress" && load.eta_status && load.eta_status !== "unknown" && (
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${load.eta_status === "on_time" ? "status-on-time" :
                                                        load.eta_status === "at_risk" ? "status-at-risk" :
                                                            load.eta_status === "late" ? "status-late" : "status-idle"
                                                        }`}>
                                                        {load.eta_status?.replace("_", " ")}
                                                    </span>
                                                )}
                                                {load.status !== "in_progress" && (!load.eta_status || load.eta_status === "unknown") && (
                                                    <span className="text-muted-foreground text-xs">--</span>
                                                )}
                                            </TableCell>
                                            {/* == Status cell: badge + next-action button == */}
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    {/* Status pill */}
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${si.pill ?? "bg-muted text-muted-foreground border-border"}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${si.color}`} />
                                                        {si.label}
                                                    </span>
                                                    {/* Next-action button */}
                                                    {load.status === "pending" && (
                                                        <Button size="sm" variant="outline"
                                                            className="h-6 text-[10px] px-2 gap-1 border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
                                                            onClick={() => onStatusChange(load.id, "assigned")}>
                                                            <PlayCircle className="h-3 w-3" /> Assign
                                                        </Button>
                                                    )}
                                                    {load.status === "assigned" && (
                                                        <Button size="sm" variant="outline"
                                                            className="h-6 text-[10px] px-2 gap-1 border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10"
                                                            onClick={() => onStatusChange(load.id, "in_progress")}>
                                                            <Truck className="h-3 w-3" /> Picked Up
                                                        </Button>
                                                    )}
                                                    {load.status === "blasted" && (
                                                        <Button size="sm" variant="outline"
                                                            className="h-6 text-[10px] px-2 gap-1 border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10"
                                                            onClick={() => onStatusChange(load.id, "in_progress")}>
                                                            <Truck className="h-3 w-3" /> Picked Up
                                                        </Button>
                                                    )}
                                                    {load.status === "in_progress" && (
                                                        <Button size="sm" variant="outline"
                                                            className="h-6 text-[10px] px-2 gap-1 border-green-500/40 text-green-600 hover:bg-green-500/10"
                                                            onClick={() => onStatusChange(load.id, "delivered")}>
                                                            <PackageCheck className="h-3 w-3" /> Delivered
                                                        </Button>
                                                    )}
                                                    {load.status === "arrived_pickup" && (
                                                        <Badge className="bg-blue-500/15 text-blue-500 border-0 text-[9px] h-5 px-1.5">
                                                            <MapPin className="h-2.5 w-2.5 mr-0.5" /> At Pickup
                                                        </Badge>
                                                    )}
                                                    {load.status === "arrived_delivery" && (
                                                        <Badge className="bg-purple-500/15 text-purple-500 border-0 text-[9px] h-5 px-1.5">
                                                            <MapPin className="h-2.5 w-2.5 mr-0.5" /> At Delivery
                                                        </Badge>
                                                    )}
                                                    {(load.status === "delivered" || load.status === "completed") && (
                                                        <Badge className="bg-green-500/15 text-green-600 border-0 text-[9px] h-5 px-1.5">
                                                            <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Done
                                                        </Badge>
                                                    )}
                                                    {(load.status === "failed" || load.status === "cancelled") && (
                                                        <Button size="sm" variant="outline"
                                                            className="h-6 text-[10px] px-2 gap-1 border-gray-400/40 text-gray-500 hover:bg-gray-500/10"
                                                            onClick={() => onStatusChange(load.id, "pending")}>
                                                            <RotateCcw className="h-3 w-3" /> Reopen
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {load.start_time && load.end_time ? `${load.start_time}--${load.end_time}` : load.start_time || "--"}
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(load); }}>
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Clone load"
                                                        onClick={(e) => { e.stopPropagation(); setClonePrefill(cloneLoadData(load)); setActiveTool("quick"); setToolsOpen(true); toast({ title: "?? Load cloned", description: "Edit and save the cloned load" }); }}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                    {!load.driver_id && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" title="Auto-assign"
                                                                onClick={(e) => { e.stopPropagation(); setAutoDispatchLoadId(load.id); setToolsOpen(true); setActiveTool(null); }}>
                                                                <Zap className="h-3 w-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Blast to drivers"
                                                                onClick={(e) => { e.stopPropagation(); onSetBlastLoad(load); }}>
                                                                <Radio className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {/* (...) Quick status dropdown */}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Change status">
                                                                <MoreHorizontal className="h-3 w-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-44">
                                                            {(load.status === "completed" || load.status === "delivered") && (
                                                                <>
                                                                    <DropdownMenuItem
                                                                        className="text-xs gap-2 text-emerald-600 font-semibold"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            generateInvoice(
                                                                                {
                                                                                    id: load.id,
                                                                                    reference_number: load.reference_number,
                                                                                    client_name: load.client_name,
                                                                                    pickup_address: load.pickup_address,
                                                                                    delivery_address: load.delivery_address,
                                                                                    pickup_company: load.pickup_company ?? null,
                                                                                    delivery_company: load.delivery_company ?? null,
                                                                                    revenue: Number(load.revenue),
                                                                                    packages: load.packages,
                                                                                    weight_kg: (load as any).weight_kg ?? null,
                                                                                    weight_lbs: load.weight_lbs ?? null,
                                                                                    package_type: (load as any).package_type ?? null,
                                                                                    service_type: load.service_type,
                                                                                    actual_pickup: load.actual_pickup ?? null,
                                                                                    actual_delivery: load.actual_delivery ?? null,
                                                                                    load_date: load.load_date,
                                                                                    miles: Number(load.miles),
                                                                                    hub: load.hub,
                                                                                },
                                                                                driverName(load.driver_id),
                                                                            );
                                                                            toast({ title: "?? Invoice generated", description: `ANIKA-INV-${load.reference_number || load.id.slice(0, 8)} downloaded` });
                                                                        }}
                                                                    >
                                                                        <ReceiptText className="h-3.5 w-3.5" />
                                                                        Generate Invoice
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                </>
                                                            )}
                                                            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                                                Change Status
                                                            </div>
                                                            <DropdownMenuSeparator />
                                                            {STATUSES.map((s) => (
                                                                <DropdownMenuItem
                                                                    key={s.value}
                                                                    className={`text-xs gap-2 ${load.status === s.value ? "bg-muted/50 font-semibold" : ""}`}
                                                                    onClick={() => onStatusChange(load.id, s.value)}
                                                                >
                                                                    <span className={`h-2 w-2 rounded-full shrink-0 ${s.color}`} />
                                                                    {s.label}
                                                                    {load.status === s.value && <span className="ml-auto text-[9px] text-muted-foreground">current</span>}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(load.id); }}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onLoadClick(load); }}>
                                                        <ChevronRight className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        </div>
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
                                loadPickupAddress={loads.find(l => l.id === autoDispatchLoadId)?.pickup_address}
                                loadHub={loads.find(l => l.id === autoDispatchLoadId)?.hub}
                                onAssigned={() => { onRefetchLoads(); setAutoDispatchLoadId(null); }}
                                onClose={() => setAutoDispatchLoadId(null)}
                            />
                        )}

                        {activeTool === "quick" && (
                            <QuickLoadEntry
                                loadDate={selectedDate}
                                hub={loads[0]?.hub}
                                drivers={drivers.filter(d => d.status === "active").map(d => ({ id: d.id, full_name: d.full_name }))}
                                onLoadCreated={onRefetchLoads}
                                prefill={clonePrefill ?? undefined}
                            />
                        )}

                        {activeTool === "import" && (
                            <CSVImportPanel
                                loadDate={selectedDate}
                                hub={loads[0]?.hub}
                                onImportComplete={() => onRefetchLoads()}
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
                                loads={loads.map(l => ({
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
                                onLoadAssigned={() => onRefetchLoads()}
                            />
                        )}

                        {activeTool === "log" && (
                            <ActivityLog compact />
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export default function LoadBoardPage() {
  return (
    <ErrorBoundary>
      <LoadBoard />
    </ErrorBoundary>
  );
}
