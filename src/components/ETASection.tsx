/**
 * ETASection — Prominent ETA display for LoadDetailPanel.
 *
 * Shows:
 *   • Estimated Arrival time
 *   • Drive time
 *   • Distance in miles
 *   • Last updated timestamp
 *   • Manual refresh button
 *
 * Only rendered when status = "in_progress".
 */
import { RefreshCw, Navigation, Clock, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useETA, etaStatusColor } from "@/hooks/useETA";

interface ETASectionProps {
  pickupAddress: string | null | undefined;
  deliveryAddress: string | null | undefined;
  slaDeadline?: string | null;
  enabled: boolean;
}

export default function ETASection({
  pickupAddress,
  deliveryAddress,
  slaDeadline,
  enabled,
}: ETASectionProps) {
  const hasAddresses = !!(pickupAddress?.trim() && deliveryAddress?.trim());

  const { eta, durationMinutes, distanceMiles, loading, error, lastUpdated, refresh } = useETA(
    pickupAddress ?? "",
    deliveryAddress ?? "",
    enabled && hasAddresses,
  );

  if (!enabled) return null;

  const color = etaStatusColor(eta, slaDeadline);

  const accentClasses: Record<string, string> = {
    green:  "border-green-500/30 bg-green-500/5",
    yellow: "border-yellow-500/30 bg-yellow-500/5",
    red:    "border-red-500/30 bg-red-500/5",
    gray:   "border-border/30 bg-muted/10",
  };

  const labelClasses: Record<string, string> = {
    green:  "text-green-700 dark:text-green-400",
    yellow: "text-yellow-700 dark:text-yellow-400",
    red:    "text-red-700 dark:text-red-400",
    gray:   "text-muted-foreground",
  };

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${accentClasses[color]}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Navigation className={`h-3.5 w-3.5 ${labelClasses[color]}`} />
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${labelClasses[color]}`}>
            Live ETA
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={refresh}
          disabled={loading}
          title="Refresh ETA"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Loading state */}
      {loading && !eta && (
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-6 w-24 bg-muted/40 rounded" />
          <div className="h-4 w-16 bg-muted/30 rounded" />
        </div>
      )}

      {/* Error state */}
      {!loading && (error || !hasAddresses) && (
        <p className="text-[11px] text-muted-foreground">
          {!hasAddresses ? "Addresses not set — cannot calculate ETA." : "ETA unavailable"}
        </p>
      )}

      {/* Data rows */}
      {eta && (
        <div className="space-y-1.5">
          {/* Estimated Arrival */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Estimated Arrival</span>
            <span className={`text-sm font-bold ${labelClasses[color]}`}>
              {eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>

          {/* Drive time */}
          {durationMinutes !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" /> Drive time
              </span>
              <span className="text-[11px] font-semibold text-foreground">
                ~{durationMinutes} min
              </span>
            </div>
          )}

          {/* Distance */}
          {distanceMiles !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Ruler className="h-3 w-3" /> Distance
              </span>
              <span className="text-[11px] font-semibold text-foreground">
                {distanceMiles} miles
              </span>
            </div>
          )}

          {/* Last updated */}
          {lastUpdated && (
            <p className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border/20">
              Updated {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
