/**
 * -----------------------------------------------------------
 * ROUTE OPTIMIZER PANEL -- Smart Load Ordering
 *
 * Dispatchers use this to optimize the delivery order for a driver.
 * Calculates optimal route using TSP nearest-neighbor + 2-opt,
 * shows savings vs current order and estimated arrival times.
 *
 * Zero cost -- all calculations run client-side using Haversine.
 * -----------------------------------------------------------
 */
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
    Route, Zap, MapPin, ArrowDown, Clock, TrendingDown,
    ChevronRight, Truck, RefreshCw, Copy, ExternalLink,
} from "lucide-react";
import { optimizeRoute, geocodeAddress, type RoutePoint, type OptimizedRoute } from "@/hooks/useRouteOptimizer";

// --- Types ---------------------------------------------

interface LoadForRoute {
    id: string;
    client_name: string | null;
    delivery_address: string | null;
    pickup_address: string | null;
    delivery_lat: number | null;
    delivery_lng: number | null;
    status: string;
    packages: number;
    tracking_token: string | null;
}

interface RouteOptimizerPanelProps {
    loads: LoadForRoute[];
    driverName?: string;
    shiftStart?: string;  // HH:MM
    onRouteApplied?: (orderedIds: string[]) => void;
}

export default function RouteOptimizerPanel({
    loads, driverName, shiftStart = "08:00", onRouteApplied,
}: RouteOptimizerPanelProps) {
    const { toast } = useToast();
    const [optimized, setOptimized] = useState<OptimizedRoute | null>(null);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);

    // Filter to deliverable loads only
    const deliverableLoads = useMemo(
        () => loads.filter((l) =>
            l.delivery_address && l.status !== "delivered" && l.status !== "cancelled",
        ),
        [loads],
    );

    const handleOptimize = async () => {
        setLoading(true);

        // Geocode any loads missing coordinates
        const points: RoutePoint[] = [];
        for (const load of deliverableLoads) {
            let lat = load.delivery_lat;
            let lng = load.delivery_lng;

            if ((lat === null || lng === null) && load.delivery_address) {
                const coords = await geocodeAddress(load.delivery_address);
                if (coords) {
                    lat = coords.lat;
                    lng = coords.lng;
                    // Save geocoded coordinates back to DB
                    await supabase.from("daily_loads").update({
                        delivery_lat: lat,
                        delivery_lng: lng,
                    }).eq("id", load.id);
                }
                // Rate limit (Nominatim: 1 req/sec)
                await new Promise((r) => setTimeout(r, 1100));
            }

            if (lat !== null && lng !== null) {
                points.push({
                    id: load.id,
                    label: load.client_name ?? load.delivery_address ?? "Unknown",
                    lat,
                    lng,
                });
            }
        }

        if (points.length < 2) {
            toast({ title: "Need more stops", description: "At least 2 deliverable loads with addresses are required." });
            setLoading(false);
            return;
        }

        const result = optimizeRoute(points, { startTime: shiftStart });
        setOptimized(result);
        setLoading(false);

        toast({
            title: `??? Route optimized!`,
            description: `${result.savingsVsOriginalMiles > 0
                ? `Saves ${result.savingsVsOriginalMiles} miles vs current order`
                : "Route is already near-optimal"
                }`,
        });
    };

    const handleApply = async () => {
        if (!optimized) return;
        setApplying(true);

        // Update route_order and estimated_arrival for each load
        for (const stop of optimized.stops) {
            await supabase.from("daily_loads").update({
                route_order: stop.order,
                estimated_arrival: stop.estimatedArrival,
            }).eq("id", stop.id);
        }

        toast({ title: "? Route applied", description: "Load order and ETAs updated in the load board." });
        setApplying(false);
        onRouteApplied?.(optimized.stops.map((s) => s.id));
    };

    const copyTrackingLink = (token: string | null) => {
        if (!token) return;
        const url = `${window.location.origin}/track/${token}`;
        navigator.clipboard.writeText(url);
        toast({ title: "?? Copied", description: `Tracking link copied: ${url}` });
    };

    return (
        <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Route className="h-4 w-4 text-primary" />
                        Route Optimizer
                    </h3>
                    <Badge variant="secondary" className="text-[10px]">
                        {deliverableLoads.length} stops
                    </Badge>
                </div>

                {driverName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Truck className="h-3 w-3" /> {driverName} ? Shift starts {shiftStart}
                    </p>
                )}

                {/* Optimize Button */}
                <Button
                    onClick={handleOptimize}
                    disabled={loading || deliverableLoads.length < 2}
                    className="w-full gap-2"
                    variant={optimized ? "outline" : "default"}
                >
                    {loading ? (
                        <><RefreshCw className="h-4 w-4 animate-spin" /> Geocoding & optimizing...</>
                    ) : optimized ? (
                        <><Zap className="h-4 w-4" /> Re-optimize</>
                    ) : (
                        <><Zap className="h-4 w-4" /> Optimize Route</>
                    )}
                </Button>

                {deliverableLoads.length < 2 && (
                    <p className="text-xs text-muted-foreground text-center">
                        Need at least 2 active loads with addresses
                    </p>
                )}

                {/* Optimized Result */}
                {optimized && (
                    <div className="space-y-3 mt-2">
                        {/* Savings Summary */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground">Distance</p>
                                <p className="text-sm font-bold">{optimized.totalDistanceMiles} mi</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground">Duration</p>
                                <p className="text-sm font-bold">
                                    {Math.floor(optimized.totalDurationMinutes / 60)}h {optimized.totalDurationMinutes % 60}m
                                </p>
                            </div>
                            <div className={`p-2 rounded-lg ${optimized.savingsVsOriginalMiles > 0 ? "bg-green-500/10" : "bg-muted/30"}`}>
                                <p className="text-xs text-muted-foreground">Saved</p>
                                <p className={`text-sm font-bold ${optimized.savingsVsOriginalMiles > 0 ? "text-green-600" : ""}`}>
                                    {optimized.savingsVsOriginalMiles > 0 ? (
                                        <span className="flex items-center justify-center gap-0.5">
                                            <TrendingDown className="h-3 w-3" /> {optimized.savingsVsOriginalMiles} mi
                                        </span>
                                    ) : "--"}
                                </p>
                            </div>
                        </div>

                        {/* Ordered Stop List */}
                        <div className="space-y-1">
                            {optimized.stops.map((stop, i) => {
                                const load = loads.find((l) => l.id === stop.id);
                                return (
                                    <div key={stop.id}>
                                        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors text-xs">
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">
                                                {stop.order}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{stop.label}</p>
                                                <p className="text-muted-foreground">
                                                    {stop.distanceFromPrev > 0 && `${stop.distanceFromPrev} mi ? `}
                                                    ETA {stop.estimatedArrival}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Badge variant="outline" className="text-[9px]">
                                                    <Clock className="h-2.5 w-2.5 mr-0.5" /> {stop.estimatedArrival}
                                                </Badge>
                                                {load?.tracking_token && (
                                                    <Button
                                                        variant="ghost" size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => copyTrackingLink(load.tracking_token)}
                                                    >
                                                        <Copy className="h-3 w-3 text-muted-foreground" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {i < optimized.stops.length - 1 && (
                                            <div className="flex items-center gap-2 pl-5 py-0.5">
                                                <ArrowDown className="h-3 w-3 text-muted-foreground/30" />
                                                <span className="text-[10px] text-muted-foreground/40">
                                                    {optimized.stops[i + 1].distanceFromPrev} mi
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Apply Route */}
                        <Button
                            onClick={handleApply}
                            disabled={applying}
                            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                        >
                            {applying ? (
                                <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
                            ) : (
                                <><ChevronRight className="h-4 w-4" /> Apply Route Order & ETAs</>
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
