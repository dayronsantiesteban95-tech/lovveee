import { useState, useEffect, useRef, useCallback } from "react";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Truck } from "lucide-react";

// ─── Types ────────────────────────────────────────────

interface DriverLocation {
    id: string;
    driver_id: string;
    driver_name: string | null;
    latitude: number;
    longitude: number;
    recorded_at: string;
    active_load_id: string | null;
}

// ─── Constants ────────────────────────────────────────

const PHOENIX_CENTER = { lat: 33.4484, lng: -112.074 };
const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

// Google Maps Aubergine / Dark night theme
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
    { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
    { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
    { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#334e87" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#023e58" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
    { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
    { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3C7680" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
    { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0d5ce" }] },
    { featureType: "road.highway", elementType: "labels.text.stroke", stylers: [{ color: "#023747" }] },
    { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
    { featureType: "transit", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
    { featureType: "transit.line", elementType: "geometry.fill", stylers: [{ color: "#283d6a" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#3a4762" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
];

const MAP_OPTIONS: google.maps.MapOptions = {
    styles: DARK_MAP_STYLES,
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    backgroundColor: "#1d2c4d",
};

// ─── Driver Marker ─────────────────────────────────────

function DriverMarker({
    driver,
    isSelected,
    onClick,
}: {
    driver: DriverLocation;
    isSelected: boolean;
    onClick: () => void;
}) {
    const name = driver.driver_name ?? "Driver";
    const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

    return (
        <OverlayView
            position={{ lat: driver.latitude, lng: driver.longitude }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
            <div
                className="relative flex flex-col items-center cursor-pointer group"
                style={{ transform: "translate(-50%, -100%)" }}
                onClick={onClick}
            >
                {/* Tooltip */}
                <div
                    className={`
                        absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap
                        px-2 py-1 rounded text-[10px] font-semibold text-white
                        bg-gray-900/90 border border-white/20 shadow-lg backdrop-blur-sm
                        transition-opacity duration-150
                        ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
                    `}
                >
                    {name}
                    {driver.active_load_id && (
                        <span className="ml-1 text-blue-400">• On Load</span>
                    )}
                </div>

                {/* Marker body */}
                <div
                    className={`
                        relative h-9 w-9 rounded-full flex items-center justify-center
                        text-white text-xs font-bold shadow-lg border-2 transition-all duration-200
                        ${isSelected
                            ? "border-white ring-2 ring-white/40 scale-110"
                            : "border-emerald-300 hover:scale-110"
                        }
                        bg-emerald-500 shadow-emerald-500/40
                    `}
                >
                    {initials}
                    {/* Ping animation */}
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
                </div>

                {/* Pin tail */}
                <div
                    className="w-0 h-0"
                    style={{
                        borderLeft: "5px solid transparent",
                        borderRight: "5px solid transparent",
                        borderTop: "7px solid #10b981",
                    }}
                />
            </div>
        </OverlayView>
    );
}

// ─── Main Component ────────────────────────────────────

export default function LiveDriverMap() {
    const [drivers, setDrivers] = useState<DriverLocation[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);

    const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? "";

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: apiKey,
        id: "anika-google-map",
    });

    // ── Load active driver locations ──
    const fetchDriverLocations = useCallback(async () => {
        try {
            const cutoff = new Date(Date.now() - ACTIVE_THRESHOLD_MS).toISOString();

            // Use the RPC function which joins driver_name properly
            const { data: rpcData, error: rpcError } = await supabase
                .rpc("get_driver_positions");

            if (!rpcError && rpcData) {
                // RPC succeeded — map to DriverLocation shape
                const deduped: DriverLocation[] = (rpcData ?? []).map((row: {
                    driver_id: string;
                    driver_name: string | null;
                    latitude: number;
                    longitude: number;
                    recorded_at: string;
                    active_load_id: string | null;
                }) => ({
                    id: row.driver_id,
                    driver_id: row.driver_id,
                    driver_name: row.driver_name,
                    latitude: row.latitude,
                    longitude: row.longitude,
                    recorded_at: row.recorded_at,
                    active_load_id: row.active_load_id,
                }));
                setDrivers(deduped);
                return;
            }

            // Fallback: query driver_locations directly and join with drivers
            const { data, error } = await supabase
                .from("driver_locations")
                .select("id, driver_id, latitude, longitude, recorded_at")
                .gte("recorded_at", cutoff)
                .order("recorded_at", { ascending: false });

            if (error) {
                return;
            }

            // Deduplicate: keep only most recent record per driver
            const seen = new Set<string>();
            const deduped: DriverLocation[] = [];
            for (const row of (data ?? [])) {
                if (!seen.has(row.driver_id)) {
                    seen.add(row.driver_id);
                    deduped.push({
                        ...row,
                        driver_name: null, // No join available in fallback
                        active_load_id: null,
                    } as DriverLocation);
                }
            }
            setDrivers(deduped);
        } catch {
            // Never crash the map — network or other unexpected errors
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchDriverLocations();
    }, [fetchDriverLocations]);

    // ── Supabase Realtime subscription ──
    useEffect(() => {
        const channel = supabase
            .channel("driver-locations-live")
            .on(
                "postgres_changes" as any,
                { event: "*", schema: "public", table: "driver_locations" },
                () => { fetchDriverLocations(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchDriverLocations]);

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    // ── No API key — show static placeholder ──
    if (!apiKey) {
        return (
            <div className="absolute inset-0 bg-[hsl(224,40%,4%)] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `
                            linear-gradient(hsl(222 84% 55% / 0.3) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(222 84% 55% / 0.3) 1px, transparent 1px)
                        `,
                        backgroundSize: '60px 60px',
                    }}
                />
                <div className="relative z-10 text-center space-y-4">
                    <div className="p-4 rounded-full bg-primary/10 border border-primary/20 w-16 h-16 flex items-center justify-center mx-auto">
                        <Truck className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">Live Driver Map</p>
                        <p className="text-xs text-muted-foreground">
                            Add <code className="text-primary text-[10px]">VITE_GOOGLE_MAPS_KEY</code> to enable
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                        </span>
                        {drivers.length} driver{drivers.length !== 1 ? "s" : ""} tracked
                    </div>
                </div>
            </div>
        );
    }

    // ── Loading / Error states ──
    if (loadError) {
        return (
            <div className="absolute inset-0 bg-[hsl(224,40%,4%)] flex items-center justify-center">
                <div className="text-center space-y-2">
                    <MapPin className="h-8 w-8 text-red-400 mx-auto" />
                    <p className="text-sm text-red-400 font-medium">Map failed to load</p>
                    <p className="text-xs text-muted-foreground">{loadError.message}</p>
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="absolute inset-0 bg-[hsl(224,40%,4%)] flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="relative mx-auto w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    </div>
                    <p className="text-xs text-muted-foreground">Loading map…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0">
            <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={PHOENIX_CENTER}
                zoom={11}
                options={MAP_OPTIONS}
                onLoad={onMapLoad}
            >
                {drivers.map((driver) => (
                    <DriverMarker
                        key={driver.id}
                        driver={driver}
                        isSelected={selectedDriverId === driver.driver_id}
                        onClick={() =>
                            setSelectedDriverId(
                                selectedDriverId === driver.driver_id ? null : driver.driver_id
                            )
                        }
                    />
                ))}
            </GoogleMap>

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
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10 pointer-events-none">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-[10px] font-medium text-white/70">
                    {drivers.length} driver{drivers.length !== 1 ? "s" : ""} live
                </span>
            </div>
        </div>
    );
}
