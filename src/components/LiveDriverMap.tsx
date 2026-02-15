import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, RefreshCw, Wifi, WifiOff, Truck, Clock } from "lucide-react";
import type { DriverGPS as OnfleetGPS } from "@/integrations/onfleet/client";
import type { DriverGPS as OT360GPS } from "@/integrations/ontime360/client";

// ─── Types ─────────────────────────────────────────────

type DriverPin = {
    id: string;
    name: string;
    lat: number;
    lng: number;
    status: "active" | "idle" | "offline";
    lastSeen: string; // human-readable
    source: "onfleet" | "ontime360" | "manual" | "own";
    eta?: string;
};

interface LiveDriverMapProps {
    drivers: DriverPin[];
    loading?: boolean;
    onRefresh?: () => void;
    pollActive?: boolean;
}

// ─── Hub center coordinates ────────────────────────────
const HUB_CENTERS: Record<string, { lat: number; lng: number; label: string }> = {
    phoenix: { lat: 33.4484, lng: -112.074, label: "Phoenix" },
    la: { lat: 34.0522, lng: -118.2437, label: "Los Angeles" },
    atlanta: { lat: 33.749, lng: -84.388, label: "Atlanta" },
};

// ─── Utility: time ago ─────────────────────────────────
function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
}

// ─── Component ─────────────────────────────────────────

export default function LiveDriverMap({ drivers, loading, onRefresh, pollActive }: LiveDriverMapProps) {
    const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
    const [hub, setHub] = useState<string>("phoenix");
    const canvasRef = useRef<HTMLDivElement>(null);

    const center = HUB_CENTERS[hub] ?? HUB_CENTERS.phoenix;
    const activeDrivers = drivers.filter((d) => d.status === "active");
    const idleDrivers = drivers.filter((d) => d.status === "idle");

    // Map drivers to relative positions within the view
    const mapDriverPosition = useCallback(
        (driver: DriverPin) => {
            // Scale: ~0.5 degrees of lat/lng covers ~35 miles
            const scale = 800; // pixels per degree
            const x = (driver.lng - center.lng) * scale + 50; // 50% center offset
            const y = (center.lat - driver.lat) * scale + 50;
            return {
                left: `${Math.min(95, Math.max(5, x))}%`,
                top: `${Math.min(90, Math.max(5, y))}%`,
            };
        },
        [center],
    );

    const selected = drivers.find((d) => d.id === selectedDriver);

    return (
        <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">Live Driver Map</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                            {pollActive ? (
                                <><Wifi className="h-2.5 w-2.5 text-green-500" /> Live</>
                            ) : (
                                <><WifiOff className="h-2.5 w-2.5 text-muted-foreground" /> Paused</>
                            )}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Hub Switcher */}
                        <div className="flex gap-1">
                            {Object.entries(HUB_CENTERS).map(([key, val]) => (
                                <Button
                                    key={key}
                                    variant={hub === key ? "default" : "ghost"}
                                    size="sm"
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => setHub(key)}
                                >
                                    {val.label}
                                </Button>
                            ))}
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRefresh} disabled={loading}>
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </div>

                {/* ── Map Area ── */}
                <div
                    ref={canvasRef}
                    className="relative h-[320px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden"
                >
                    {/* Background grid */}
                    <div className="absolute inset-0 opacity-10">
                        <svg width="100%" height="100%">
                            <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                    </div>

                    {/* Center hub marker */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div className="relative">
                            <div className="h-6 w-6 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center animate-pulse">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary whitespace-nowrap">
                                {HUB_CENTERS[hub]?.label} HQ
                            </span>
                        </div>
                    </div>

                    {/* Range rings */}
                    {[100, 200, 300].map((r) => (
                        <div
                            key={r}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5"
                            style={{ width: `${r}px`, height: `${r}px` }}
                        />
                    ))}

                    {/* Driver pins */}
                    {drivers.map((d) => {
                        const pos = mapDriverPosition(d);
                        const isSelected = selectedDriver === d.id;
                        return (
                            <button
                                key={d.id}
                                className={`absolute z-20 group transition-all duration-300 ${isSelected ? "z-30 scale-125" : "hover:scale-110 hover:z-30"}`}
                                style={{ left: pos.left, top: pos.top, transform: "translate(-50%, -50%)" }}
                                onClick={() => setSelectedDriver(isSelected ? null : d.id)}
                            >
                                <div
                                    className={`relative h-8 w-8 rounded-full flex items-center justify-center shadow-lg border-2 transition-colors
                    ${d.status === "active"
                                            ? "bg-green-500 border-green-300 shadow-green-500/30"
                                            : d.status === "idle"
                                                ? "bg-yellow-500 border-yellow-300 shadow-yellow-500/30"
                                                : "bg-gray-500 border-gray-400 shadow-gray-500/20"
                                        }
                    ${isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""}
                  `}
                                >
                                    <Truck className="h-3.5 w-3.5 text-white" />
                                    {/* Ping animation for active */}
                                    {d.status === "active" && (
                                        <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
                                    )}
                                </div>
                                {/* Tooltip */}
                                <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium transition-opacity
                  ${isSelected ? "text-white opacity-100" : "text-white/60 opacity-0 group-hover:opacity-100"}`}>
                                    {d.name}
                                </div>
                            </button>
                        );
                    })}

                    {/* Empty state */}
                    {drivers.length === 0 && !loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                            <MapPin className="h-8 w-8 mb-2" />
                            <p className="text-sm">No live driver locations</p>
                            <p className="text-xs mt-1">Connect Onfleet or OnTime 360 to see drivers in real-time</p>
                        </div>
                    )}

                    {/* Loading overlay */}
                    {loading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-40">
                            <RefreshCw className="h-6 w-6 text-white animate-spin" />
                        </div>
                    )}
                </div>

                {/* ── Driver Detail Panel ── */}
                {selected && (
                    <div className="px-4 py-3 border-t bg-muted/20 animate-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold
                    ${selected.status === "active" ? "bg-green-500" : "bg-yellow-500"}`}
                                >
                                    {selected.name.split(" ").map((n) => n[0]).join("")}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">{selected.name}</p>
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-2.5 w-2.5" /> {selected.lastSeen}
                                        <span className="mx-1">·</span>
                                        <Badge variant="outline" className="text-[9px] px-1 py-0">{selected.source}</Badge>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <Badge className={`text-[10px] ${selected.status === "active" ? "bg-green-500/15 text-green-600 border-green-500/30" : "bg-yellow-500/15 text-yellow-600 border-yellow-500/30"}`}>
                                    {selected.status === "active" ? "🟢 In Transit" : "🟡 Idle"}
                                </Badge>
                                {selected.eta && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">ETA: {selected.eta}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Summary Bar ── */}
                <div className="flex items-center gap-4 px-4 py-2.5 border-t bg-muted/10 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-green-500" /> {activeDrivers.length} active
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" /> {idleDrivers.length} idle
                    </span>
                    <span className="flex-1" />
                    <span>{drivers.length} total drivers</span>
                </div>
            </CardContent>
        </Card>
    );
}
