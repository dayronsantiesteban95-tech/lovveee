/**
 * -----------------------------------------------------------
 * DispatchBlast -- Load Broadcasting System
 *
 * The dispatcher's "blast button" -- select a load, pick drivers,
 * and broadcast availability. Drivers express interest,
 * dispatcher confirms the assignment.
 *
 * Rule: Dispatcher assigns all loads. Blast = availability check.
 * -----------------------------------------------------------
 */
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Radio, Send, Zap, Users, CheckCircle2, XCircle,
    Clock, Eye, AlertTriangle, Loader2, ChevronDown,
    ChevronUp, MapPin, DollarSign, Package, Truck,
    Ban, RotateCw, Signal, Timer,
} from "lucide-react";
import {
    useDispatchBlast,
    type DispatchBlast as BlastType,
    type BlastWithResponses,
    type BlastPriority,
} from "@/hooks/useDispatchBlast";

// --- Types ---------------------------------------------

interface Driver {
    id: string;
    full_name: string;
    hub: string;
    status: string;
    phone?: string;
}

interface Load {
    id: string;
    reference_number: string | null;
    client_name: string | null;
    pickup_address: string | null;
    delivery_address: string | null;
    miles: number;
    revenue: number;
    packages: number;
    status: string;
    hub: string;
    service_type: string;
}

interface DispatchBlastPanelProps {
    loads: Load[];
    drivers: Driver[];
    selectedLoadId?: string | null;
    compact?: boolean;
    onLoadAssigned?: (loadId: string, driverId: string) => void;
}

// --- Priority config -----------------------------------

const PRIORITY_CONFIG: Record<BlastPriority, { label: string; color: string; icon: string; defaultMinutes: number }> = {
    low: { label: "Low", color: "bg-slate-500/15 text-slate-600 border-slate-500/20", icon: "--", defaultMinutes: 60 },
    normal: { label: "Normal", color: "bg-blue-500/15 text-blue-600 border-blue-500/20", icon: "--", defaultMinutes: 30 },
    high: { label: "High", color: "bg-orange-500/15 text-orange-600 border-orange-500/20", icon: "--", defaultMinutes: 15 },
    urgent: { label: "URGENT", color: "bg-red-500/15 text-red-600 border-red-500/20", icon: "--", defaultMinutes: 5 },
};

// --- Component -----------------------------------------

export default function DispatchBlastPanel({
    loads,
    drivers,
    selectedLoadId,
    compact = false,
    onLoadAssigned,
}: DispatchBlastPanelProps) {
    const { blasts, loading, analytics, createBlast, cancelBlast, confirmAssignment, refresh } = useDispatchBlast();

    // -- Form state ------------------------------
    const [selectedLoad, setSelectedLoad] = useState<string>(selectedLoadId ?? "");
    const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState("");
    const [priority, setPriority] = useState<BlastPriority>("normal");
    const [expiryMinutes, setExpiryMinutes] = useState(30);
    const [sending, setSending] = useState(false);

    // -- UI state --------------------------------
    const [showCreate, setShowCreate] = useState(!compact);
    const [expandedBlast, setExpandedBlast] = useState<string | null>(null);

    // Update selected load when prop changes
    useEffect(() => {
        if (selectedLoadId) setSelectedLoad(selectedLoadId);
    }, [selectedLoadId]);

    // Update expiry when priority changes
    useEffect(() => {
        setExpiryMinutes(PRIORITY_CONFIG[priority].defaultMinutes);
    }, [priority]);

    // -- Eligible loads (unassigned / not already blasted) --
    const eligibleLoads = useMemo(
        () => loads.filter((l) => ["assigned", "pending", "unassigned"].includes(l.status) || l.id === selectedLoad),
        [loads, selectedLoad],
    );

    const currentLoad = useMemo(
        () => loads.find((l) => l.id === selectedLoad),
        [loads, selectedLoad],
    );

    // -- Filter drivers by hub -------------------
    const hubDrivers = useMemo(() => {
        if (!currentLoad) return drivers.filter((d) => d.status === "active");
        return drivers.filter(
            (d) => d.status === "active" && (d.hub === currentLoad.hub || d.hub === "any"),
        );
    }, [drivers, currentLoad]);

    const otherDrivers = useMemo(
        () => drivers.filter((d) => d.status === "active" && !hubDrivers.includes(d)),
        [drivers, hubDrivers],
    );

    // -- Driver selection ------------------------
    const toggleDriver = (id: string) => {
        setSelectedDrivers((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAllHub = () => {
        setSelectedDrivers(new Set(hubDrivers.map((d) => d.id)));
    };

    const selectAll = () => {
        setSelectedDrivers(new Set([...hubDrivers, ...otherDrivers].map((d) => d.id)));
    };

    const clearSelection = () => setSelectedDrivers(new Set());

    // -- Send blast ------------------------------
    const handleBlast = async () => {
        if (!selectedLoad || selectedDrivers.size === 0) return;
        setSending(true);

        const blast = await createBlast({
            loadId: selectedLoad,
            hub: currentLoad?.hub ?? "phoenix",
            driverIds: Array.from(selectedDrivers),
            message: message.trim() || undefined,
            priority,
            expiresInMinutes: expiryMinutes,
        });

        if (blast) {
            setSelectedDrivers(new Set());
            setMessage("");
            setSelectedLoad("");
            setShowCreate(false);
        }
        setSending(false);
    };

    // -- Active blasts for the selected load -----
    const loadBlasts = useMemo(
        () => blasts.filter((b) => b.load_id === selectedLoad && b.status === "active"),
        [blasts, selectedLoad],
    );

    // -- Render ----------------------------------

    return (
        <div className="space-y-4">
            {/* -- Header with stats ------------------- */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    Dispatch Blast
                    {analytics.activeBlasts > 0 && (
                        <Badge className="bg-green-500/15 text-green-600 text-[10px] px-1.5 py-0 animate-pulse">
                            {analytics.activeBlasts} LIVE
                        </Badge>
                    )}
                </h3>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={refresh}
                    >
                        <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant={showCreate ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setShowCreate(!showCreate)}
                    >
                        <Send className="h-3 w-3" />
                        New Blast
                    </Button>
                </div>
            </div>

            {/* -- Quick Stats ------------------------ */}
            {!compact && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
                        <div className="text-lg font-bold text-primary">{analytics.activeBlasts}</div>
                        <div className="text-[10px] text-muted-foreground">Active</div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
                        <div className="text-lg font-bold text-green-600">{analytics.assignmentRate}%</div>
                        <div className="text-[10px] text-muted-foreground">Assigned</div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
                        <div className="text-lg font-bold text-amber-600">
                            {analytics.avgResponseTimeSec > 60
                                ? `${Math.round(analytics.avgResponseTimeSec / 60)}m`
                                : `${analytics.avgResponseTimeSec}s`}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Avg Response</div>
                    </div>
                </div>
            )}

            {/* -- Create Blast Form ------------------- */}
            {showCreate && (
                <Card className="border-primary/20 shadow-md shadow-primary/5">
                    <CardContent className="pt-4 pb-3 space-y-3">
                        {/* Load selector */}
                        <div>
                            <Label className="text-xs font-medium mb-1 block">Select Load</Label>
                            <Select value={selectedLoad} onValueChange={setSelectedLoad}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Choose a load to blast..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {eligibleLoads.map((l) => (
                                        <SelectItem key={l.id} value={l.id} className="text-xs">
                                            <span className="font-mono">{l.reference_number ?? l.id.slice(0, 8)}</span>
                                            <span className="text-muted-foreground ml-2">
                                                {l.client_name ?? "--"} ? {l.miles}mi ? ${l.revenue}
                                            </span>
                                        </SelectItem>
                                    ))}
                                    {eligibleLoads.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">No eligible loads</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Load preview */}
                        {currentLoad && (
                            <div className="rounded-lg bg-muted/30 border border-border/30 p-2.5 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold">{currentLoad.client_name ?? "Unknown Client"}</span>
                                    <Badge variant="outline" className="text-[9px]">{currentLoad.service_type}</Badge>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {currentLoad.pickup_address ?? "--"} -> {currentLoad.delivery_address ?? "--"}
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Truck className="h-3 w-3" /> {currentLoad.miles}mi
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" /> ${currentLoad.revenue}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Package className="h-3 w-3" /> {currentLoad.packages} pkg
                                    </span>
                                </div>

                                {loadBlasts.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                        <span className="text-yellow-600 text-[10px]">
                                            Already has {loadBlasts.length} active blast{loadBlasts.length > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Priority selector */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs font-medium mb-1 block">Priority</Label>
                                <Select value={priority} onValueChange={(v) => setPriority(v as BlastPriority)}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.entries(PRIORITY_CONFIG) as [BlastPriority, typeof PRIORITY_CONFIG[BlastPriority]][]).map(
                                            ([key, cfg]) => (
                                                <SelectItem key={key} value={key} className="text-xs">
                                                    {cfg.icon} {cfg.label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-medium mb-1 block">Expires In</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        min={1}
                                        max={480}
                                        value={expiryMinutes}
                                        onChange={(e) => setExpiryMinutes(Number(e.target.value) || 30)}
                                        className="h-8 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">min</span>
                                </div>
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <Label className="text-xs font-medium mb-1 block">
                                Message <span className="text-muted-foreground">(optional)</span>
                            </Label>
                            <Textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="e.g. time-sensitive, fragile cargo, needs liftgate..."
                                className="text-xs min-h-[50px] resize-none"
                                rows={2}
                            />
                        </div>

                        {/* Driver selection */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <Label className="text-xs font-medium flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    Select Drivers ({selectedDrivers.size})
                                </Label>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 text-[10px] px-1.5"
                                        onClick={selectAllHub}
                                    >
                                        Hub
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 text-[10px] px-1.5"
                                        onClick={selectAll}
                                    >
                                        All
                                    </Button>
                                    {selectedDrivers.size > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-[10px] px-1.5 text-red-500"
                                            onClick={clearSelection}
                                        >
                                            Clear
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="max-h-[180px] overflow-y-auto space-y-0.5 rounded-lg border border-border/30 p-1.5">
                                {/* Same-hub drivers first */}
                                {hubDrivers.length > 0 && (
                                    <div className="text-[9px] font-semibold uppercase text-muted-foreground px-1 pt-0.5 pb-1">
                                        {currentLoad?.hub ?? "Same Hub"} Drivers
                                    </div>
                                )}
                                {hubDrivers.map((d) => (
                                    <DriverChip
                                        key={d.id}
                                        driver={d}
                                        selected={selectedDrivers.has(d.id)}
                                        onToggle={() => toggleDriver(d.id)}
                                    />
                                ))}

                                {/* Other hub drivers */}
                                {otherDrivers.length > 0 && (
                                    <>
                                        <div className="text-[9px] font-semibold uppercase text-muted-foreground px-1 pt-2 pb-1">
                                            Other Hubs
                                        </div>
                                        {otherDrivers.map((d) => (
                                            <DriverChip
                                                key={d.id}
                                                driver={d}
                                                selected={selectedDrivers.has(d.id)}
                                                onToggle={() => toggleDriver(d.id)}
                                            />
                                        ))}
                                    </>
                                )}

                                {hubDrivers.length === 0 && otherDrivers.length === 0 && (
                                    <div className="text-xs text-muted-foreground text-center py-4">
                                        No active drivers found
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Send button */}
                        <Button
                            className="w-full h-9 text-sm font-semibold gap-2 relative overflow-hidden group"
                            disabled={!selectedLoad || selectedDrivers.size === 0 || sending}
                            onClick={handleBlast}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary to-primary/80 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="relative flex items-center gap-2">
                                {sending ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                                ) : (
                                    <><Signal className="h-4 w-4" /> Blast to {selectedDrivers.size} Driver{selectedDrivers.size > 1 ? "s" : ""}</>
                                )}
                            </span>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* -- Active Blasts ----------------------- */}
            <div className="space-y-2">
                {loading && (
                    <div className="text-xs text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading blasts...
                    </div>
                )}

                {!loading && blasts.length === 0 && !showCreate && (
                    <div className="text-xs text-muted-foreground text-center py-6 space-y-1">
                        <Radio className="h-8 w-8 mx-auto opacity-20" />
                        <p>No blast history yet</p>
                        <p className="text-[10px]">Select a load and blast it to your drivers!</p>
                    </div>
                )}

                {blasts.map((blast) => (
                    <BlastCard
                        key={blast.id}
                        blast={blast}
                        drivers={drivers}
                        expanded={expandedBlast === blast.id}
                        onToggle={() =>
                            setExpandedBlast(expandedBlast === blast.id ? null : blast.id)
                        }
                        onCancel={() => cancelBlast(blast.id)}
                        onLoadAssigned={onLoadAssigned}
                    />
                ))}
            </div>
        </div>
    );
}

// --- Sub-components ------------------------------------

function DriverChip({
    driver,
    selected,
    onToggle,
}: {
    driver: Driver;
    selected: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all
                ${selected
                    ? "bg-primary/10 border border-primary/30 text-primary font-medium"
                    : "bg-transparent border border-transparent hover:bg-muted/40 text-foreground/70"
                }
            `}
        >
            <div
                className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                    ${selected ? "border-primary bg-primary" : "border-muted-foreground/30"}
                `}
            >
                {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
            </div>
            <span className="truncate">{driver.full_name}</span>
            <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto shrink-0">
                {driver.hub}
            </Badge>
        </button>
    );
}

function BlastCard({
    blast,
    drivers,
    expanded,
    onToggle,
    onCancel,
    onLoadAssigned,
}: {
    blast: BlastWithResponses;
    drivers: Driver[];
    expanded: boolean;
    onToggle: () => void;
    onCancel: () => void;
    onLoadAssigned?: (loadId: string, driverId: string) => void;
}) {
    const priCfg = PRIORITY_CONFIG[blast.priority as BlastPriority] ?? PRIORITY_CONFIG.normal;
    const isActive = blast.status === "active";
    const isAccepted = blast.status === "accepted";

    const interested = blast.responses.filter((r) => r.status === "interested");
    const declined = blast.responses.filter((r) => r.status === "declined");
    const pending = blast.responses.filter((r) => r.status === "pending" || r.status === "viewed");
    const viewed = blast.responses.filter((r) => r.status === "viewed");

    // Time since blast
    const elapsed = Math.round((Date.now() - new Date(blast.blast_sent_at).getTime()) / 1000);
    const elapsedStr =
        elapsed < 60
            ? `${elapsed}s ago`
            : elapsed < 3600
                ? `${Math.round(elapsed / 60)}m ago`
                : `${Math.round(elapsed / 3600)}h ago`;

    // Time remaining
    const remaining = blast.expires_at
        ? Math.max(0, Math.round((new Date(blast.expires_at).getTime() - Date.now()) / 1000))
        : null;
    const remainingStr = remaining !== null
        ? remaining < 60
            ? `${remaining}s left`
            : `${Math.round(remaining / 60)}m left`
        : null;

    // Accepted driver name
    const acceptedDriver = blast.accepted_by
        ? drivers.find((d) => d.id === blast.accepted_by)?.full_name ?? "Unknown"
        : null;

    return (
        <div
            className={`
                rounded-xl border transition-all
                ${isActive
                    ? "border-primary/30 bg-primary/[0.03] shadow-sm shadow-primary/5"
                    : isAccepted
                        ? "border-green-500/30 bg-green-500/[0.03]"
                        : "border-muted-foreground/10 bg-muted/10 opacity-60"
                }
            `}
        >
            {/* Header */}
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs"
            >
                {/* Status indicator */}
                <div className="relative">
                    {isActive && (
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    )}
                    <Radio className={`h-4 w-4 ${isActive ? "text-primary" : isAccepted ? "text-green-500" : "text-muted-foreground"}`} />
                </div>

                <div className="flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{priCfg.icon}</span>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${priCfg.color}`}>
                            {priCfg.label}
                        </Badge>
                        {isActive && remainingStr && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Timer className="h-2.5 w-2.5" /> {remainingStr}
                            </span>
                        )}
                        {isAccepted && acceptedDriver && (
                            <span className="text-[10px] text-green-600 font-medium">
                                v {acceptedDriver}
                            </span>
                        )}
                    </div>
                </div>

                {/* Response indicators */}
                <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Users className="h-3 w-3" /> {blast.drivers_notified}
                    </span>
                    {viewed.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
                            <Eye className="h-3 w-3" /> {viewed.length}
                        </span>
                    )}
                    {interested.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-green-500">
                            <CheckCircle2 className="h-3 w-3" /> {interested.length}
                        </span>
                    )}
                    {declined.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-400">
                            <XCircle className="h-3 w-3" /> {declined.length}
                        </span>
                    )}

                    {expanded ? (
                        <ChevronUp className="h-3 w-3 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    )}
                </div>
            </button>

            {/* Expanded details */}
            {expanded && (
                <div className="border-t border-border/30 px-3 py-2 space-y-2">
                    {/* Blast info */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Sent {elapsedStr}</span>
                        <Badge
                            variant="outline"
                            className={`text-[9px] ${isActive ? "text-green-600 border-green-500/30" :
                                isAccepted ? "text-green-600 border-green-500/30" :
                                    blast.status === "cancelled" ? "text-red-500 border-red-500/30" :
                                        "text-muted-foreground"
                                }`}
                        >
                            {blast.status}
                        </Badge>
                    </div>

                    {blast.message && (
                        <div className="text-[11px] italic text-muted-foreground/80 bg-muted/20 rounded px-2 py-1">
                            "{blast.message}"
                        </div>
                    )}

                    {/* Response list */}
                    <div className="space-y-1">
                        <div className="text-[9px] font-semibold uppercase text-muted-foreground">
                            Driver Responses
                        </div>
                        {blast.responses.map((r) => {
                            const driverName = drivers.find((d) => d.id === r.driver_id)?.full_name ?? "Unknown";
                            const responseTime = r.response_time_ms
                                ? r.response_time_ms < 60_000
                                    ? `${Math.round(r.response_time_ms / 1000)}s`
                                    : `${Math.round(r.response_time_ms / 60_000)}m`
                                : null;

                            return (
                                <div
                                    key={r.id}
                                    className={`
                                        flex items-center gap-2 px-2 py-1.5 rounded-md text-xs
                                        ${r.status === "interested" ? "bg-green-500/10" :
                                            r.status === "declined" ? "bg-red-500/5" :
                                                r.status === "viewed" ? "bg-blue-500/5" :
                                                    "bg-transparent"}
                                    `}
                                >
                                    {/* Status icon */}
                                    {r.status === "interested" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                                    {r.status === "declined" && <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                                    {r.status === "viewed" && <Eye className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                                    {r.status === "pending" && <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 animate-pulse" />}
                                    {r.status === "expired" && <Ban className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}

                                    <span className={`truncate ${r.status === "interested" ? "font-semibold text-green-700" : ""}`}>
                                        {driverName}
                                    </span>

                                    {r.distance_miles && (
                                        <span className="text-[9px] text-muted-foreground">
                                            {r.distance_miles}mi
                                        </span>
                                    )}

                                    <span className="ml-auto text-[9px] text-muted-foreground">
                                        {responseTime && (
                                            <span className="flex items-center gap-0.5">
                                                <Timer className="h-2.5 w-2.5" /> {responseTime}
                                            </span>
                                        )}
                                    </span>

                                    {r.decline_reason && (
                                        <span className="text-[9px] text-red-400 truncate max-w-[80px]" title={r.decline_reason}>
                                            {r.decline_reason}
                                        </span>
                                    )}
                                </div>
                            );
                        })}

                        {blast.responses.length === 0 && (
                            <div className="text-[10px] text-muted-foreground text-center py-2">
                                No responses yet
                            </div>
                        )}
                    </div>

                    {/* Progress bar */}
                    {isActive && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-muted-foreground">
                                <span>{interested.length + declined.length} / {blast.drivers_notified} responded</span>
                                <span>{pending.length} waiting</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                <div className="h-full flex">
                                    <div
                                        className="bg-green-500 transition-all"
                                        style={{ width: `${(interested.length / blast.drivers_notified) * 100}%` }}
                                    />
                                    <div
                                        className="bg-red-400 transition-all"
                                        style={{ width: `${(declined.length / blast.drivers_notified) * 100}%` }}
                                    />
                                    <div
                                        className="bg-blue-400 transition-all"
                                        style={{ width: `${(viewed.length / blast.drivers_notified) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    {isActive && (
                        <div className="flex justify-end pt-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] gap-1 text-red-500 border-red-500/20 hover:bg-red-500/10"
                                onClick={onCancel}
                            >
                                <Ban className="h-3 w-3" />
                                Cancel Blast
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
