/**
 * useLoadStatusActions
 *
 * Handles updating daily_loads.status and inserting a load_status_events row.
 * Also updates actual_pickup / actual_delivery timestamps when status transitions occur.
 *
 * -- RACE CONDITION FIX (Option C) --------------------------------------------
 * Before allowing a load to transition to "assigned", we check whether the
 * target driver already has an active load (status IN assigned, in_progress,
 * arrived_pickup, in_transit, arrived_delivery). If a conflict is found the
 * hook returns a DriverConflictWarning instead of proceeding, so the calling
 * component can show a confirmation dialog. Pass `force: true` to skip the
 * check and assign anyway (e.g. after dispatcher confirms the dialog).
 *
 * Long-term: pair this with a DB-level partial unique index on driver_id
 * WHERE status IN (...) to prevent the remaining sub-second race window.
 *
 * STALE DETAIL PANEL: LoadDetailPanel captures a snapshot of the load at open
 * time. Realtime updates (other dispatchers changing status) don't propagate to
 * the open panel unless onRefresh() is called. Consider subscribing to a
 * Supabase realtime channel on `load.id` inside the panel.
 * -----------------------------------------------------------------------------
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { todayISO } from "@/lib/formatters";
import type { Load } from "@/pages/dispatch/types";

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

// --- Status state machine ------------------------------------
// Maps each status to the set of statuses it is allowed to transition TO.
// Any transition not in this map is blocked.
// Note: "completed", "cancelled", "failed" are terminal -- no forward transitions.
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

// Statuses that mean a driver is actively working a load
const ACTIVE_STATUSES: LoadStatus[] = [
  "assigned",
  "in_progress",
  "arrived_pickup",
  "in_transit",
  "arrived_delivery",
];

// --- Driver conflict warning type --------------------------------------------

export interface DriverConflictWarning {
  warning: true;
  message: string;
  existingLoad: Load;
}

export interface DriverAvailabilityResult {
  available: boolean;
  activeLoads: Load[];
}

/**
 * Check whether a driver already has one or more active loads today.
 *
 * @param driverId  UUID of the driver to check
 * @param excludeLoadId  Optional load ID to exclude from the check (the load
 *                       being assigned right now -- avoids self-conflict).
 * @returns  { available, activeLoads }
 */
export async function checkDriverAvailability(
  driverId: string,
  excludeLoadId?: string,
): Promise<DriverAvailabilityResult> {
  const { data, error } = await supabase
    .from("daily_loads")
    .select(
      "id, load_date, reference_number, dispatcher_id, driver_id, vehicle_id, shift, hub, client_name, pickup_address, delivery_address, miles, deadhead_miles, start_time, end_time, wait_time_minutes, revenue, driver_pay, fuel_cost, status, detention_eligible, detention_billed, service_type, packages, weight_lbs, comments, pod_confirmed, created_at, updated_at",
    )
    .eq("driver_id", driverId)
    .eq("load_date", todayISO())
    .in("status", ACTIVE_STATUSES);

  if (error) {
    console.warn("[checkDriverAvailability] Query failed:", error.message);
    // Fail-open: don't block assignment if the check itself errors
    return { available: true, activeLoads: [] };
  }

  const activeLoads = ((data ?? []) as Load[]).filter(
    (l) => l.id !== excludeLoadId,
  );

  return {
    available: activeLoads.length === 0,
    activeLoads,
  };
}

// --- Update options ----------------------------------------------------------

interface UpdateStatusOptions {
  loadId: string;
  previousStatus: string;
  newStatus: LoadStatus;
  /** Driver ID -- required when newStatus is "assigned" for conflict check */
  driverId?: string | null;
  /** Driver display name -- used in the conflict warning message */
  driverName?: string | null;
  /** Skip the driver-availability check (use after dispatcher confirms dialog) */
  force?: boolean;
  onSuccess?: () => void;
}

export function useLoadStatusActions() {
  const { user } = useAuth();
  const { toast } = useToast();

  const updateStatus = useCallback(
    async ({
      loadId,
      previousStatus,
      newStatus,
      driverId,
      driverName,
      force,
      onSuccess,
    }: UpdateStatusOptions): Promise<DriverConflictWarning | void> => {
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

      // ----- Driver conflict check (Option C) --------------------------------
      // When assigning a driver, verify they don't already have an active load.
      // Skip if the caller explicitly set force: true (post-confirmation).
      if (
        newStatus === "assigned" &&
        driverId &&
        !force
      ) {
        const { available, activeLoads } = await checkDriverAvailability(
          driverId,
          loadId,
        );

        if (!available) {
          const existing = activeLoads[0];
          const refLabel = existing.reference_number
            ? `REF#${existing.reference_number}`
            : `Load ${existing.id.slice(0, 8)}`;
          const name = driverName ?? driverId;

          return {
            warning: true,
            message: `${name} already has an active load (${refLabel}, status: ${existing.status}). Assign anyway?`,
            existingLoad: existing,
          };
        }
      }
      // -----------------------------------------------------------------------

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
        // Non-fatal -- load was already updated; event record failed
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
        title: `? Status -> ${statusLabels[newStatus] ?? newStatus}`,
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
