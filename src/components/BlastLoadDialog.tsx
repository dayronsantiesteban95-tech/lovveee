/**
 * -----------------------------------------------------------
 * BlastLoadDialog -- Dispatcher UI to blast a load to drivers
 *
 * Opens as a dialog/modal. Shows load details pre-filled,
 * lets dispatcher select drivers and send blast.
 * -----------------------------------------------------------
 */
import { useState, useMemo, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Radio,
    MapPin,
    DollarSign,
    Package,
    Truck,
    Users,
    Send,
    Loader2,
    CheckSquare,
    Square,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { captureLoadError } from "@/lib/sentry";

// --- Types ---------------------------------------------

export interface BlastLoad {
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

interface AvailableDriver {
    id: string;
    full_name: string;
    hub: string;
    status: string;
    phone?: string | null;
}

interface BlastLoadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    load: BlastLoad | null;
    onBlastSent?: (blastId: string, driverCount: number) => void;
}

// --- Component -----------------------------------------

export default function BlastLoadDialog({
    open,
    onOpenChange,
    load,
    onBlastSent,
}: BlastLoadDialogProps) {
    const { toast } = useToast();
    const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
    const [loadingDrivers, setLoadingDrivers] = useState(false);
    const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [selectAll, setSelectAll] = useState(false);

    // Fetch available drivers when dialog opens
    useEffect(() => {
        if (!open) return;
        setSelectedDriverIds(new Set());
        setMessage("");
        setSelectAll(false);
        fetchDrivers();
    }, [open]);

    const fetchDrivers = async () => {
        setLoadingDrivers(true);
        const { data, error } = await supabase
            .from("drivers")
            .select("id, full_name, hub, status, phone")
            .eq("status", "active")
            .order("full_name");

        if (!error && data) {
            setDrivers(data as AvailableDriver[]);
        } else if (error) {
            toast({ title: "Error", description: "Failed to load drivers: " + error.message, variant: "destructive" });
        }
        setLoadingDrivers(false);
    };

    // Split drivers by hub match
    const hubDrivers = useMemo(() => {
        if (!load) return drivers;
        return drivers.filter((d) => d.hub === load.hub || d.hub === "any");
    }, [drivers, load]);

    const otherDrivers = useMemo(() => {
        if (!load) return [];
        return drivers.filter((d) => d.hub !== load.hub && d.hub !== "any");
    }, [drivers, load]);

    const toggleDriver = (id: string) => {
        setSelectedDriverIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectAll(checked);
        if (checked) {
            setSelectedDriverIds(new Set(drivers.map((d) => d.id)));
        } else {
            setSelectedDriverIds(new Set());
        }
    };

    const handleSelectHubOnly = () => {
        setSelectedDriverIds(new Set(hubDrivers.map((d) => d.id)));
        setSelectAll(false);
    };

    const handleSendBlast = async () => {
        if (!load || selectedDriverIds.size === 0) return;
        setSending(true);

        try {
            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
            const driverIdsArray = Array.from(selectedDriverIds);

            // 1. Get current user
            const { data: { user } } = await supabase.auth.getUser();

            // 2. Insert dispatch_blast
            const { data: blast, error: blastErr } = await supabase
                .from("dispatch_blasts")
                .insert({
                    load_id: load.id,
                    created_by: user?.id ?? null,
                    blasted_by: user?.id ?? null,
                    dispatcher_id: user?.id ?? null,
                    hub: load.hub,
                    message: message.trim() || null,
                    priority: "normal",
                    expires_at: expiresAt,
                    blast_sent_at: now,
                    blasted_at: now,
                    drivers_notified: driverIdsArray.length,
                    status: "active",
                })
                .select("id")
                .single();

            if (blastErr || !blast) {
                throw new Error(blastErr?.message ?? "Failed to create blast");
            }

            // 3. Insert blast_responses for each driver
            const responseRows = driverIdsArray.map((driverId) => ({
                blast_id: blast.id,
                driver_id: driverId,
                status: "pending",
                notified_at: now,
            }));

            try {
                const { error: respErr } = await supabase.from("blast_responses").insert(responseRows);
                if (respErr) throw respErr;
            } catch (respErr) {
                console.error("Failed to create blast responses:", respErr);
                captureLoadError(load.id, respErr, { operation: "create_blast_responses", blastId: blast.id });
                // Continue - blast was created successfully
            }

            // 4. Insert driver_notifications for each driver
            const notifRows = driverIdsArray.map((driverId) => ({
                driver_id: driverId,
                type: "blast",
                title: "New Load Available!",
                body: [
                    load.reference_number ? `Ref: ${load.reference_number}` : null,
                    load.pickup_address ? `From: ${load.pickup_address}` : null,
                    load.delivery_address ? `To: ${load.delivery_address}` : null,
                    `${load.miles} mi | ${load.revenue}`,
                    message.trim() || null,
                ]
                    .filter(Boolean)
                    .join(" | "),
                data: {
                    blast_id: blast.id,
                    load_id: load.id,
                    pickup_address: load.pickup_address,
                    delivery_address: load.delivery_address,
                    miles: load.miles,
                    revenue: load.revenue,
                    packages: load.packages,
                    expires_at: expiresAt,
                },
                read: false,
            }));

            try {
                const { error: notifErr } = await supabase.from("driver_notifications").insert(notifRows);
                if (notifErr) throw notifErr;
            } catch (notifErr) {
                console.error("Failed to create driver notifications:", notifErr);
                captureLoadError(load.id, notifErr, { operation: "create_driver_notifications", blastId: blast.id });
                // Continue - drivers can still see blast via blast_responses
            }

            // 5. Update load status to 'blasted'
            const { error: blastUpdateErr } = await supabase
                .from("daily_loads")
                .update({ status: "blasted", updated_at: now })
                .eq("id", load.id);
            if (blastUpdateErr) console.warn("load blast status update failed:", blastUpdateErr.message);

            toast({
                title: "Blast Sent!",
                description: `Blast sent to ${driverIdsArray.length} driver${driverIdsArray.length !== 1 ? "s" : ""}`,
            });

            onBlastSent?.(blast.id, driverIdsArray.length);
            onOpenChange(false);
        } catch (err: any) {
            toast({
                title: "Blast failed",
                description: err.message ?? "Unknown error",
                variant: "destructive",
            });
        } finally {
            setSending(false);
        }
    };

    if (!load) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Radio className="h-5 w-5 text-primary" />
                        Blast Load to Drivers
                    </DialogTitle>
                    <DialogDescription>
                        Send this load offer to multiple drivers simultaneously. First to accept gets assigned.
                    </DialogDescription>
                </DialogHeader>

                {/* Load Details */}
                <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-base">
                            {load.client_name ?? "Unknown Client"}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs">{load.service_type}</Badge>
                            <Badge variant="outline" className="text-xs">{load.hub}</Badge>
                        </div>
                    </div>

                    {load.reference_number && (
                        <div className="text-xs text-muted-foreground font-mono">
                            Ref: {load.reference_number}
                        </div>
                    )}

                    <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{load.pickup_address ?? "--"}</span>
                        <span className="mx-1">&rarr;</span>
                        <span>{load.delivery_address ?? "--"}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                            <Truck className="h-3.5 w-3.5" />
                            {load.miles} mi
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-green-600">
                            <DollarSign className="h-3.5 w-3.5" />
                            {load.revenue.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                            <Package className="h-3.5 w-3.5" />
                            {load.packages} pkg
                        </span>
                    </div>

                    <div className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                        <Radio className="h-3 w-3" />
                        Expires in 15 minutes if no driver accepts
                    </div>
                </div>

                {/* Message field */}
                <div>
                    <Label className="text-sm font-medium mb-1.5 block">
                        Message to Drivers <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="e.g. time-sensitive, fragile cargo, needs liftgate..."
                        className="text-sm min-h-[60px] resize-none"
                        rows={2}
                    />
                </div>

                {/* Driver Selector */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            Select Drivers
                            <Badge variant="secondary" className="text-xs">
                                {selectedDriverIds.size} selected
                            </Badge>
                        </Label>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleSelectHubOnly}
                                disabled={loadingDrivers}
                            >
                                Hub Only
                            </Button>
                            <div className="flex items-center gap-1.5">
                                <Checkbox
                                    id="select-all"
                                    checked={selectAll}
                                    onCheckedChange={(v) => handleSelectAll(!!v)}
                                    disabled={loadingDrivers}
                                />
                                <label htmlFor="select-all" className="text-xs cursor-pointer">
                                    All
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="border border-border/40 rounded-lg max-h-[240px] overflow-y-auto">
                        {loadingDrivers ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading drivers...
                            </div>
                        ) : drivers.length === 0 ? (
                            <div className="text-center py-6 text-sm text-muted-foreground">
                                No active drivers found
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                {/* Same-hub drivers */}
                                {hubDrivers.length > 0 && (
                                    <>
                                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground bg-muted/20">
                                            {load.hub} Hub
                                        </div>
                                        {hubDrivers.map((driver) => (
                                            <DriverRow
                                                key={driver.id}
                                                driver={driver}
                                                selected={selectedDriverIds.has(driver.id)}
                                                onToggle={() => toggleDriver(driver.id)}
                                            />
                                        ))}
                                    </>
                                )}

                                {/* Other hub drivers */}
                                {otherDrivers.length > 0 && (
                                    <>
                                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground bg-muted/20">
                                            Other Hubs
                                        </div>
                                        {otherDrivers.map((driver) => (
                                            <DriverRow
                                                key={driver.id}
                                                driver={driver}
                                                selected={selectedDriverIds.has(driver.id)}
                                                onToggle={() => toggleDriver(driver.id)}
                                            />
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={sending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSendBlast}
                        disabled={selectedDriverIds.size === 0 || sending}
                        className="gap-2"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                Send Blast to {selectedDriverIds.size} Driver{selectedDriverIds.size !== 1 ? "s" : ""}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Driver Row Sub-component --------------------------

function DriverRow({
    driver,
    selected,
    onToggle,
}: {
    driver: AvailableDriver;
    selected: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left
                ${selected
                    ? "bg-primary/8 hover:bg-primary/12"
                    : "hover:bg-muted/40"
                }
            `}
        >
            <div className="shrink-0">
                {selected ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                    <Square className="h-4 w-4 text-muted-foreground/40" />
                )}
            </div>
            <span className={`flex-1 truncate ${selected ? "font-medium" : ""}`}>
                {driver.full_name}
            </span>
            <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 shrink-0"
            >
                {driver.hub}
            </Badge>
        </button>
    );
}
