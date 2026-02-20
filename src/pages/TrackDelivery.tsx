/**
 * -----------------------------------------------------------
 * TRACK DELIVERY -- Public Customer Tracking Page
 *
 * Customers receive a link like: yoursite.com/track/ANK-A1B2C3
 * They can see delivery status, driver location, and ETA
 * WITHOUT logging in.
 *
 * This is your FedEx/UPS tracking page -- but branded for Anika.
 * -----------------------------------------------------------
 */
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Package, Truck, MapPin, CheckCircle2, Clock, Navigation,
    ArrowRight, Search, ShieldCheck, RefreshCw, Phone,
} from "lucide-react";

// --- Types ---------------------------------------------

interface TrackingData {
    found: boolean;
    reference_number?: string;
    status?: string;
    service_type?: string;
    packages?: number;
    pickup_address?: string;
    delivery_address?: string;
    customer_name?: string;
    estimated_arrival?: string;
    load_date?: string;
    start_time?: string;
    end_time?: string;
    pod_confirmed?: boolean;
    wait_time_minutes?: number;
    driver_name?: string;
    hub?: string;
    driver_lat?: number;
    driver_lng?: number;
    driver_speed?: number;
    driver_heading?: number;
    driver_last_seen?: string;
    status_history?: { status: string; timestamp: string; note?: string }[];
}

const STATUS_STEPS = [
    { key: "assigned", label: "Order Confirmed", icon: Package, desc: "Your delivery has been scheduled" },
    { key: "picked_up", label: "Picked Up", icon: Truck, desc: "Package collected from origin" },
    { key: "in_progress", label: "In Transit", icon: Navigation, desc: "Driver is on the way" },
    { key: "delivered", label: "Delivered", icon: CheckCircle2, desc: "Package delivered successfully" },
];

function getStatusIdx(status: string): number {
    const idx = STATUS_STEPS.findIndex((s) => s.key === status);
    return idx >= 0 ? idx : 0;
}

function formatTime(t: string | null | undefined): string {
    if (!t) return "--";
    if (t.length === 5) {
        const [h, m] = t.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
    }
    return t;
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
}

// -----------------------------------------------------------
export default function TrackDelivery() {
    const { token: urlToken } = useParams<{ token?: string }>();
    const [token, setToken] = useState(urlToken ?? "");
    const [searchInput, setSearchInput] = useState(urlToken ?? "");
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTracking = useCallback(async (t: string) => {
        if (!t.trim()) return;
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase.rpc("get_tracking_info", { p_token: t.trim().toUpperCase() }) as {
            data: TrackingData | null;
            error: any;
        };

        if (err) {
            setError("Unable to look up tracking. Please try again.");
            setLoading(false);
            return;
        }

        if (!data || !data.found) {
            setError("Tracking number not found. Please check and try again.");
            setTracking(null);
        } else {
            setTracking(data);
            setToken(t.trim().toUpperCase());
        }
        setLoading(false);
    }, []);

    // Auto-fetch if URL has token
    useEffect(() => {
        if (urlToken) fetchTracking(urlToken);
    }, [urlToken, fetchTracking]);

    // Auto-refresh every 30 seconds when tracking is active
    useEffect(() => {
        if (!tracking || !token) return;
        const interval = setInterval(() => fetchTracking(token), 30_000);
        return () => clearInterval(interval);
    }, [tracking, token, fetchTracking]);

    const currentStep = tracking ? getStatusIdx(tracking.status ?? "assigned") : 0;
    const isDelivered = tracking?.status === "delivered";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* -- Header -- */}
            <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                            <Truck className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white">Anika Logistics</h1>
                            <p className="text-[10px] text-white/40">Track Your Delivery</p>
                        </div>
                    </div>
                    {tracking && (
                        <Button
                            variant="ghost" size="sm"
                            className="text-white/60 hover:text-white text-xs gap-1"
                            onClick={() => fetchTracking(token)}
                        >
                            <RefreshCw className="h-3 w-3" /> Refresh
                        </Button>
                    )}
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

                {/* -- Search Bar -- */}
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white text-center">
                        {tracking ? "Delivery Status" : "Track Your Delivery"}
                    </h2>
                    {!tracking && (
                        <p className="text-sm text-white/50 text-center">
                            Enter your tracking number to see real-time delivery status
                        </p>
                    )}
                    <div className="flex gap-2 max-w-md mx-auto mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                            <Input
                                placeholder="ANK-XXXXXX"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === "Enter" && fetchTracking(searchInput)}
                                className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/30 h-11 text-sm uppercase tracking-wider"
                            />
                        </div>
                        <Button
                            onClick={() => fetchTracking(searchInput)}
                            disabled={loading || !searchInput.trim()}
                            className="bg-violet-600 hover:bg-violet-700 h-11 px-6"
                        >
                            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Track"}
                        </Button>
                    </div>
                </div>

                {/* -- Error -- */}
                {error && (
                    <Card className="border-red-500/30 bg-red-500/10 border">
                        <CardContent className="py-4 text-center">
                            <p className="text-sm text-red-400">{error}</p>
                        </CardContent>
                    </Card>
                )}

                {/* -- Tracking Result -- */}
                {tracking && (
                    <>
                        {/* Status Header */}
                        <Card className="border-0 bg-white/5 backdrop-blur-sm overflow-hidden">
                            <div className={`h-1.5 ${isDelivered ? "bg-green-500" : "bg-gradient-to-r from-violet-500 to-indigo-500"}`} />
                            <CardContent className="pt-5 pb-4 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-white/40 font-mono">{token}</p>
                                        <h3 className="text-lg font-bold text-white mt-1">
                                            {isDelivered ? "? Delivered!" : STATUS_STEPS[currentStep].desc}
                                        </h3>
                                        {tracking.customer_name && (
                                            <p className="text-sm text-white/60 mt-0.5">For {tracking.customer_name}</p>
                                        )}
                                    </div>
                                    <Badge className={`${isDelivered
                                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                                        : "bg-violet-500/20 text-violet-400 border-violet-500/30"
                                        } text-xs`}
                                    >
                                        {STATUS_STEPS[currentStep].label}
                                    </Badge>
                                </div>

                                {/* Progress Steps */}
                                <div className="flex items-center justify-between mt-4">
                                    {STATUS_STEPS.map((step, i) => {
                                        const isComplete = i <= currentStep;
                                        const isCurrent = i === currentStep;
                                        const Icon = step.icon;

                                        return (
                                            <div key={step.key} className="flex items-center flex-1">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className={`
                            h-10 w-10 rounded-full flex items-center justify-center transition-all
                            ${isComplete
                                                            ? isCurrent
                                                                ? "bg-violet-500 ring-4 ring-violet-500/30"
                                                                : "bg-green-500"
                                                            : "bg-white/10"
                                                        }
                          `}>
                                                        <Icon className={`h-4 w-4 ${isComplete ? "text-white" : "text-white/30"}`} />
                                                    </div>
                                                    <span className={`text-[10px] ${isComplete ? "text-white/80" : "text-white/30"} text-center leading-tight`}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                                {i < STATUS_STEPS.length - 1 && (
                                                    <div className={`flex-1 h-0.5 mx-2 mb-4 ${i < currentStep ? "bg-green-500" : "bg-white/10"}`} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* ETA */}
                            {!isDelivered && tracking.estimated_arrival && (
                                <Card className="border-0 bg-white/5 col-span-2">
                                    <CardContent className="py-4 flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                            <Clock className="h-6 w-6 text-violet-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-white/40">Estimated Arrival</p>
                                            <p className="text-2xl font-bold text-white">{formatTime(tracking.estimated_arrival)}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Driver */}
                            {tracking.driver_name && (
                                <Card className="border-0 bg-white/5">
                                    <CardContent className="py-3">
                                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Driver</p>
                                        <p className="text-sm font-semibold text-white mt-1">{tracking.driver_name}</p>
                                        {tracking.driver_last_seen && tracking.status === "in_progress" && (
                                            <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                                                <Navigation className="h-2.5 w-2.5" />
                                                Last seen {timeAgo(tracking.driver_last_seen)}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Packages */}
                            <Card className="border-0 bg-white/5">
                                <CardContent className="py-3">
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Packages</p>
                                    <p className="text-sm font-semibold text-white mt-1">{tracking.packages ?? 1} items</p>
                                    <p className="text-[10px] text-white/30 mt-1">{tracking.service_type ?? "Standard"}</p>
                                </CardContent>
                            </Card>

                            {/* Delivery Address */}
                            {tracking.delivery_address && (
                                <Card className="border-0 bg-white/5 col-span-2">
                                    <CardContent className="py-3 flex items-start gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <MapPin className="h-4 w-4 text-green-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Delivering To</p>
                                            <p className="text-sm text-white mt-1">{tracking.delivery_address}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* POD Confirmation */}
                            {isDelivered && tracking.pod_confirmed && (
                                <Card className="border-0 bg-green-500/10 col-span-2">
                                    <CardContent className="py-3 flex items-center gap-3">
                                        <ShieldCheck className="h-6 w-6 text-green-400" />
                                        <div>
                                            <p className="text-sm font-semibold text-green-400">Proof of Delivery Confirmed</p>
                                            <p className="text-xs text-green-400/60">
                                                Delivered at {formatTime(tracking.end_time)}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Live Driver Map (simplified radar) */}
                        {tracking.driver_lat && tracking.driver_lng && tracking.status === "in_progress" && (
                            <Card className="border-0 bg-white/5 overflow-hidden">
                                <CardContent className="py-4">
                                    <h4 className="text-xs text-white/40 uppercase tracking-wider mb-3">Live Driver Location</h4>
                                    <div className="relative h-48 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden">
                                        {/* Animated radar circles */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="absolute h-32 w-32 rounded-full border border-violet-500/20 animate-ping" style={{ animationDuration: "3s" }} />
                                            <div className="absolute h-24 w-24 rounded-full border border-violet-500/15" />
                                            <div className="absolute h-16 w-16 rounded-full border border-violet-500/10" />
                                            {/* Driver dot */}
                                            <div className="relative z-10">
                                                <div className="h-4 w-4 rounded-full bg-green-500 ring-4 ring-green-500/30" />
                                            </div>
                                        </div>
                                        {/* Speed indicator */}
                                        {tracking.driver_speed !== null && tracking.driver_speed !== undefined && (
                                            <div className="absolute bottom-2 right-2 text-[10px] text-white/40 bg-black/30 px-2 py-1 rounded-full">
                                                {Math.round(tracking.driver_speed * 2.237)} mph
                                            </div>
                                        )}
                                        {/* Last update */}
                                        {tracking.driver_last_seen && (
                                            <div className="absolute bottom-2 left-2 text-[10px] text-white/40 bg-black/30 px-2 py-1 rounded-full flex items-center gap-1">
                                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                                Live ? {timeAgo(tracking.driver_last_seen)}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Status History */}
                        {tracking.status_history && tracking.status_history.length > 0 && (
                            <Card className="border-0 bg-white/5">
                                <CardContent className="py-4">
                                    <h4 className="text-xs text-white/40 uppercase tracking-wider mb-3">Tracking History</h4>
                                    <div className="space-y-3">
                                        {tracking.status_history.map((evt, i) => {
                                            const step = STATUS_STEPS.find((s) => s.key === evt.status);
                                            const Icon = step?.icon ?? Package;
                                            return (
                                                <div key={i} className="flex items-start gap-3">
                                                    <div className="relative">
                                                        <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
                                                            <Icon className="h-3 w-3 text-white/60" />
                                                        </div>
                                                        {i < tracking.status_history!.length - 1 && (
                                                            <div className="absolute top-7 left-3.5 w-px h-5 bg-white/10" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-white/80">{step?.label ?? evt.status}</p>
                                                        <p className="text-[10px] text-white/30">
                                                            {new Date(evt.timestamp).toLocaleString("en-US", {
                                                                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                                                            })}
                                                        </p>
                                                        {evt.note && (
                                                            <p className="text-xs text-white/50 mt-0.5 italic">"{evt.note}"</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Contact */}
                        <Card className="border-0 bg-white/5">
                            <CardContent className="py-4 text-center space-y-2">
                                <p className="text-xs text-white/40">Need help with your delivery?</p>
                                <Button variant="outline" size="sm" className="border-white/20 text-white/70 hover:text-white gap-1.5">
                                    <Phone className="h-3 w-3" /> Contact Support
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}

                {/* Empty state (no search yet) */}
                {!tracking && !error && !loading && !urlToken && (
                    <div className="text-center pt-12 space-y-4">
                        <div className="h-20 w-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
                            <Package className="h-10 w-10 text-white/20" />
                        </div>
                        <p className="text-white/30 text-sm">
                            Enter your tracking number above to get started
                        </p>
                        <p className="text-white/20 text-xs">
                            Format: ANK-XXXXXX
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="border-t border-white/5 mt-12 py-6 text-center text-xs text-white/20">
                Powered by <span className="text-white/40 font-semibold">Anika Logistics</span> ? Real-time tracking
            </footer>
        </div>
    );
}
