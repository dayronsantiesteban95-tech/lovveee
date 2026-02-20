/**
 * DriverSuggestionBadge v2 -- Auto-Dispatch Suggestion UI
 *
 * Shows when a load has no driver assigned and has pickup GPS coordinates.
 * Displays top-scored driver from get_driver_suggestion RPC (ETA-aware).
 * Yellow/amber accent -- suggestion, not mandate.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, User, MapPin, Package, Clock, X, RefreshCw, AlertTriangle } from "lucide-react";
import { useDriverSuggestion } from "@/hooks/useDriverSuggestion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// --- Types --------------------------------------------------------------------

interface LoadCoords {
  id: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  driver_id?: string | null;
  cutoff_time?: string | null;
}

interface DriverSuggestionBadgeProps {
  load: LoadCoords;
  onAssigned: (driverId: string) => void;
}

// --- Helpers ------------------------------------------------------------------

function fmtTime(ts: string | null | undefined): string {
  if (!ts) return "--";
  try {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "--";
  }
}

function fmtEta(minutes: number): string {
  if (minutes < 1) return "<1 min";
  return `~${Math.round(minutes)} min`;
}

// Cutoff margin color: green >30min, amber 15-30min, red <15min
function cutoffColor(marginMin: number): string {
  if (marginMin > 30) return "text-emerald-500";
  if (marginMin >= 15) return "text-amber-500";
  return "text-red-500";
}

function cutoffBgColor(marginMin: number): string {
  if (marginMin > 30) return "bg-emerald-500/10 border-emerald-500/20";
  if (marginMin >= 15) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

// --- Component ----------------------------------------------------------------

export default function DriverSuggestionBadge({
  load,
  onAssigned,
}: DriverSuggestionBadgeProps) {
  const { suggestion, loading } = useDriverSuggestion(load);
  const [dismissed, setDismissed] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();

  if (dismissed) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 py-1">
        <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />
        <span>Finding best driver...</span>
      </div>
    );
  }

  if (!suggestion) return null;

  const handleAssign = async () => {
    setAssigning(true);
    const { error } = await supabase
      .from("daily_loads")
      .update({ driver_id: suggestion.driver_id, status: "assigned" })
      .eq("id", load.id);

    setAssigning(false);

    if (error) {
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "?? Driver assigned!",
      description: `${suggestion.driver_name} assigned to this load`,
    });
    onAssigned(suggestion.driver_id);
  };

  const isOnDelivery = suggestion.driver_status === "on_delivery";
  const hasCutoff = suggestion.cutoff_margin_min !== null && load.cutoff_time != null;

  return (
    <Card className="border border-amber-500/30 bg-amber-500/5 shadow-sm">
      <CardContent className="pt-3 pb-3 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Suggested Driver
            </span>
            <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-0 text-[9px] ml-1">
              Auto
            </Badge>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
            title="Dismiss suggestion"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Driver info row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {/* Avatar */}
            <div className="h-9 w-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>

            {/* Name + metrics */}
            <div className="min-w-0 flex-1">
              {/* Name + status badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate">{suggestion.driver_name}</p>
                <Badge
                  className={
                    isOnDelivery
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-0 text-[9px]"
                      : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-0 text-[9px]"
                  }
                >
                  {isOnDelivery ? "On Delivery" : "Available"}
                </Badge>
              </div>

              {/* Metrics grid */}
              <div className="mt-1.5 space-y-1">
                {/* Distance + active loads */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {suggestion.distance_km.toFixed(1)} km away
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Package className="h-3 w-3" />
                    {suggestion.active_loads_count} active load{suggestion.active_loads_count !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* ETA rows */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    ETA pickup: {fmtEta(suggestion.eta_to_pickup_min)}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    Est. delivery: {fmtTime(suggestion.estimated_arrival_at_delivery)}
                  </span>
                </div>

                {/* Cutoff row (only when cutoff_time is set on the load) */}
                {hasCutoff && suggestion.cutoff_margin_min !== null && (
                  <div
                    className={`flex items-center gap-1.5 mt-1 px-2 py-1 rounded-md border text-[10px] font-medium ${cutoffBgColor(suggestion.cutoff_margin_min)}`}
                  >
                    {suggestion.cutoff_margin_min < 15 && (
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                    )}
                    <span className={cutoffColor(suggestion.cutoff_margin_min)}>
                      Cutoff: {fmtTime(load.cutoff_time)} ? {Math.round(suggestion.cutoff_margin_min)} min margin
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Button
              size="sm"
              className="h-7 text-[11px] px-3 bg-amber-500 hover:bg-amber-600 text-white gap-1"
              onClick={handleAssign}
              disabled={assigning}
            >
              {assigning ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                "Assign"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-2 text-muted-foreground"
              onClick={() => setDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
