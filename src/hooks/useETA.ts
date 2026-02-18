/**
 * useETA — Live traffic-aware ETA using Google Maps Routes API v2
 *
 * Uses REST (fetch), not the SDK. Works in browser.
 * POST https://routes.googleapis.com/directions/v2:computeRoutes
 *
 * Fetches on mount, refreshes every 60 seconds.
 * Caches results keyed by origin+destination for 60 seconds.
 */

import { useState, useEffect, useRef, useCallback } from "react";

const ROUTES_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK = "routes.duration,routes.distanceMeters";
const REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds

// ── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  durationSeconds: number;
  distanceMeters: number;
  fetchedAt: number; // epoch ms
}

const etaCache = new Map<string, CacheEntry>();

function cacheKey(origin: string, destination: string): string {
  return `${origin.trim().toLowerCase()}|${destination.trim().toLowerCase()}`;
}

function isCacheFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < REFRESH_INTERVAL_MS;
}

// ── API call ─────────────────────────────────────────────────────────────────

async function fetchRouteData(
  origin: string,
  destination: string,
): Promise<{ durationSeconds: number; distanceMeters: number }> {
  const body = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    departureTime: new Date().toISOString(),
  };

  const res = await fetch(ROUTES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": ROUTES_API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Routes API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error("No routes returned");

  // duration comes as e.g. "1234s" or { seconds: 1234 }
  let durationSeconds = 0;
  if (typeof route.duration === "string") {
    durationSeconds = parseInt(route.duration.replace("s", ""), 10) || 0;
  } else if (typeof route.duration === "object" && route.duration !== null) {
    durationSeconds = Number(route.duration.seconds) || 0;
  }

  const distanceMeters = Number(route.distanceMeters) || 0;
  return { durationSeconds, distanceMeters };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface ETAResult {
  eta: Date | null;
  durationMinutes: number | null;
  distanceMiles: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function useETA(
  origin: string,
  destination: string,
  enabled: boolean,
): ETAResult {
  const [eta, setEta] = useState<Date | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    if (!enabled || !origin?.trim() || !destination?.trim()) return;

    const key = cacheKey(origin, destination);
    const cached = etaCache.get(key);
    if (cached && isCacheFresh(cached)) {
      // Serve from cache but recalculate ETA from now
      const nowMs = Date.now();
      const arrivalDate = new Date(nowMs + cached.durationSeconds * 1000);
      if (!mountedRef.current) return;
      setEta(arrivalDate);
      setDurationMinutes(Math.round(cached.durationSeconds / 60));
      setDistanceMiles(parseFloat((cached.distanceMeters / 1609.34).toFixed(1)));
      setLastUpdated(new Date(cached.fetchedAt));
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const { durationSeconds, distanceMeters } = await fetchRouteData(origin, destination);
      const entry: CacheEntry = { durationSeconds, distanceMeters, fetchedAt: Date.now() };
      etaCache.set(key, entry);

      const arrivalDate = new Date(Date.now() + durationSeconds * 1000);
      if (!mountedRef.current) return;
      setEta(arrivalDate);
      setDurationMinutes(Math.round(durationSeconds / 60));
      setDistanceMiles(parseFloat((distanceMeters / 1609.34).toFixed(1)));
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message ?? "ETA unavailable");
      setEta(null);
      setDurationMinutes(null);
      setDistanceMiles(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [origin, destination, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || !origin?.trim() || !destination?.trim()) {
      setEta(null);
      setDurationMinutes(null);
      setDistanceMiles(null);
      setError(null);
      setLoading(false);
      return;
    }

    doFetch();
    intervalRef.current = setInterval(doFetch, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [doFetch, enabled, origin, destination]);

  return { eta, durationMinutes, distanceMiles, loading, error, lastUpdated, refresh: doFetch };
}

// ── Utility: ETA status color ────────────────────────────────────────────────

/**
 * Returns "green" | "yellow" | "red" | "gray" based on how close ETA is
 * relative to an optional SLA deadline.
 */
export function etaStatusColor(
  eta: Date | null,
  slaDeadline: string | null | undefined,
): "green" | "yellow" | "red" | "gray" {
  if (!eta) return "gray";
  if (!slaDeadline) return "green"; // no deadline = assume on time
  const slaMsLeft = new Date(slaDeadline).getTime() - eta.getTime();
  if (slaMsLeft >= 15 * 60 * 1000) return "green";   // >15 min buffer
  if (slaMsLeft >= 0) return "yellow";                 // tight but on time
  return "red";                                        // past deadline
}

/**
 * Format ETA date to human-readable "2:45 PM" or "~18 min"
 */
export function fmtETA(eta: Date | null, durationMinutes: number | null): string {
  if (!eta) return "ETA unavailable";
  if (durationMinutes !== null && durationMinutes < 60) {
    return `~${durationMinutes} min`;
  }
  return eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
