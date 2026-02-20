/**
 * LiveDriverMap — Google Maps JavaScript API with real driver markers.
 * Replaces the Embed API iframe (which doesn't support custom markers).
 * Uses window.google.maps loaded via script tag — no extra npm dependency.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Truck, Signal } from "lucide-react";
import { useRealtimeDriverLocations } from "@/hooks/useRealtimeDriverLocations";

const PHOENIX_CENTER = { lat: 33.4484, lng: -112.074 };
const DEFAULT_ZOOM = 11;
const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? "";

// ── Status color map ──────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  in_progress:       "#22c55e", // green
  in_transit:        "#22c55e",
  arrived_pickup:    "#f97316", // orange
  arrived_delivery:  "#a855f7", // purple
  assigned:          "#3b82f6", // blue
  delivered:         "#6b7280", // gray
  idle:              "#94a3b8", // slate
};

function statusColor(status?: string | null) {
  return STATUS_COLORS[status ?? "idle"] ?? STATUS_COLORS.idle;
}

// ── Wait for Maps JS API (loaded statically in index.html) ───────────────────
function waitForMaps(): Promise<void> {
  return new Promise((resolve) => {
    // Already loaded
    if (typeof google !== "undefined" && google.maps) { resolve(); return; }
    // Poll until available (loaded async from index.html static tag)
    const interval = setInterval(() => {
      if (typeof google !== "undefined" && google.maps) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
    // Timeout after 10s
    setTimeout(() => { clearInterval(interval); resolve(); }, 10000);
  });
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LiveDriverMap() {
  const { drivers, realtimeStatus } = useRealtimeDriverLocations();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // ── Init map ──
  useEffect(() => {
    if (!API_KEY) return;
    waitForMaps().then(() => {
      if (!mapRef.current || mapInstanceRef.current) return;
      const map = new google.maps.Map(mapRef.current, {
        center: PHOENIX_CENTER,
        zoom: DEFAULT_ZOOM,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f172a" }] },
          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#334155" }] },
          { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
          { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c1222" }] },
          { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1e3a5f" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
          { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
        ],
      });
      mapInstanceRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();
      setMapReady(true);
    });
  }, []);

  // ── Build SVG marker icon ──
  const makeIcon = useCallback((initials: string, color: string, isSelected: boolean) => {
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
      </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, size + 10),
      anchor: new google.maps.Point(size / 2, size + 10),
    };
  }, []);

  // ── Sync markers with driver data ──
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentIds = new Set(drivers.map(d => d.driver_id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    drivers.forEach(driver => {
      if (!driver.latitude || !driver.longitude) return;
      const name = driver.driver_name ?? "Driver";
      const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
      const color = statusColor(driver.load_status);
      const isSelected = selectedDriverId === driver.driver_id;
      const position = { lat: driver.latitude, lng: driver.longitude };

      let marker = markersRef.current.get(driver.driver_id);
      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position,
          title: name,
          icon: makeIcon(initials, color, isSelected),
          zIndex: isSelected ? 999 : 1,
          optimized: false,
        });

        marker.addListener("click", () => {
          setSelectedDriverId(prev => prev === driver.driver_id ? null : driver.driver_id);
          if (infoWindowRef.current) {
            const lastSeen = driver.recorded_at
              ? new Date(driver.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Unknown";
            infoWindowRef.current.setContent(`
              <div style="background:#1e293b;color:#f1f5f9;padding:10px 14px;border-radius:10px;min-width:160px;font-family:system-ui,sans-serif;">
                <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${name}</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Last ping: ${lastSeen}</div>
                ${driver.active_load_id
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
        marker.setPosition(position);
        marker.setIcon(makeIcon(initials, color, isSelected));
        marker.setZIndex(isSelected ? 999 : 1);
      }
    });

    // Auto-fit bounds if drivers exist
    if (drivers.length > 0 && drivers.length <= 20) {
      const bounds = new google.maps.LatLngBounds();
      drivers.forEach(d => {
        if (d.latitude && d.longitude) bounds.extend({ lat: d.latitude, lng: d.longitude });
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
        if (drivers.length === 1) map.setZoom(14);
      }
    }
  }, [drivers, mapReady, selectedDriverId, makeIcon]);

  // ── Status dot ──
  const statusDot = {
    connected:    { color: "bg-emerald-400", label: "Live" },
    reconnecting: { color: "bg-amber-400",   label: "Reconnecting" },
    disconnected: { color: "bg-red-400",      label: "Disconnected" },
  }[realtimeStatus];

  if (!API_KEY) {
    return (
      <div className="absolute inset-0 bg-[hsl(224,40%,4%)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="p-4 rounded-full bg-primary/10 border border-primary/20 w-16 h-16 flex items-center justify-center mx-auto">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Live Driver Map</p>
            <p className="text-xs text-muted-foreground">
              Add <code className="text-primary text-[10px]">VITE_GOOGLE_MAPS_KEY</code> to enable
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {/* Google Maps container */}
      <div ref={mapRef} className="absolute inset-0 w-full h-full" />

      {/* Loading overlay */}
      {!mapReady && (
        <div className="absolute inset-0 bg-[hsl(224,40%,4%)] flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-primary/20 animate-ping" style={{ animationDelay: "0.3s" }} />
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
            const color = statusColor(driver.load_status);
            return (
              <div
                key={driver.driver_id}
                className={`flex items-center gap-2 backdrop-blur-sm rounded-lg px-3 py-1.5 border cursor-pointer transition-all ${
                  isSelected
                    ? "bg-white/10 border-white/30"
                    : "bg-black/60 border-white/10 hover:bg-black/75"
                }`}
                onClick={() => setSelectedDriverId(isSelected ? null : driver.driver_id)}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
                </span>
                <span className="text-[11px] font-medium text-white">{driver.driver_name ?? "Driver"}</span>
                {driver.active_load_id && (
                  <span className="text-[9px] text-blue-300 font-semibold">ON LOAD</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No drivers state */}
      {mapReady && drivers.length === 0 && (
        <div className="absolute bottom-16 left-4 z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">No active drivers</p>
          </div>
        </div>
      )}

      {/* Live indicator */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10 pointer-events-none">
        <span className="relative flex h-2 w-2">
          {realtimeStatus === "connected" && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusDot.color} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${statusDot.color}`} />
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
