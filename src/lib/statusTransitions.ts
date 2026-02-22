// -----------------------------------------------------------
// Load Status State Machine - Pure business logic
// Extracted from useLoadStatusActions.ts for testability
// -----------------------------------------------------------

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

// Maps each status to the set of statuses it is allowed to transition TO.
// Any transition not in this map is blocked.
// Note: "completed", "cancelled", "failed" are terminal -- no forward transitions.
// Backwards transitions (reopen) are explicitly allowed from failed/cancelled.
export const ALLOWED_TRANSITIONS: Record<string, LoadStatus[]> = {
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
export const ACTIVE_STATUSES: LoadStatus[] = [
  "assigned",
  "in_progress",
  "arrived_pickup",
  "in_transit",
  "arrived_delivery",
];

// Terminal statuses -- no outgoing transitions
export const TERMINAL_STATUSES: LoadStatus[] = ["completed"];

// All valid statuses
export const ALL_STATUSES: LoadStatus[] = [
  "pending", "assigned", "blasted", "in_progress", "arrived_pickup",
  "in_transit", "arrived_delivery", "delivered", "completed", "cancelled", "failed",
];

/**
 * Returns true if the transition from `from` to `to` is allowed.
 */
export function isTransitionAllowed(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to as LoadStatus);
}
