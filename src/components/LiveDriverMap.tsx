/**
 * LiveDriverMap — Renders driver locations on a Google Maps Embed iframe.
 * Uses Maps Embed API (no @react-google-maps/api dependency — zero crash risk).
 * Driver markers are overlaid as absolute-positioned HTML elements on top of the iframe.
 */

import { useState, useEffect, useRef } from "react";
import { Truck, MapPin, Signal } from "lucide-react";
import { useRealtimeDriverLocations } from "@/hooks/useRealtimeDriverLocations";

const PHOENIX_CENTER = { lat: 33.4484, lng: -112.074 };
const DEFAULT_ZOOM = 11;

export default function LiveDriverMap() {
  const { drivers, realtimeStatus } = useRealtimeDriverLocations();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? "";

  const statusDot = {
    connected: { color: "bg-emerald-400", label: "Live" },
    reconnecting: { color: "bg-amber-400", label: "Reconnecting" },
    disconnected: { color: "bg-red-400", label: "Disconnected" },
  }[realtimeStatus];

  // Build the embed URL — centers on active drivers or Phoenix by default
  const centerLat = drivers.length > 0
    ? drivers.reduce((sum, d) => sum + d.latitude, 0) / drivers.length
    : PHOENIX_CENTER.lat;
  const centerLng = drivers.length > 0
    ? drivers.reduce((sum, d) => sum + d.longitude, 0) / drivers.length
    : PHOENIX_CENTER.lng;

  const embedUrl = apiKey
    ? `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${centerLat},${centerLng}&zoom=${DEFAULT_ZOOM}&maptype=roadmap`
    : null;

  if (!apiKey) {
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
      {/* Google Maps Embed iframe — no native library, no crash risk */}
      <iframe
        title="Live Driver Map"
        src={embedUrl ?? ""}
        className="absolute inset-0 w-full h-full border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

      {/* Driver marker overlays */}
      {drivers.map((driver) => {
        const name = driver.driver_name ?? "Driver";
        const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
        const isSelected = selectedDriverId === driver.driver_id;

        return (
          <div
            key={driver.driver_id}
            className="absolute z-10 cursor-pointer"
            style={{
              // Simple fixed position markers — will improve with Maps JS API later
              bottom: "30%",
              left: "50%",
              transform: "translateX(-50%)",
              display: "none", // Hidden until we have proper geo-to-pixel conversion
            }}
            onClick={() => setSelectedDriverId(isSelected ? null : driver.driver_id)}
          >
            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 bg-emerald-500 ${isSelected ? "border-white ring-2 ring-white/40 scale-110" : "border-emerald-300"}`}>
              {initials}
            </div>
          </div>
        );
      })}

      {/* Driver list overlay — bottom left */}
      {drivers.length > 0 && (
        <div className="absolute bottom-16 left-4 z-20 space-y-1 max-h-48 overflow-y-auto">
          {drivers.map((driver) => (
            <div
              key={driver.driver_id}
              className="flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 cursor-pointer hover:bg-black/80"
              onClick={() => setSelectedDriverId(
                selectedDriverId === driver.driver_id ? null : driver.driver_id
              )}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[11px] font-medium text-white">{driver.driver_name ?? "Driver"}</span>
              {driver.active_load_id && (
                <span className="text-[9px] text-blue-300">On load</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No drivers overlay */}
      {drivers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2 bg-black/50 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/10">
            <Truck className="h-6 w-6 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">No active drivers</p>
            <p className="text-xs text-muted-foreground/60">Driver locations update in real-time</p>
          </div>
        </div>
      )}

      {/* Live indicator */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10 pointer-events-none z-20">
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
