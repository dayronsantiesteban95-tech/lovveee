/**
 * StatusTimeline — vertical timeline of load_status_events for a given load.
 *
 * Shows: status label, timestamp (formatted "Feb 18 · 10:32 AM"), changed by (dispatcher name)
 * Color-coded by status. Most recent at top.
 * Empty state: "No status history yet"
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ──────────────────────────────────────────
interface StatusEvent {
  id: string;
  load_id: string;
  previous_status: string | null;
  new_status: string;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
  // joined
  changedByName?: string;
}

interface StatusTimelineProps {
  loadId: string;
}

// ─── Helpers ─────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  pending:    { label: "Pending",    dot: "bg-gray-400",   text: "text-gray-500 dark:text-gray-400" },
  assigned:   { label: "Assigned",   dot: "bg-blue-500",   text: "text-blue-600 dark:text-blue-400" },
  blasted:    { label: "Blasted",    dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
  in_progress:{ label: "In Transit", dot: "bg-yellow-400", text: "text-yellow-600 dark:text-yellow-400" },
  delivered:  { label: "Delivered",  dot: "bg-green-500",  text: "text-green-600 dark:text-green-400" },
  completed:  { label: "Completed",  dot: "bg-green-600",  text: "text-green-600 dark:text-green-400" },
  cancelled:  { label: "Cancelled",  dot: "bg-gray-500",   text: "text-gray-500 dark:text-gray-400" },
  failed:     { label: "Failed",     dot: "bg-red-500",    text: "text-red-600 dark:text-red-400" },
};

function fmtTimelineTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).replace(",", " ·");
  } catch {
    return ts;
  }
}

// ═══════════════════════════════════════════════════════════
export default function StatusTimeline({ loadId }: StatusTimelineProps) {
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchEvents() {
      // Fetch status events for this load
      const { data: evtData, error } = await (supabase as any)
        .from("load_status_events")
        .select("id, load_id, previous_status, new_status, changed_by, reason, created_at")
        .eq("load_id", loadId)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error || !evtData) {
        setLoading(false);
        return;
      }

      // Gather unique changed_by UUIDs to resolve names
      const userIds: string[] = [...new Set(
        evtData
          .map((e: StatusEvent) => e.changed_by)
          .filter(Boolean) as string[]
      )];

      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        if (profiles) {
          profiles.forEach((p: { user_id: string; full_name: string }) => {
            nameMap[p.user_id] = p.full_name;
          });
        }
      }

      const enriched: StatusEvent[] = evtData.map((e: StatusEvent) => ({
        ...e,
        changedByName: e.changed_by ? (nameMap[e.changed_by] ?? "Dispatcher") : "System",
      }));

      if (!cancelled) {
        setEvents(enriched);
        setLoading(false);
      }
    }

    fetchEvents();
    return () => { cancelled = true; };
  }, [loadId]);

  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-3 w-3 rounded-full mt-1 shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-muted-foreground">No status history yet</p>
      </div>
    );
  }

  return (
    <div className="relative pl-4">
      {/* Vertical line */}
      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border/40" />

      <div className="space-y-4">
        {events.map((evt, idx) => {
          const cfg = STATUS_CONFIG[evt.new_status] ?? {
            label: evt.new_status,
            dot: "bg-gray-400",
            text: "text-gray-500",
          };
          const isLatest = idx === 0;

          return (
            <div key={evt.id} className="flex items-start gap-3">
              {/* Dot */}
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 mt-0.5 ring-2 ring-background ${cfg.dot} ${isLatest ? "ring-offset-1" : ""}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  {isLatest && (
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {fmtTimelineTs(evt.created_at)}
                  {evt.changedByName && (
                    <> · <span className="text-foreground/70">{evt.changedByName}</span></>
                  )}
                </p>
                {evt.reason && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">
                    "{evt.reason}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
