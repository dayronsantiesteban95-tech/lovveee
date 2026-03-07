/**
 * -----------------------------------------------------------
 * CLIENT PORTAL -- Company-Level Load Tracking Page
 *
 * A client like "PGL Aero Team" gets ONE URL that shows ALL
 * their active and recent loads (last 60 days) WITHOUT login.
 *
 * URL pattern: /portal/:token  (e.g. /portal/CPT-ABCDEF1234567890)
 *
 * Dispatcher generates this link from the LoadDetailPanel.
 * One link per client company -- works for all their loads.
 * -----------------------------------------------------------
 */
import { useState, useEffect, useCallback } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Truck, Package, MapPin, CheckCircle2, Clock,
  Navigation, RefreshCw, ArrowRight, ExternalLink, Building2,
  AlertCircle,
} from "lucide-react";

// --- Types ---

interface PortalLoad {
  id: string;
  reference_number: string | null;
  tracking_token: string | null;
  status: string;
  service_type: string | null;
  packages: number;
  pickup_address: string | null;
  delivery_address: string | null;
  load_date: string;
  start_time: string | null;
  end_time: string | null;
  estimated_arrival: string | null;
  pod_confirmed: boolean;
  driver_name: string | null;
  hub: string;
}

interface PortalData {
  found: boolean;
  client_name?: string;
  portal_token?: string;
  loads?: PortalLoad[];
  error?: string;
}

// --- Status config ---

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  assigned:         { label: "Assigned",      color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  blasted:          { label: "Pending Accept", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  in_progress:      { label: "In Transit",    color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  arrived_pickup:   { label: "At Pickup",     color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  in_transit:       { label: "In Transit",    color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  arrived_delivery: { label: "At Delivery",   color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  delivered:        { label: "Delivered",     color: "bg-green-500/20 text-green-400 border-green-500/30" },
  completed:        { label: "Completed",     color: "bg-green-500/20 text-green-400 border-green-500/30" },
  failed:           { label: "Failed",        color: "bg-red-500/20 text-red-400 border-red-500/30" },
  pending:          { label: "Pending",       color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, color: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
}

function isActiveStatus(status: string): boolean {
  return ["assigned", "blasted", "in_progress", "arrived_pickup", "in_transit", "arrived_delivery"].includes(status);
}

function isDeliveredStatus(status: string): boolean {
  return ["delivered", "completed"].includes(status);
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

function formatDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// --- Load Card ---

function LoadCard({ load }: { load: PortalLoad }) {
  const sc = getStatusConfig(load.status);
  const active = isActiveStatus(load.status);
  const delivered = isDeliveredStatus(load.status);

  return (
    <Card className="border-0 bg-white/5 backdrop-blur-sm overflow-hidden hover:bg-white/8 transition-colors">
      {/* Status accent bar */}
      <div className={`h-1 ${delivered ? "bg-green-500" : active ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-white/10"}`} />
      <CardContent className="p-4 space-y-3">
        {/* Top row: ref + status */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] text-white/40 font-mono uppercase tracking-wider">
              {load.reference_number ?? "No Reference"}
            </p>
            <p className="text-xs text-white/40 mt-0.5">{formatDate(load.load_date)}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {delivered && load.pod_confirmed && (
              <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                POD
              </Badge>
            )}
            <Badge className={`${sc.color} text-[10px] border`}>
              {sc.label}
            </Badge>
          </div>
        </div>

        {/* Route: pickup to delivery */}
        <div className="space-y-1.5">
          {load.pickup_address && (
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="h-2.5 w-2.5 text-violet-400" />
              </div>
              <p className="text-xs text-white/70 leading-snug">{load.pickup_address}</p>
            </div>
          )}
          {load.pickup_address && load.delivery_address && (
            <div className="ml-1.5 border-l border-dashed border-white/10 h-2" />
          )}
          {load.delivery_address && (
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="h-2.5 w-2.5 text-indigo-400" />
              </div>
              <p className="text-xs text-white/70 leading-snug">{load.delivery_address}</p>
            </div>
          )}
        </div>

        {/* Bottom row: driver, time, tracking link */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div className="flex items-center gap-3">
            {load.driver_name && (
              <div className="flex items-center gap-1">
                <Truck className="h-3 w-3 text-white/30" />
                <span className="text-[11px] text-white/50">{load.driver_name}</span>
              </div>
            )}
            {load.packages > 1 && (
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3 text-white/30" />
                <span className="text-[11px] text-white/50">{load.packages} pkgs</span>
              </div>
            )}
            {(load.estimated_arrival || load.start_time) && !delivered && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-white/30" />
                <span className="text-[11px] text-white/50">
                  {load.estimated_arrival ? formatTime(load.estimated_arrival) : formatTime(load.start_time)}
                </span>
              </div>
            )}
          </div>
          {load.tracking_token && (
            <a
              href={`/track/${load.tracking_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              Track
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main component ---

function ClientPortal() {
  const { token } = useParams<{ token?: string }>();
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchPortal = useCallback(async () => {
    if (!token) {
      setPortal({ found: false, error: "No portal token in URL." });
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_client_portal_loads", { p_token: token }) as {
      data: PortalData | null;
      error: unknown;
    };
    if (error) {
      setPortal({ found: false, error: "Unable to load portal. Please try again." });
    } else if (!data || !data.found) {
      setPortal({ found: false, error: (data as PortalData | null)?.error ?? "Invalid or expired portal link." });
    } else {
      setPortal(data);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchPortal();
  }, [fetchPortal]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchPortal, 60_000);
    return () => clearInterval(interval);
  }, [fetchPortal]);

  const loads = portal?.loads ?? [];
  const activeLoads = loads.filter((l) => isActiveStatus(l.status));
  const deliveredToday = loads.filter((l) => isDeliveredStatus(l.status) && l.load_date === new Date().toISOString().slice(0, 10));
  const totalDelivered = loads.filter((l) => isDeliveredStatus(l.status));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Truck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Anika Logistics</h1>
              {portal?.found && portal.client_name ? (
                <p className="text-[11px] text-white/50 flex items-center gap-1">
                  <Building2 className="h-2.5 w-2.5" />
                  {portal.client_name}
                </p>
              ) : (
                <p className="text-[10px] text-white/40">Client Portal</p>
              )}
            </div>
          </div>
          {portal?.found && (
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchPortal}
              disabled={loading}
              className="text-white/60 hover:text-white text-xs gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Loading spinner */}
        {loading && !portal && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="h-6 w-6 text-violet-400 animate-spin" />
            <p className="text-sm text-white/50">Loading your loads...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && portal && !portal.found && (
          <Card className="border-red-500/30 bg-red-500/10 border mt-8">
            <CardContent className="py-8 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
              <p className="text-sm font-semibold text-red-300">Portal Not Found</p>
              <p className="text-xs text-red-400/70 max-w-xs mx-auto">
                {portal.error ?? "This portal link is invalid or has been deactivated. Contact Anika Logistics for a new link."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Portal content */}
        {portal?.found && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-0 bg-white/5">
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold text-white">{activeLoads.length}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Active</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/5">
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{deliveredToday.length}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Delivered Today</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/5">
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold text-white/60">{totalDelivered.length}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Total (60 days)</p>
                </CardContent>
              </Card>
            </div>

            {/* Active loads first */}
            {activeLoads.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Navigation className="h-3.5 w-3.5 text-violet-400" />
                  <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Active ({activeLoads.length})
                  </h2>
                </div>
                {activeLoads.map((load) => (
                  <LoadCard key={load.id} load={load} />
                ))}
              </div>
            )}

            {/* Delivered loads */}
            {totalDelivered.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Delivered ({totalDelivered.length})
                  </h2>
                </div>
                {totalDelivered.map((load) => (
                  <LoadCard key={load.id} load={load} />
                ))}
              </div>
            )}

            {/* Other loads (assigned, pending) */}
            {(() => {
              const otherLoads = loads.filter((l) => !isActiveStatus(l.status) && !isDeliveredStatus(l.status));
              if (otherLoads.length === 0) return null;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-white/40" />
                    <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                      Other ({otherLoads.length})
                    </h2>
                  </div>
                  {otherLoads.map((load) => (
                    <LoadCard key={load.id} load={load} />
                  ))}
                </div>
              );
            })()}

            {/* Empty state */}
            {loads.length === 0 && (
              <Card className="border-0 bg-white/5">
                <CardContent className="py-12 text-center space-y-2">
                  <Package className="h-10 w-10 text-white/20 mx-auto" />
                  <p className="text-sm font-semibold text-white/50">No loads in the last 60 days</p>
                  <p className="text-xs text-white/30">Contact Anika Logistics if you believe this is an error.</p>
                </CardContent>
              </Card>
            )}

            {/* Last refresh */}
            <p className="text-center text-[10px] text-white/20 pb-2">
              Last updated: {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              {" "}&bull;{" "}Auto-refreshes every 60 seconds
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-white/20">
        Powered by{" "}
        <span className="text-white/40 font-semibold">Anika Logistics</span>
        {" "}&bull;{" "}
        Real-time freight visibility
        <br />
        <span className="text-white/15">Questions? Contact your Anika dispatcher.</span>
      </footer>
    </div>
  );
}

export default function ClientPortalPage() {
  return (
    <ErrorBoundary>
      <ClientPortal />
    </ErrorBoundary>
  );
}
