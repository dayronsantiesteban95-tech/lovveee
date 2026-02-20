/**
 * useRealtimeDriverLocations -- Singleton realtime subscription for driver GPS data.
 *
 * PERFORMANCE NOTES:
 * - Only ONE Supabase channel is created regardless of how many components mount this hook.
 * - GPS render updates are throttled: a marker only re-renders if position changed by
 *   >10 meters OR >15 seconds since last render update -- whichever comes first.
 * - Reconnects automatically when the websocket drops (wifi blip, etc.)
 *
 * Usage:
 *   const { drivers, realtimeStatus } = useRealtimeDriverLocations();
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// --- Types ---------------------------------------------

export interface DriverLocation {
    id: string;
    driver_id: string;
    driver_name: string | null;
    latitude: number;
    longitude: number;
    recorded_at: string;
    active_load_id: string | null;
}

export type RealtimeStatus = "connected" | "reconnecting" | "disconnected";

export interface UseRealtimeDriverLocationsReturn {
    drivers: DriverLocation[];
    realtimeStatus: RealtimeStatus;
    refresh: () => Promise<void>;
}

// --- Constants -----------------------------------------

const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000;   // 10 minutes -- driver considered stale
const MIN_UPDATE_INTERVAL_MS = 15_000;         // 15 seconds -- minimum time between re-renders per driver
const MIN_DISTANCE_METERS = 10;                // 10 meters -- minimum position delta to force re-render

// --- Haversine distance (meters) -----------------------

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Module-level singleton state ----------------------

let channelInstance: RealtimeChannel | null = null;
let subscriberCount = 0;

// Shared mutable state -- listeners get notified on change
let sharedDrivers: DriverLocation[] = [];
let sharedStatus: RealtimeStatus = "disconnected";

type DriversListener = (drivers: DriverLocation[]) => void;
type StatusListener = (status: RealtimeStatus) => void;

const driversListeners = new Set<DriversListener>();
const statusListeners = new Set<StatusListener>();

// Per-driver throttle tracking (module-level, persists across subscriber mounts)
const lastRenderTimeRef: Record<string, number> = {};
const lastRenderPosRef: Record<string, { lat: number; lng: number }> = {};

function notifyDrivers() {
    driversListeners.forEach((fn) => fn(sharedDrivers));
}

function notifyStatus() {
    statusListeners.forEach((fn) => fn(sharedStatus));
}

function setStatus(s: RealtimeStatus) {
    if (sharedStatus !== s) {
        sharedStatus = s;
        notifyStatus();
    }
}

// --- Fetch all active driver locations -----------------

async function fetchAllDriverLocations(): Promise<void> {
    try {
        // Prefer RPC (joins driver_name properly)
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_driver_positions");
        if (!rpcError && rpcData) {
            const deduped: DriverLocation[] = (rpcData as Array<{
                driver_id: string;
                driver_name: string | null;
                latitude: number;
                longitude: number;
                recorded_at: string;
                active_load_id: string | null;
            }>).map((row) => ({
                id: row.driver_id,
                driver_id: row.driver_id,
                driver_name: row.driver_name,
                latitude: row.latitude,
                longitude: row.longitude,
                recorded_at: row.recorded_at,
                active_load_id: row.active_load_id,
            }));
            sharedDrivers = deduped;
            notifyDrivers();
            return;
        }

        // Fallback: direct query + deduplicate
        const cutoff = new Date(Date.now() - ACTIVE_THRESHOLD_MS).toISOString();
        const { data, error } = await supabase
            .from("driver_locations")
            .select("id, driver_id, latitude, longitude, recorded_at")
            .gte("recorded_at", cutoff)
            .order("recorded_at", { ascending: false });

        if (error) return;

        const seen = new Set<string>();
        const deduped: DriverLocation[] = [];
        for (const row of (data ?? [])) {
            if (!seen.has(row.driver_id)) {
                seen.add(row.driver_id);
                deduped.push({
                    ...row,
                    driver_name: null,
                    active_load_id: null,
                } as DriverLocation);
            }
        }
        sharedDrivers = deduped;
        notifyDrivers();
    } catch {
        // Never crash -- network or unexpected errors are silently absorbed
    }
}

// --- Singleton channel lifecycle -----------------------

function ensureChannel(): void {
    if (channelInstance) return;

    channelInstance = supabase
        .channel("driver-locations-singleton")
        .on(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "postgres_changes" as any,
            { event: "*", schema: "public", table: "driver_locations" },
            (payload: { new?: Record<string, unknown> }) => {
                const row = payload.new as {
                    driver_id?: string;
                    latitude?: number;
                    longitude?: number;
                    recorded_at?: string;
                    active_load_id?: string | null;
                } | undefined;

                if (!row?.driver_id || row.latitude == null || row.longitude == null) {
                    // Unknown event shape -- just re-fetch
                    void fetchAllDriverLocations();
                    return;
                }

                const driverId = row.driver_id;
                const now = Date.now();

                // -- Throttle: skip update if too soon AND position hasn't moved enough --
                const lastTime = lastRenderTimeRef[driverId] ?? 0;
                const lastPos = lastRenderPosRef[driverId];
                const timeDelta = now - lastTime;

                if (timeDelta < MIN_UPDATE_INTERVAL_MS && lastPos) {
                    const distMoved = haversineMeters(lastPos.lat, lastPos.lng, row.latitude, row.longitude);
                    if (distMoved < MIN_DISTANCE_METERS) {
                        return; // Skip -- not enough time elapsed AND driver barely moved
                    }
                }

                // Commit the render -- update throttle tracking
                lastRenderTimeRef[driverId] = now;
                lastRenderPosRef[driverId] = { lat: row.latitude, lng: row.longitude };

                // Update shared state -- replace or add driver entry
                const existing = sharedDrivers.find((d) => d.driver_id === driverId);
                if (existing) {
                    sharedDrivers = sharedDrivers.map((d) =>
                        d.driver_id === driverId
                            ? {
                                ...d,
                                latitude: row.latitude!,
                                longitude: row.longitude!,
                                recorded_at: row.recorded_at ?? d.recorded_at,
                                active_load_id: row.active_load_id ?? d.active_load_id,
                            }
                            : d
                    );
                } else {
                    // New driver -- re-fetch to get their name
                    void fetchAllDriverLocations();
                    return;
                }

                notifyDrivers();
            }
        )
        .subscribe((status) => {
            if (status === "SUBSCRIBED") {
                setStatus("connected");
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                setStatus("reconnecting");
            } else if (status === "CLOSED") {
                setStatus("disconnected");
            }
        });

    // -- Reconnection logic via websocket-level events --
    supabase.realtime.onOpen(() => setStatus("connected"));
    supabase.realtime.onClose(() => {
        setStatus("disconnected");
        // Attempt to reconnect after a brief delay
        setTimeout(() => {
            if (subscriberCount > 0) {
                supabase.realtime.connect();
            }
        }, 3_000);
    });
    supabase.realtime.onError(() => setStatus("disconnected"));
}

function destroyChannel(): void {
    if (channelInstance) {
        void supabase.removeChannel(channelInstance);
        channelInstance = null;
    }
    sharedStatus = "disconnected";
}

// --- Hook ----------------------------------------------

export function useRealtimeDriverLocations(): UseRealtimeDriverLocationsReturn {
    const [drivers, setDrivers] = useState<DriverLocation[]>(sharedDrivers);
    const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(sharedStatus);

    // Keep stable references for listener registration
    const driversListener = useCallback((d: DriverLocation[]) => setDrivers([...d]), []);
    const statusListener = useCallback((s: RealtimeStatus) => setRealtimeStatus(s), []);

    useEffect(() => {
        subscriberCount++;

        // Register listeners
        driversListeners.add(driversListener);
        statusListeners.add(statusListener);

        // Boot channel on first subscriber
        ensureChannel();

        // Initial fetch
        void fetchAllDriverLocations();

        return () => {
            driversListeners.delete(driversListener);
            statusListeners.delete(statusListener);
            subscriberCount--;

            // Tear down channel when last subscriber unmounts
            if (subscriberCount === 0) {
                destroyChannel();
            }
        };
    }, [driversListener, statusListener]);

    const refresh = useCallback(async () => {
        await fetchAllDriverLocations();
    }, []);

    return { drivers, realtimeStatus, refresh };
}

export default useRealtimeDriverLocations;
