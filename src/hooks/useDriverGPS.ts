/**
 * useDriverGPS — Real-time GPS tracking hook for the Driver Portal
 *
 * Uses the browser's Geolocation API (FREE, works on every phone)
 * and sends position pings to Supabase every N seconds.
 *
 * replaces onfleet / ontime360 GPS dependency entirely.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ─────────────────────────────────────────────

export interface GPSPosition {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
    altitude: number | null;
    timestamp: number;
}

export interface GPSState {
    position: GPSPosition | null;
    tracking: boolean;
    error: string | null;
    permissionStatus: "prompt" | "granted" | "denied" | "unavailable";
    pingCount: number;
    lastPingAt: string | null;
}

interface UseDriverGPSOptions {
    driverId: string;
    activeLoadId?: string | null;
    intervalMs?: number;       // how often to send pings (default: 30s)
    highAccuracy?: boolean;    // use GPS hardware (default: true)
    enabled?: boolean;         // master on/off switch
}

// ─── Battery API helper ────────────────────────────────

async function getBatteryLevel(): Promise<number | null> {
    try {
        // @ts-expect-error — Battery API exists on phones/chrome but not typed
        const battery = await navigator.getBattery?.();
        return battery ? Math.round(battery.level * 100) : null;
    } catch {
        return null;
    }
}

// ─── Movement detection ────────────────────────────────

function isMoving(speed: number | null, prevPos: GPSPosition | null, newPos: GPSPosition): boolean {
    // Speed-based (most reliable on mobile)
    if (speed !== null && speed > 1.5) return true; // > 1.5 m/s ≈ > 3.3 mph
    // Fallback: distance-based if speed not available
    if (prevPos) {
        const dLat = Math.abs(newPos.latitude - prevPos.latitude);
        const dLng = Math.abs(newPos.longitude - prevPos.longitude);
        return dLat > 0.0001 || dLng > 0.0001; // ~11 meters
    }
    return false;
}

// ─── Hook ──────────────────────────────────────────────

export function useDriverGPS({
    driverId,
    activeLoadId = null,
    intervalMs = 30_000,
    highAccuracy = true,
    enabled = true,
}: UseDriverGPSOptions): GPSState & {
    startTracking: () => void;
    stopTracking: () => void;
    requestPermission: () => Promise<boolean>;
} {
    const [state, setState] = useState<GPSState>({
        position: null,
        tracking: false,
        error: null,
        permissionStatus: "prompt",
        pingCount: 0,
        lastPingAt: null,
    });

    const watchIdRef = useRef<number | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const positionRef = useRef<GPSPosition | null>(null);
    const prevPositionRef = useRef<GPSPosition | null>(null);

    // Check if Geolocation is available
    useEffect(() => {
        if (!navigator.geolocation) {
            setState((s) => ({ ...s, permissionStatus: "unavailable", error: "Geolocation not supported" }));
            return;
        }
        // Check permission status
        navigator.permissions?.query({ name: "geolocation" }).then((result) => {
            setState((s) => ({ ...s, permissionStatus: result.state as GPSState["permissionStatus"] }));
            result.addEventListener("change", () => {
                setState((s) => ({ ...s, permissionStatus: result.state as GPSState["permissionStatus"] }));
            });
        });
    }, []);

    // Send GPS ping to Supabase
    const sendPing = useCallback(async () => {
        const pos = positionRef.current;
        if (!pos || !driverId) return;

        const battery = await getBatteryLevel();
        const moving = isMoving(pos.speed, prevPositionRef.current, pos);

        const { error } = await supabase.from("driver_locations").insert({
            driver_id: driverId,
            latitude: pos.latitude,
            longitude: pos.longitude,
            accuracy: pos.accuracy,
            speed: pos.speed,
            heading: pos.heading,
            altitude: pos.altitude,
            battery_pct: battery,
            is_moving: moving,
            active_load_id: activeLoadId,
        });

        if (!error) {
            prevPositionRef.current = pos;
            setState((s) => ({
                ...s,
                pingCount: s.pingCount + 1,
                lastPingAt: new Date().toISOString(),
            }));
        } else {
            console.error("GPS ping failed:", error.message);
        }
    }, [driverId, activeLoadId]);

    // Start watching position
    const startTracking = useCallback(() => {
        if (!navigator.geolocation) return;

        setState((s) => ({ ...s, tracking: true, error: null }));

        // Watch position continuously
        watchIdRef.current = navigator.geolocation.watchPosition(
            (geoPos) => {
                const pos: GPSPosition = {
                    latitude: geoPos.coords.latitude,
                    longitude: geoPos.coords.longitude,
                    accuracy: geoPos.coords.accuracy,
                    speed: geoPos.coords.speed,
                    heading: geoPos.coords.heading,
                    altitude: geoPos.coords.altitude,
                    timestamp: geoPos.timestamp,
                };
                positionRef.current = pos;
                setState((s) => ({ ...s, position: pos, error: null }));
            },
            (err) => {
                setState((s) => ({
                    ...s,
                    error: err.code === 1 ? "Location permission denied" : err.message,
                    permissionStatus: err.code === 1 ? "denied" : s.permissionStatus,
                }));
            },
            {
                enableHighAccuracy: highAccuracy,
                maximumAge: 10_000,    // accept cache up to 10s old
                timeout: 15_000,       // wait up to 15s for position
            },
        );

        // Start interval to send pings
        intervalRef.current = setInterval(sendPing, intervalMs);
        // Send first ping immediately
        setTimeout(sendPing, 2000); // slight delay to let first position come in
    }, [highAccuracy, intervalMs, sendPing]);

    // Stop tracking
    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setState((s) => ({ ...s, tracking: false }));
    }, []);

    // Request permission explicitly
    const requestPermission = useCallback(async (): Promise<boolean> => {
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => {
                    setState((s) => ({ ...s, permissionStatus: "granted" }));
                    resolve(true);
                },
                () => {
                    setState((s) => ({ ...s, permissionStatus: "denied" }));
                    resolve(false);
                },
                { enableHighAccuracy: highAccuracy },
            );
        });
    }, [highAccuracy]);

    // Auto-start/stop based on enabled prop
    useEffect(() => {
        if (enabled && !state.tracking && state.permissionStatus === "granted") {
            startTracking();
        } else if (!enabled && state.tracking) {
            stopTracking();
        }
        return () => { stopTracking(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    return {
        ...state,
        startTracking,
        stopTracking,
        requestPermission,
    };
}

export default useDriverGPS;
