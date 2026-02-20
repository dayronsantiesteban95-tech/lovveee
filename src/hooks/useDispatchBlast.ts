/**
 * -----------------------------------------------------------
 * useDispatchBlast -- Realtime hook for the Blast System
 *
 * Key rule: Dispatcher assigns all loads. Blast is an
 * availability check -- drivers express interest, dispatcher
 * confirms the assignment.
 *
 * Provides:
 *   * CRUD for dispatch blasts
 *   * Realtime subscription for responses
 *   * expressInterest (driver) / confirmAssignment (dispatcher)
 *   * Analytics (response rates, avg time)
 * -----------------------------------------------------------
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { sendPushToDrivers } from "@/lib/sendPushNotification";

// --- Types ---------------------------------------------

export type BlastPriority = "low" | "normal" | "high" | "urgent";
export type BlastStatus = "active" | "accepted" | "expired" | "cancelled";
export type ResponseStatus = "pending" | "viewed" | "interested" | "declined" | "expired";

export interface DispatchBlast {
    id: string;
    load_id: string;
    created_by: string;
    hub: string;
    message: string | null;
    priority: BlastPriority;
    radius_miles: number;
    expires_at: string | null;
    blast_sent_at: string;
    status: BlastStatus;
    accepted_by: string | null;
    accepted_at: string | null;
    drivers_notified: number;
    drivers_viewed: number;
    drivers_declined: number;
    created_at: string;
    updated_at: string;
}

export interface BlastResponse {
    id: string;
    blast_id: string;
    driver_id: string;
    status: ResponseStatus;
    response_time_ms: number | null;
    decline_reason: string | null;
    latitude: number | null;
    longitude: number | null;
    distance_miles: number | null;
    notified_at: string;
    responded_at: string | null;
    created_at: string;
}

export interface BlastWithResponses extends DispatchBlast {
    responses: BlastResponse[];
}

interface CreateBlastParams {
    loadId: string;
    hub: string;
    driverIds: string[];
    message?: string;
    priority?: BlastPriority;
    radiusMiles?: number;
    expiresInMinutes?: number;
}

// --- Hook ----------------------------------------------

export function useDispatchBlast() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [blasts, setBlasts] = useState<BlastWithResponses[]>([]);
    const [loading, setLoading] = useState(true);

    // -- Fetch all active + recent blasts ----------
    const fetchBlasts = useCallback(async () => {
        const { data: blastRows, error } = await supabase
            .from("dispatch_blasts")
            .select("*")
            .or("status.eq.active,created_at.gte." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false })
            .limit(50) as { data: DispatchBlast[] | null; error: any };

        if (error || !blastRows) {
            setLoading(false);
            return;
        }

        // Fetch responses for these blasts
        const blastIds = blastRows.map((b) => b.id);
        const { data: responseRows } = await supabase
            .from("blast_responses")
            .select("*")
            .in("blast_id", blastIds.length > 0 ? blastIds : ["__none__"])
            .order("notified_at", { ascending: true }) as { data: BlastResponse[] | null };

        const responsesByBlast = new Map<string, BlastResponse[]>();
        for (const r of responseRows ?? []) {
            const arr = responsesByBlast.get(r.blast_id) ?? [];
            arr.push(r);
            responsesByBlast.set(r.blast_id, arr);
        }

        const enriched: BlastWithResponses[] = blastRows.map((b) => ({
            ...b,
            responses: responsesByBlast.get(b.id) ?? [],
        }));

        setBlasts(enriched);
        setLoading(false);
    }, []);

    // -- Realtime subscriptions --------------------
    useEffect(() => {
        fetchBlasts();

        // Subscribe to blast changes
        const blastChannel = supabase
            .channel("dispatch-blasts-realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "dispatch_blasts" },
                () => fetchBlasts(),
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "blast_responses" },
                () => fetchBlasts(),
            )
            .subscribe();

        return () => {
            supabase.removeChannel(blastChannel);
        };
    }, [fetchBlasts]);

    // -- Create a new blast ------------------------
    const createBlast = useCallback(
        async (params: CreateBlastParams): Promise<DispatchBlast | null> => {
            if (!user) return null;

            const expiresAt = params.expiresInMinutes
                ? new Date(Date.now() + params.expiresInMinutes * 60_000).toISOString()
                : new Date(Date.now() + 30 * 60_000).toISOString(); // default 30 min

            // 1. Create the blast
            const { data: blast, error: blastErr } = await supabase
                .from("dispatch_blasts")
                .insert({
                    load_id: params.loadId,
                    created_by: user.id,
                    hub: params.hub,
                    message: params.message ?? null,
                    priority: params.priority ?? "normal",
                    radius_miles: params.radiusMiles ?? 50,
                    expires_at: expiresAt,
                    drivers_notified: params.driverIds.length,
                })
                .select("*")
                .single() as { data: DispatchBlast | null; error: any };

            if (blastErr || !blast) {
                toast({
                    title: "Blast failed",
                    description: blastErr?.message ?? "Could not create blast",
                    variant: "destructive",
                });
                return null;
            }

            // 2. Create response rows for each driver
            const responseRows = params.driverIds.map((driverId) => ({
                blast_id: blast.id,
                driver_id: driverId,
                status: "pending",
            }));

            const { error: respErr } = await supabase
                .from("blast_responses")
                .insert(responseRows);

            if (respErr) {
                // Non-fatal -- blast was created; response tracking may be incomplete
            }

            // 3. Update load status to show it's being blasted
            await supabase
                .from("daily_loads")
                .update({
                    status: "blasted",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", params.loadId);

            // 4. Send push notifications to all blasted drivers
            try {
                // Fetch load details for the notification body
                const { data: loadData } = await supabase
                    .from("daily_loads")
                    .select("service_type, pickup_address, delivery_address, revenue")
                    .eq("id", params.loadId)
                    .single() as { data: { service_type: string; pickup_address: string; delivery_address: string; revenue: number } | null };

                const loadBody = loadData
                    ? `${loadData.service_type} -- ${loadData.pickup_address} -> ${loadData.delivery_address} | $${loadData.revenue}`
                    : params.message ?? "New load available -- open the app to view details.";

                await sendPushToDrivers(
                    params.driverIds,
                    '?? New Load Available',
                    loadBody,
                    { load_id: params.loadId, blast_id: blast.id, type: 'blast' }
                );
            } catch (pushErr) {
                // Non-fatal -- blast was created; push may be unavailable
                console.warn('[useDispatchBlast] Push notification failed:', pushErr);
            }

            toast({
                title: "Blast Sent!",
                description: `Notified ${params.driverIds.length} driver${params.driverIds.length > 1 ? "s" : ""}. Waiting for responses...`,
            });

            return blast;
        },
        [user, toast],
    );

    // -- Cancel a blast ----------------------------
    const cancelBlast = useCallback(
        async (blastId: string) => {
            const { error } = await supabase
                .from("dispatch_blasts")
                .update({ status: "cancelled", updated_at: new Date().toISOString() })
                .eq("id", blastId);

            if (error) {
                toast({ title: "Cancel failed", description: error.message, variant: "destructive" });
            } else {
                // Expire all pending responses
                await supabase
                    .from("blast_responses")
                    .update({ status: "expired", responded_at: new Date().toISOString() })
                    .eq("blast_id", blastId)
                    .in("status", ["pending", "viewed"]);

                toast({ title: "Blast cancelled" });
            }
        },
        [toast],
    );

    // -- Express interest (driver-side -- marks as "interested") --
    const expressInterest = useCallback(
        async (blastId: string, driverId: string, lat?: number, lng?: number) => {
            const { error } = await supabase
                .from("blast_responses")
                .update({
                    status: "interested",
                    responded_at: new Date().toISOString(),
                    latitude: lat ?? null,
                    longitude: lng ?? null,
                })
                .eq("blast_id", blastId)
                .eq("driver_id", driverId);

            if (error) {
                toast({
                    title: "Failed",
                    description: error.message,
                    variant: "destructive",
                });
                return false;
            }

            toast({
                title: "Interest sent!",
                description: "Dispatcher will confirm your assignment.",
            });
            return true;
        },
        [toast],
    );

    // -- Confirm assignment (dispatcher-side -- calls PG function) --
    const confirmAssignment = useCallback(
        async (blastId: string, driverId: string) => {
            const { data, error } = await supabase.rpc("confirm_blast_assignment", {
                p_blast_id: blastId,
                p_driver_id: driverId,
            }) as { data: { success: boolean; error?: string; load_id?: string } | null; error: any };

            if (error || !data?.success) {
                toast({
                    title: "Assignment failed",
                    description: data?.error ?? error?.message ?? "Unknown error",
                    variant: "destructive",
                });
                return false;
            }

            toast({
                title: "? Driver Assigned!",
                description: "Load has been assigned to the selected driver.",
            });
            return true;
        },
        [toast],
    );

    // -- Decline (for driver-side) -----------------
    const declineBlast = useCallback(
        async (blastId: string, driverId: string, reason?: string) => {
            const { error } = await supabase
                .from("blast_responses")
                .update({
                    status: "declined",
                    decline_reason: reason ?? null,
                    responded_at: new Date().toISOString(),
                    response_time_ms: null, // will be computed
                })
                .eq("blast_id", blastId)
                .eq("driver_id", driverId);

            if (!error) {
                // Increment decline counter on the blast
                await supabase.rpc("increment_blast_stat", {
                    p_blast_id: blastId,
                    p_field: "drivers_declined",
                }).catch(() => {
                    // Fallback: manual update
                    supabase
                        .from("dispatch_blasts")
                        .update({ drivers_declined: (blasts.find(b => b.id === blastId)?.drivers_declined ?? 0) + 1 })
                        .eq("id", blastId);
                });
            }
        },
        [blasts],
    );

    // -- Analytics ---------------------------------
    const analytics = useMemo(() => {
        const active = blasts.filter((b) => b.status === "active");
        const assigned = blasts.filter((b) => b.status === "accepted");
        const allResponses = blasts.flatMap((b) => b.responses);
        const interestedResponses = allResponses.filter((r) => r.status === "interested");
        const avgResponseTime = interestedResponses.length
            ? Math.round(
                interestedResponses.reduce((s, r) => s + (r.response_time_ms ?? 0), 0) /
                interestedResponses.length,
            )
            : 0;

        return {
            activeBlasts: active.length,
            totalBlasts: blasts.length,
            assignmentRate: blasts.length
                ? Math.round((assigned.length / blasts.length) * 100)
                : 0,
            avgResponseTimeSec: Math.round(avgResponseTime / 1000),
            totalNotified: blasts.reduce((s, b) => s + b.drivers_notified, 0),
        };
    }, [blasts]);

    return {
        blasts,
        loading,
        analytics,
        createBlast,
        cancelBlast,
        expressInterest,
        confirmAssignment,
        declineBlast,
        refresh: fetchBlasts,
    };
}
