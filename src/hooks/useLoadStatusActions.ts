/**
 * useLoadStatusActions
 *
 * Handles updating daily_loads.status and inserting a load_status_events row.
 * Also updates actual_pickup / actual_delivery timestamps when status transitions occur.
 *
 * ── DESIGN INPUT NEEDED ──────────────────────────────────────────────────────
 * RACE CONDITION: Two dispatchers can assign the same driver to two loads
 * simultaneously. There is no DB-level lock or "is driver already active?"
 * check. Options:
 *   A) Add a DB trigger/unique partial index: driver_id WHERE status IN
 *      ('assigned','in_progress','arrived_pickup','in_transit','arrived_delivery')
 *   B) Add a Supabase edge function with a serializable transaction that checks
 *      driver availability before updating the load.
 *   C) Soft-warn: query for active loads by driver_id before assigning, show
 *      a confirmation dialog if a conflict is found.
 * Recommended: Option C (immediate, no DB migration) + Option A long-term.
 *
 * STALE DETAIL PANEL: LoadDetailPanel captures a snapshot of the load at open
 * time. Realtime updates (other dispatchers changing status) don't propagate to
 * the open panel unless onRefresh() is called. Consider subscribing to a
 * Supabase realtime channel on `load.id` inside the panel.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export type LoadStatus =
  | "pending"
  | "assigned"
  | "blasted"
  | "in_progress"
  | "arrived_pickup"
  | "in_transit"
  | "arrived_delivery"
  | "delivered"
  | "completed"
  | "cancelled"
  | "failed";

// ─── Status state machine ────────────────────────────────────
// Maps each status to the set of statuses it is allowed to transition TO.
// Any transition not in this map is blocked.
// Note: "completed", "cancelled", "failed" are terminal — no forward transitions.
// Backwards transitions (reopen) are explicitly allowed from failed/cancelled.
const ALLOWED_TRANSITIONS: Record<string, LoadStatus[]> = {
  pending:          ["assigned", "blasted", "cancelled"],
  assigned:         ["in_progress", "arrived_pickup", "pending", "cancelled", "failed"],
  blasted:          ["assigned", "in_progress", "pending", "cancelled"],
  in_progress:      ["arrived_pickup", "in_transit", "arrived_delivery", "delivered", "cancelled", "failed"],
  arrived_pickup:   ["in_transit", "in_progress", "cancelled", "failed"],
  in_transit:       ["arrived_delivery", "delivered", "cancelled", "failed"],
  arrived_delivery: ["delivered", "completed", "in_transit", "failed"],
  delivered:        ["completed", "failed"],
  completed:        [],
  cancelled:        ["pending"],  // allow reopen
  failed:           ["pending"],  // allow reopen
};

interface UpdateStatusOptions {
  loadId: string;
  previousStatus: string;
  newStatus: LoadStatus;
  onSuccess?: () => void;
}

export function useLoadStatusActions() {
  const { user } = useAuth();
  const { toast } = useToast();

  const updateStatus = useCallback(
    async ({ loadId, previousStatus, newStatus, onSuccess }: UpdateStatusOptions) => {
      if (!user) return;

      // Guard: prevent invalid status transitions
      if (previousStatus !== newStatus) {
        const allowed = ALLOWED_TRANSITIONS[previousStatus] ?? [];
        if (!allowed.includes(newStatus)) {
          toast({
            title: "Invalid status transition",
            description: `Cannot move from "${previousStatus}" to "${newStatus}".`,
            variant: "destructive",
          });
          return;
        }
      }

      // Guard: prevent duplicate (no-op) status updates
      if (previousStatus === newStatus) {
        return;
      }

      const now = new Date().toISOString();

      // Build the update payload for daily_loads
      const loadUpdate: Record<string, string | null> = {
        status: newStatus,
        updated_at: now,
      };

      // Record actual timestamps on key transitions
      if (newStatus === "in_progress") {
        loadUpdate.actual_pickup = now;
      }
      if (newStatus === "delivered" || newStatus === "completed") {
        loadUpdate.actual_delivery = now;
      }

      // 1. Update daily_loads
      const { error: loadErr } = await supabase
        .from("daily_loads")
        .update(loadUpdate as any)
        .eq("id", loadId);

      if (loadErr) {
        toast({
          title: "Status update failed",
          description: loadErr.message,
          variant: "destructive",
        });
        return;
      }

      // 2. Insert a load_status_events row
      // Using "any" cast because types.ts is stale vs real schema
      const { error: evtErr } = await supabase
        .from("load_status_events")
        .insert({
          load_id: loadId,
          previous_status: previousStatus,
          new_status: newStatus,
          changed_by: user.id,
          created_at: now,
        });

      if (evtErr) {
        // Non-fatal — load was already updated; event record failed
        // Log so the status timeline gap is detectable in production
        console.warn("[useLoadStatusActions] Failed to insert load_status_events:", evtErr.message);
      }

      const statusLabels: Record<string, string> = {
        pending: "Pending",
        assigned: "Assigned",
        blasted: "Blasted",
        in_progress: "In Transit",
        delivered: "Delivered",
        completed: "Completed",
        cancelled: "Cancelled",
        failed: "Failed",
      };

      toast({
        title: `✅ Status → ${statusLabels[newStatus] ?? newStatus}`,
        description:
          newStatus === "in_progress"
            ? "Actual pickup time recorded."
            : newStatus === "delivered" || newStatus === "completed"
            ? "Actual delivery time recorded."
            : undefined,
      });

      onSuccess?.();
    },
    [user, toast]
  );

  return { updateStatus };
}
