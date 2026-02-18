/**
 * ETABadge — Live traffic-aware ETA badge for in_progress load cards.
 *
 * Shows "ETA 2:45 PM" or "~18 min" with color coding:
 *   • green  = on time (≥15 min buffer vs SLA)
 *   • yellow = at risk (<15 min buffer)
 *   • red    = late (past SLA deadline)
 *   • gray   = loading / unavailable
 *
 * Only fetches when status = in_progress and addresses are present.
 */
import { RefreshCw } from "lucide-react";
import { useETA, etaStatusColor, fmtETA } from "@/hooks/useETA";

interface ETABadgeProps {
  pickupAddress: string | null | undefined;
  deliveryAddress: string | null | undefined;
  slaDeadline?: string | null;
  /** Only show ETA when true (e.g. status === "in_progress") */
  enabled: boolean;
  /** Compact mode: smaller badge, no tooltip */
  compact?: boolean;
}

export default function ETABadge({
  pickupAddress,
  deliveryAddress,
  slaDeadline,
  enabled,
  compact = false,
}: ETABadgeProps) {
  const hasAddresses = !!(pickupAddress?.trim() && deliveryAddress?.trim());

  const { eta, durationMinutes, loading, error, lastUpdated, refresh } = useETA(
    pickupAddress ?? "",
    deliveryAddress ?? "",
    enabled && hasAddresses,
  );

  if (!enabled) return null;

  if (!hasAddresses) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground">
        ETA unavailable
      </span>
    );
  }

  if (loading && !eta) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground animate-pulse">
        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
        ETA…
      </span>
    );
  }

  if (error && !eta) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground">
        ETA unavailable
      </span>
    );
  }

  const color = etaStatusColor(eta, slaDeadline);

  const colorClasses: Record<string, string> = {
    green:  "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30",
    yellow: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30",
    red:    "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30",
    gray:   "bg-muted/50 text-muted-foreground border border-border/30",
  };

  const label = fmtETA(eta, durationMinutes);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${colorClasses[color]}`}>
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer ${colorClasses[color]}`}
      title={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : undefined}
      onClick={(e) => { e.stopPropagation(); refresh(); }}
    >
      {label}
      {loading && <RefreshCw className="h-2.5 w-2.5 animate-spin opacity-60" />}
    </span>
  );
}
