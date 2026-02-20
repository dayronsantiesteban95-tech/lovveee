/**
 * LiveDriverMap — Bulletproof Google Maps JS API integration.
 *
 * Key design decisions:
 * - Uses `declare const google: any` to avoid @types/google.maps dependency issues
 * - Polls window.google?.maps every 200ms (max 15s) before initializing
 * - Never calls document.createElement — Maps is already in index.html static tag
 * - Singleton useRealtimeDriverLocations hook (no duplicate subscriptions)
 * - Status-colored SVG markers with info windows
 * - Auto-fits bounds when drivers update
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const google: any;

import { useState, useEffect, useRef, useCallback } from "react";
import { Truck } from "lucide-react";
import { useRealtimeDriverLocations } from "@/hooks/useRealtimeDriverLocations";

// ── Constants ─────────────────────────────────────────────────────────────────

const PHOENIX_CENTER = { lat: 33.4484, lng: -112.074 };
const DEFAULT_ZOOM = 11;
const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 15_000;

// ── Status color map ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  in_progress:      "#22c55e", // green
  in_transit:       "#22c55e",
  arrived_pickup:   "#f97316", // orange
  arrived_delivery: "#a855f7", // purple
  assigned:         "#3b82f6", // blue
  delivered:        "#6b7280", // gray
  idle:             "#94a3b8", // slate
};

function statusColor(status?: string | null): string {
  return STATUS_COLORS[status ?? "idle"] ?? STATUS_COLORS.idle;
}

// ── Dark map styles matching app theme ────────────────────────────────────────

const DARK_MAP_STYLES = [
  { elementType: "geometry",              stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke",    stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill",      stylers: [{ color: "#94a3b8" }] },
  { featureType: "road", elementType: "geometry",        stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "road.highway", elementType: "geometry",        stylers: [{ color: "#334155" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "water", elementType: "geometry",          stylers: [{ color: "#0c1222" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "poi",     stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry",             stylers: [{ color: "#1e293b" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
];

// ── Wait for Maps API (loaded via static script tag in index.html) ────────────

function waitForMaps(): Promise<boolean> {
  return new Promise((resolve) => {
    // Already available — resolve immediately
    try {
      if (
        typeof window !== "undefined" &&
        (window as any).google?.maps?.Map
      ) {
        resolve(true);
        return;
      }
    } catch {
      // ignore — keep polling
    }

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += POLL_INTERVAL_MS;
      try {
        if ((window as any).google?.maps?.Map) {
          clearInterval(interval);
          resolve(true);
          return;
        }
      } catch {
        // ignore
      }
      if (elapsed >= POLL_TIMEOUT_MS) {
        clearInterval(interval);
        resolve(false); // timed out — caller shows error state
      }
    }, POLL_INTERVAL_MS);
  });
}

// ── Build SVG marker icon ─────────────────────────────────────────────────────

function buildMarkerIcon(
  initials: string,
  color: string,
  isSelected: boolean,
  mapRef: any,
): any {
  const size = isSelected ? 40 : 34;
  const fontSize = isSelected ? 13 : 11;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 10}" viewBox="0 0 ${size} ${size + 10}">
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
      </filter>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" filter="url(#shadow)" opacity="${isSelected ? 1 : 0.9}"/>
      ${isSelected ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="none" stroke="white" stroke-width="2.5" opacity="0.8"/>` : ""}
      <text x="${size / 2}" y="${size / 2 + fontSize / 3}" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700">${initials}</text>
      <polygon points="${size / 2 - 5},${size - 2} ${size / 2 + 5},${size - 2} ${size / 2},${size + 8}" fill="${color}"/>
    </svg>`.trim();

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new (window as any).google.maps.Size(size, size + 10),
    anchor: new (window as any).google.maps.Point(size / 2, size + 10),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveDriverMap() {
  const { drivers, realtimeStatus } = useRealtimeDriverLocations();

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapsTimedOut, setMapsTimedOut] = useState(false);

  const mapDivRef      = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef     = useRef<Map<string, any>>(new Map());
  const infoWindowRef  = useRef<any>(null);
  const initStartedRef = useRef(false);

  // ── Initialize map once Google Maps API is available ──────────────────────
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    waitForMaps().then((available) => {
      if (!available) {
        setMapsTimedOut(true);
        return;
      }
      if (!mapDivRef.current || mapInstanceRef.current) return;

      try {
        const map = new (window as any).google.maps.Map(mapDivRef.current, {
          center: PHOENIX_CENTER,
          zoom: DEFAULT_ZOOM,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: DARK_MAP_STYLES,
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = new (window as any).google.maps.InfoWindow();
        setMapReady(true);
      } catch (err) {
        console.error("[LiveDriverMap] Map init failed:", err);
        setMapsTimedOut(true);
      }
    });
  }, []);

  // ── Build marker icon (stable callback) ──────────────────────────────────
  const makeIcon = useCallback(
    (initials: string, color: string, isSelected: boolean) =>
      buildMarkerIcon(initials, color, isSelected, mapInstanceRef.current),
    [],
  );

  // ── Sync markers whenever drivers or selection changes ───────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const currentIds = new Set(drivers.map((d) => d.driver_id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Add / update markers
    drivers.forEach((driver) => {
      if (driver.latitude == null || driver.longitude == null) return;

      const name      = driver.driver_name ?? "Driver";
      const initials  = name.split(" ").map((n: string) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
      const color     = statusColor((driver as any).load_status);
      const isSelected = selectedDriverId === driver.driver_id;
      const position  = { lat: driver.latitude, lng: driver.longitude };

      let marker = markersRef.current.get(driver.driver_id);

      if (!marker) {
        marker = new (window as any).google.maps.Marker({
          map,
          position,
          title: name,
          icon: makeIcon(initials, color, isSelected),
          zIndex: isSelected ? 999 : 1,
          optimized: false,
        });

        // Click — show info window + select driver
        marker.addListener("click", () => {
          setSelectedDriverId((prev) =>
            prev === driver.driver_id ? null : driver.driver_id,
          );

          if (infoWindowRef.current) {
            const lastSeen = driver.recorded_at
              ? new Date(driver.recorded_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Unknown";

            const activeLoad = (driver as any).active_load_id;

            infoWindowRef.current.setContent(`
              <div style="background:#1e293b;color:#f1f5f9;padding:10px 14px;border-radius:10px;min-width:160px;font-family:system-ui,sans-serif;">
                <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${name}</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Last ping: ${lastSeen}</div>
                ${
                  activeLoad
                    ? `<div style="font-size:11px;background:#1e3a5f;border-radius:6px;padding:4px 8px;color:#60a5fa;">🚚 On active load</div>`
                    : `<div style="font-size:11px;color:#64748b;">No active load</div>`
                }
              </div>
            `);
            infoWindowRef.current.open(map, marker);
          }
        });

        markersRef.current.set(driver.driver_id, marker);
      } else {
        // Update existing marker
        marker.setPosition(position);
        marker.setIcon(makeIcon(initials, color, isSelected));
        marker.setZIndex(isSelected ? 999 : 1);
      }
    });

    // Auto-fit bounds when drivers are present
    if (drivers.length > 0 && drivers.length <= 30) {
      const bounds = new (window as any).google.maps.LatLngBounds();
      drivers.forEach((d) => {
        if (d.latitude != null && d.longitude != null) {
          bounds.extend({ lat: d.latitude, lng: d.longitude });
        }
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
        if (drivers.length === 1) map.setZoom(14);
      }
    }
  }, [drivers, mapReady, selectedDriverId, makeIcon]);

  // ── Status dot config ─────────────────────────────────────────────────────
  const statusDot = {
    connected:    { color: "bg-emerald-400", label: "Live" },
    reconnecting: { color: "bg-amber-400",   label: "Reconnecting" },
    disconnected: { color: "bg-red-400",      label: "Disconnected" },
  }[realtimeStatus];

  // ── Timed-out / no-key state ──────────────────────────────────────────────
  if (mapsTimedOut) {
    return (
      <div className="absolute inset-0 bg-[hsl(224,40%,4%)] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-xs">
          <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 w-16 h-16 flex items-center justify-center mx-auto">
            <Truck className="h-8 w-8 text-red-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Map failed to load</p>
            <p className="text-xs text-muted-foreground">
              Google Maps API did not become available within 15 seconds.
              Check the console for CSP or network errors.
            </p>
          </div>
          <button
            className="text-xs text-primary underline"
            onClick={() => {
              initStartedRef.current = false;
              setMapsTimedOut(false);
              setMapReady(false);
              mapInstanceRef.current = null;
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {/* Google Maps container */}
      <div ref={mapDivRef} className="absolute inset-0 w-full h-full" />

      {/* Loading skeleton — shown while waiting for Maps API */}
      {!mapReady && !mapsTimedOut && (
        <div className="absolute inset-0 bg-[hsl(224,40%,4%)] flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping" />
              <div
                className="absolute inset-2 rounded-full border border-primary/20 animate-ping"
                style={{ animationDelay: "0.3s" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Truck className="h-7 w-7 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Driver list overlay — bottom left */}
      {mapReady && drivers.length > 0 && (
        <div className="absolute bottom-16 left-4 z-20 space-y-1 max-h-52 overflow-y-auto">
          {drivers.map((driver) => {
            const isSelected = selectedDriverId === driver.driver_id;
            const color = statusColor((driver as any).load_status);
            return (
              <div
                key={driver.driver_id}
                className={`flex items-center gap-2 backdrop-blur-sm rounded-lg px-3 py-1.5 border cursor-pointer transition-all ${
                  isSelected
                    ? "bg-white/10 border-white/30"
                    : "bg-black/60 border-white/10 hover:bg-black/75"
                }`}
                onClick={() =>
                  setSelectedDriverId(isSelected ? null : driver.driver_id)
                }
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{ backgroundColor: color }}
                  />
                </span>
                <span className="text-[11px] font-medium text-white">
                  {driver.driver_name ?? "Driver"}
                </span>
                {(driver as any).active_load_id && (
                  <span className="text-[9px] text-blue-300 font-semibold">
                    ON LOAD
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No drivers overlay */}
      {mapReady && drivers.length === 0 && (
        <div className="absolute bottom-16 left-4 z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">No active drivers</p>
          </div>
        </div>
      )}

      {/* Live indicator pill — bottom left */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10 pointer-events-none">
        <span className="relative flex h-2 w-2">
          {realtimeStatus === "connected" && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusDot.color} opacity-75`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${statusDot.color}`}
          />
        </span>
        <span className="text-[10px] font-medium text-white/70">
          {realtimeStatus === "connected"
            ? `${drivers.length} driver${drivers.length !== 1 ? "s" : ""} live`
            : statusDot.label}
        </span>
      </div>
    </div>
  );
}
