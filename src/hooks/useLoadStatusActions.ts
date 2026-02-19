/**
 * useLoadStatusActions
 *
 * Handles updating daily_loads.status and inserting a load_status_events row.
 * Also updates actual_pickup / actual_delivery timestamps when status transitions occur.
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
        // Non-fatal — load was already updated; event record failed silently
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
