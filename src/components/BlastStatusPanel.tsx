/**
 * -----------------------------------------------------------
 * BlastStatusPanel -- Real-time blast response tracker
 *
 * Shows who accepted/declined after a blast is sent.
 * Dispatcher can cancel the blast or see auto-assignment.
 * -----------------------------------------------------------
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Radio,
    CheckCircle2,
    XCircle,
    Clock,
    Ban,
    Loader2,
    Users,
    Timer,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// --- Types ---------------------------------------------

interface BlastResponse {
    id: string;
    blast_id: string;
    driver_id: string;
    status: "pending" | "interested" | "declined" | "viewed" | "expired";
    responded_at: string | null;
    notified_at: string | null;
    driver?: {
        full_name: string;
        hub: string;
    };
}

interface BlastRecord {
    id: string;
    load_id: string;
    status: "active" | "accepted" | "expired" | "cancelled";
    drivers_notified: number;
    expires_at: string | null;
    blast_sent_at: string | null;
    accepted_by: string | null;
    message: string | null;
}

interface BlastStatusPanelProps {
    blastId: string;
    onCancelled?: () => void;
    onAssigned?: (driverId: string) => void;
    compact?: boolean;
}

// --- Component -----------------------------------------

export default function BlastStatusPanel({
    blastId,
    onCancelled,
    onAssigned,
    compact = false,
}: BlastStatusPanelProps) {
    const { toast } = useToast();
    const [blast, setBlast] = useState<BlastRecord | null>(null);
    const [responses, setResponses] = useState<BlastResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const fetchBlastData = useCallback(async () => {
        // Fetch blast record
        const { data: blastData, error: blastErr } = await supabase
            .from("dispatch_blasts")
            .select("id, load_id, status, drivers_notified, expires_at, blast_sent_at, accepted_by, message")
            .eq("id", blastId)
            .single();

        if (blastErr || !blastData) {
            setLoading(false);
            return;
        }

        setBlast(blastData as BlastRecord);

        // Fetch responses with driver names
        const { data: responseData } = await supabase
            .from("blast_responses")
            .select("id, blast_id, driver_id, status, responded_at, notified_at, drivers(full_name, hub)")
            .eq("blast_id", blastId)
            .order("responded_at", { ascending: true, nullsFirst: false });

        if (responseData) {
            // Flatten the nested drivers object
            const enriched = responseData.map((r: any) => ({
                ...r,
                driver: r.drivers ?? null,
            }));
            setResponses(enriched as BlastResponse[]);
        }

        setLoading(false);
    }, [blastId]);

    // Initial fetch
    useEffect(() => {
        fetchBlastData();
    }, [fetchBlastData]);

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel(`blast-status-${blastId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "blast_responses",
                    filter: `blast_id=eq.${blastId}`,
                },
                () => fetchBlastData(),
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "dispatch_blasts",
                    filter: `id=eq.${blastId}`,
                },
                (payload) => {
                    const updated = payload.new as BlastRecord;
                    setBlast(updated);
                    if (updated.status === "accepted" && updated.accepted_by) {
                        onAssigned?.(updated.accepted_by);
                        toast({
                            title: "? Load Assigned!",
                            description: "A driver accepted the blast -- load has been assigned.",
                        });
                    } else if (updated.status === "expired") {
                        toast({
                            title: "? Blast Expired",
                            description: "No driver accepted in time. Load is back to unassigned.",
                            variant: "destructive",
                        });
                    }
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [blastId, fetchBlastData, onAssigned, toast]);

    // Countdown timer
    useEffect(() => {
        if (!blast?.expires_at || blast.status !== "active") {
            setTimeLeft(null);
            return;
        }

        const update = () => {
            const remaining = Math.max(
                0,
                Math.floor((new Date(blast.expires_at!).getTime() - Date.now()) / 1000),
            );
            setTimeLeft(remaining);
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [blast]);

    const handleCancel = async () => {
        setCancelling(true);
        try {
            const now = new Date().toISOString();

            // Cancel the blast
            await supabase
                .from("dispatch_blasts")
                .update({ status: "cancelled", updated_at: now })
                .eq("id", blastId);

            // Expire all pending responses
            await supabase
                .from("blast_responses")
                .update({ status: "expired", responded_at: now })
                .eq("blast_id", blastId)
                .in("status", ["pending", "viewed", "interested"]);

            // Revert load to unassigned
            if (blast?.load_id) {
                await supabase
                    .from("daily_loads")
                    .update({ status: "unassigned", updated_at: now })
                    .eq("id", blast.load_id);
            }

            toast({ title: "Blast cancelled" });
            onCancelled?.();
        } catch (err: any) {
            toast({
                title: "Cancel failed",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setCancelling(false);
        }
    };

    // -- Render ----------------------------------

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading blast status...
            </div>
        );
    }

    if (!blast) {
        return (
            <div className="text-center py-6 text-sm text-muted-foreground">
                Blast not found
            </div>
        );
    }

    const accepted = responses.filter((r) => r.status === "interested");
    const declined = responses.filter((r) => r.status === "declined");
    const pending = responses.filter((r) => r.status === "pending" || r.status === "viewed");
    const isActive = blast.status === "active";
    const isAccepted = blast.status === "accepted";
    const isCancelled = blast.status === "cancelled";
    const isExpired = blast.status === "expired";

    const formatTimeLeft = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const formatTime = (iso: string | null) => {
        if (!iso) return "--";
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    return (
        <Card
            className={`border ${isActive
                    ? "border-primary/30 shadow-sm shadow-primary/5"
                    : isAccepted
                        ? "border-green-500/30"
                        : "border-muted/30"
                }`}
        >
            <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Radio
                            className={`h-4 w-4 ${isActive ? "text-primary animate-pulse" : isAccepted ? "text-green-500" : "text-muted-foreground"}`}
                        />
                        Blast Status
                        <StatusBadge status={blast.status} />
                    </CardTitle>

                    <div className="flex items-center gap-2">
                        {/* Countdown */}
                        {isActive && timeLeft !== null && (
                            <div
                                className={`flex items-center gap-1 text-xs font-mono ${timeLeft < 120 ? "text-red-500" : "text-muted-foreground"
                                    }`}
                            >
                                <Timer className="h-3.5 w-3.5" />
                                {formatTimeLeft(timeLeft)}
                            </div>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={fetchBlastData}
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {blast.message && (
                    <p className="text-xs italic text-muted-foreground mt-1">
                        "{blast.message}"
                    </p>
                )}
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-3">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2">
                    <StatBox
                        icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                        label="Accepted"
                        value={accepted.length}
                        color="text-green-600"
                    />
                    <StatBox
                        icon={<XCircle className="h-4 w-4 text-red-400" />}
                        label="Declined"
                        value={declined.length}
                        color="text-red-500"
                    />
                    <StatBox
                        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                        label="Pending"
                        value={pending.length}
                        color="text-muted-foreground"
                    />
                </div>

                {/* Progress bar */}
                {blast.drivers_notified > 0 && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {responses.length} / {blast.drivers_notified} notified
                            </span>
                            <span>
                                {Math.round(
                                    ((accepted.length + declined.length) / Math.max(blast.drivers_notified, 1)) * 100,
                                )}
                                % responded
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden flex">
                            <div
                                className="bg-green-500 transition-all duration-500"
                                style={{ width: `${(accepted.length / Math.max(blast.drivers_notified, 1)) * 100}%` }}
                            />
                            <div
                                className="bg-red-400 transition-all duration-500"
                                style={{ width: `${(declined.length / Math.max(blast.drivers_notified, 1)) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Driver response list */}
                {!compact && (
                    <div className="space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                            Driver Responses
                        </div>

                        {responses.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center py-3">
                                Waiting for responses...
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                {responses.map((r) => (
                                    <ResponseRow
                                        key={r.id}
                                        response={r}
                                        formatTime={formatTime}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Cancel button */}
                {isActive && (
                    <div className="flex justify-end pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 text-red-500 border-red-500/20 hover:bg-red-500/10"
                            onClick={handleCancel}
                            disabled={cancelling}
                        >
                            {cancelling ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Ban className="h-3 w-3" />
                            )}
                            Cancel Blast
                        </Button>
                    </div>
                )}

                {/* Expired message */}
                {(isExpired || isCancelled) && (
                    <p className="text-xs text-center text-muted-foreground">
                        {isCancelled
                            ? "This blast was cancelled by the dispatcher."
                            : "No driver accepted -- load has been returned to unassigned."}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

// --- Sub-components ------------------------------------

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { label: string; className: string }> = {
        active: { label: "LIVE", className: "bg-green-500/15 text-green-600 border-green-500/25 animate-pulse" },
        accepted: { label: "Accepted", className: "bg-green-500/15 text-green-600 border-green-500/25" },
        expired: { label: "Expired", className: "bg-amber-500/15 text-amber-600 border-amber-500/25" },
        cancelled: { label: "Cancelled", className: "bg-red-500/15 text-red-500 border-red-500/25" },
    };
    const cfg = configs[status] ?? { label: status, className: "" };
    return (
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${cfg.className}`}>
            {cfg.label}
        </Badge>
    );
}

function StatBox({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
}) {
    return (
        <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
            <div className="flex justify-center mb-1">{icon}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
    );
}

function ResponseRow({
    response,
    formatTime,
}: {
    response: BlastResponse;
    formatTime: (iso: string | null) => string;
}) {
    const statusConfig = {
        interested: {
            icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
            label: "Accepted",
            rowClass: "bg-green-500/8",
            textClass: "text-green-700 font-semibold",
        },
        declined: {
            icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
            label: "Declined",
            rowClass: "bg-red-500/5",
            textClass: "text-red-600",
        },
        viewed: {
            icon: <Clock className="h-3.5 w-3.5 text-blue-400" />,
            label: "Viewed",
            rowClass: "bg-blue-500/5",
            textClass: "text-blue-600",
        },
        pending: {
            icon: <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />,
            label: "Pending",
            rowClass: "",
            textClass: "text-muted-foreground",
        },
        expired: {
            icon: <Ban className="h-3.5 w-3.5 text-muted-foreground/50" />,
            label: "Expired",
            rowClass: "opacity-50",
            textClass: "text-muted-foreground",
        },
    };

    const cfg = statusConfig[response.status] ?? statusConfig.pending;
    const driverName = response.driver?.full_name ?? "Unknown Driver";
    const responseTime = formatTime(response.responded_at);

    return (
        <div
            className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-xs ${cfg.rowClass}`}
        >
            <div className="shrink-0">{cfg.icon}</div>
            <span className={`flex-1 truncate ${cfg.textClass}`}>{driverName}</span>
            {response.driver?.hub && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                    {response.driver.hub}
                </Badge>
            )}
            <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">
                {response.responded_at ? responseTime : "--"}
            </span>
        </div>
    );
}
