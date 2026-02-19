/**
 * useRealtimeDriverMap — Subscribe to live GPS updates via Supabase Realtime
 *
 * Used by the dispatch dashboard to show real-time driver positions
 * without polling. Updates arrive via WebSocket the moment a driver
 * inserts a new GPS ping.
 *
 * Cost: $0 — included in Supabase plan.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ─────────────────────────────────────────────

export interface LiveDriver {
    driverId: string;
    name: string;
    hub: string;
    lat: number;
    lng: number;
    speed: number | null;
    heading: number | null;
    battery: number | null;
    isMoving: boolean;
    activeLoadId: string | null;
    lastSeen: string;           // ISO timestamp
    shiftStatus: "on_duty" | "break" | "off_duty";
}

interface UseRealtimeDriverMapReturn {
    drivers: LiveDriver[];
    loading: boolean;
    connected: boolean;
    refresh: () => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────

export function useRealtimeDriverMap(): UseRealtimeDriverMapReturn {
    const [drivers, setDrivers] = useState<LiveDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);

    // Fetch initial positions via RPC
    const fetchPositions = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc("get_driver_positions");
        if (error) {
            setLoading(false);
            return;
        }

        if (data) {
            const mapped: LiveDriver[] = (data as any[]).map((d) => ({
                driverId: d.driver_id,
                name: d.driver_name,
                hub: d.hub,
                lat: d.latitude,
                lng: d.longitude,
                speed: d.speed,
                heading: d.heading,
                battery: d.battery_pct,
                isMoving: d.is_moving,
                activeLoadId: d.active_load_id,
                lastSeen: d.recorded_at,
                shiftStatus: d.shift_status ?? "off_duty",
            }));
            setDrivers(mapped);
        }
        setLoading(false);
    }, []);

    // Subscribe to real-time GPS inserts
    useEffect(() => {
        fetchPositions();

        const channel = supabase
            .channel("driver-gps-live")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "driver_locations",
                },
                (payload) => {
                    const row = payload.new as {
                        driver_id: string;
                        latitude: number;
                        longitude: number;
                        speed: number | null;
                        heading: number | null;
                        battery_pct: number | null;
                        is_moving: boolean;
                        active_load_id: string | null;
                        recorded_at: string;
                    };

                    setDrivers((prev) => {
                        const existing = prev.find((d) => d.driverId === row.driver_id);
                        if (existing) {
                            // Update existing driver's position
                            return prev.map((d) =>
                                d.driverId === row.driver_id
                                    ? {
                                        ...d,
                                        lat: row.latitude,
                                        lng: row.longitude,
                                        speed: row.speed,
                                        heading: row.heading,
                                        battery: row.battery_pct,
                                        isMoving: row.is_moving,
                                        activeLoadId: row.active_load_id,
                                        lastSeen: row.recorded_at,
                                    }
                                    : d,
                            );
                        }
                        // New driver appeared — we need their name, so re-fetch
                        fetchPositions();
                        return prev;
                    });
                },
            )
            .subscribe((status) => {
                setConnected(status === "SUBSCRIBED");
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchPositions]);

    return {
        drivers,
        loading,
        connected,
        refresh: fetchPositions,
    };
}

export default useRealtimeDriverMap;
