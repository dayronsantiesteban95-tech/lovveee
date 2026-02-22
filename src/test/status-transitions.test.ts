import { describe, it, expect } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  ALL_STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  isTransitionAllowed,
  type LoadStatus,
} from "@/lib/statusTransitions";

// ============================================================
// ALLOWED_TRANSITIONS Map Integrity
// ============================================================
describe("ALLOWED_TRANSITIONS map integrity", () => {
  it("defines transitions for all known statuses", () => {
    for (const status of ALL_STATUSES) {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("every target status in the map is a valid LoadStatus", () => {
    for (const [_from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL_STATUSES).toContain(target);
      }
    }
  });

  it("has no duplicate targets for any status", () => {
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      const unique = new Set(targets);
      expect(unique.size).toBe(
        targets.length,
      );
    }
  });

  it("has exactly 11 statuses defined", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS)).toHaveLength(11);
    expect(ALL_STATUSES).toHaveLength(11);
  });
});

// ============================================================
// Valid Forward Transitions
// ============================================================
describe("valid forward transitions", () => {
  // pending
  it("pending -> assigned", () => expect(isTransitionAllowed("pending", "assigned")).toBe(true));
  it("pending -> blasted", () => expect(isTransitionAllowed("pending", "blasted")).toBe(true));
  it("pending -> cancelled", () => expect(isTransitionAllowed("pending", "cancelled")).toBe(true));

  // assigned
  it("assigned -> in_progress", () => expect(isTransitionAllowed("assigned", "in_progress")).toBe(true));
  it("assigned -> arrived_pickup", () => expect(isTransitionAllowed("assigned", "arrived_pickup")).toBe(true));
  it("assigned -> pending (unassign)", () => expect(isTransitionAllowed("assigned", "pending")).toBe(true));
  it("assigned -> cancelled", () => expect(isTransitionAllowed("assigned", "cancelled")).toBe(true));
  it("assigned -> failed", () => expect(isTransitionAllowed("assigned", "failed")).toBe(true));

  // blasted
  it("blasted -> assigned", () => expect(isTransitionAllowed("blasted", "assigned")).toBe(true));
  it("blasted -> in_progress", () => expect(isTransitionAllowed("blasted", "in_progress")).toBe(true));
  it("blasted -> pending", () => expect(isTransitionAllowed("blasted", "pending")).toBe(true));
  it("blasted -> cancelled", () => expect(isTransitionAllowed("blasted", "cancelled")).toBe(true));

  // in_progress
  it("in_progress -> arrived_pickup", () => expect(isTransitionAllowed("in_progress", "arrived_pickup")).toBe(true));
  it("in_progress -> in_transit", () => expect(isTransitionAllowed("in_progress", "in_transit")).toBe(true));
  it("in_progress -> arrived_delivery", () => expect(isTransitionAllowed("in_progress", "arrived_delivery")).toBe(true));
  it("in_progress -> delivered", () => expect(isTransitionAllowed("in_progress", "delivered")).toBe(true));
  it("in_progress -> cancelled", () => expect(isTransitionAllowed("in_progress", "cancelled")).toBe(true));
  it("in_progress -> failed", () => expect(isTransitionAllowed("in_progress", "failed")).toBe(true));

  // arrived_pickup
  it("arrived_pickup -> in_transit", () => expect(isTransitionAllowed("arrived_pickup", "in_transit")).toBe(true));
  it("arrived_pickup -> in_progress (back)", () => expect(isTransitionAllowed("arrived_pickup", "in_progress")).toBe(true));
  it("arrived_pickup -> cancelled", () => expect(isTransitionAllowed("arrived_pickup", "cancelled")).toBe(true));
  it("arrived_pickup -> failed", () => expect(isTransitionAllowed("arrived_pickup", "failed")).toBe(true));

  // in_transit
  it("in_transit -> arrived_delivery", () => expect(isTransitionAllowed("in_transit", "arrived_delivery")).toBe(true));
  it("in_transit -> delivered", () => expect(isTransitionAllowed("in_transit", "delivered")).toBe(true));
  it("in_transit -> cancelled", () => expect(isTransitionAllowed("in_transit", "cancelled")).toBe(true));
  it("in_transit -> failed", () => expect(isTransitionAllowed("in_transit", "failed")).toBe(true));

  // arrived_delivery
  it("arrived_delivery -> delivered", () => expect(isTransitionAllowed("arrived_delivery", "delivered")).toBe(true));
  it("arrived_delivery -> completed", () => expect(isTransitionAllowed("arrived_delivery", "completed")).toBe(true));
  it("arrived_delivery -> in_transit (back)", () => expect(isTransitionAllowed("arrived_delivery", "in_transit")).toBe(true));
  it("arrived_delivery -> failed", () => expect(isTransitionAllowed("arrived_delivery", "failed")).toBe(true));

  // delivered
  it("delivered -> completed", () => expect(isTransitionAllowed("delivered", "completed")).toBe(true));
  it("delivered -> failed", () => expect(isTransitionAllowed("delivered", "failed")).toBe(true));

  // reopen from terminal states
  it("cancelled -> pending (reopen)", () => expect(isTransitionAllowed("cancelled", "pending")).toBe(true));
  it("failed -> pending (reopen)", () => expect(isTransitionAllowed("failed", "pending")).toBe(true));
});

// ============================================================
// Invalid Transitions (should be rejected)
// ============================================================
describe("invalid transitions", () => {
  // Self-transitions are not in the map (handled separately in the hook)
  it("pending -> pending (no self-transition in map)", () => {
    expect(isTransitionAllowed("pending", "pending")).toBe(false);
  });

  // Skip forward
  it("pending -> delivered (skipping steps)", () => {
    expect(isTransitionAllowed("pending", "delivered")).toBe(false);
  });

  it("pending -> completed (skipping steps)", () => {
    expect(isTransitionAllowed("pending", "completed")).toBe(false);
  });

  it("pending -> in_transit (skipping steps)", () => {
    expect(isTransitionAllowed("pending", "in_transit")).toBe(false);
  });

  // Cannot go backwards to assigned from later statuses
  it("in_transit -> assigned (backwards too far)", () => {
    expect(isTransitionAllowed("in_transit", "assigned")).toBe(false);
  });

  it("delivered -> pending (not allowed, only through failed/cancelled)", () => {
    expect(isTransitionAllowed("delivered", "pending")).toBe(false);
  });

  it("delivered -> in_transit (backwards)", () => {
    expect(isTransitionAllowed("delivered", "in_transit")).toBe(false);
  });

  // blasted cannot go to failed directly
  it("blasted -> failed", () => {
    expect(isTransitionAllowed("blasted", "failed")).toBe(false);
  });

  // blasted cannot jump to delivered
  it("blasted -> delivered", () => {
    expect(isTransitionAllowed("blasted", "delivered")).toBe(false);
  });

  // assigned cannot jump to delivered
  it("assigned -> delivered", () => {
    expect(isTransitionAllowed("assigned", "delivered")).toBe(false);
  });

  // assigned cannot jump to completed
  it("assigned -> completed", () => {
    expect(isTransitionAllowed("assigned", "completed")).toBe(false);
  });

  // arrived_pickup cannot jump to completed
  it("arrived_pickup -> completed", () => {
    expect(isTransitionAllowed("arrived_pickup", "completed")).toBe(false);
  });

  // arrived_pickup cannot go back to pending
  it("arrived_pickup -> pending", () => {
    expect(isTransitionAllowed("arrived_pickup", "pending")).toBe(false);
  });

  // unknown status
  it("unknown -> assigned (unknown from-status)", () => {
    expect(isTransitionAllowed("nonexistent", "assigned")).toBe(false);
  });

  it("pending -> nonexistent (unknown to-status)", () => {
    expect(isTransitionAllowed("pending", "nonexistent")).toBe(false);
  });
});

// ============================================================
// Terminal States
// ============================================================
describe("terminal states", () => {
  it("completed has no outgoing transitions", () => {
    expect(ALLOWED_TRANSITIONS["completed"]).toEqual([]);
  });

  it("completed is the only fully terminal state (no forward transitions)", () => {
    const fullyTerminal = ALL_STATUSES.filter(
      (s) => ALLOWED_TRANSITIONS[s].length === 0,
    );
    expect(fullyTerminal).toEqual(["completed"]);
  });

  it("cancelled allows only reopen to pending", () => {
    expect(ALLOWED_TRANSITIONS["cancelled"]).toEqual(["pending"]);
  });

  it("failed allows only reopen to pending", () => {
    expect(ALLOWED_TRANSITIONS["failed"]).toEqual(["pending"]);
  });

  it("cannot transition from completed to any status", () => {
    for (const status of ALL_STATUSES) {
      expect(isTransitionAllowed("completed", status)).toBe(false);
    }
  });

  it("cancelled can only transition to pending", () => {
    for (const status of ALL_STATUSES) {
      if (status === "pending") {
        expect(isTransitionAllowed("cancelled", status)).toBe(true);
      } else {
        expect(isTransitionAllowed("cancelled", status)).toBe(false);
      }
    }
  });

  it("failed can only transition to pending", () => {
    for (const status of ALL_STATUSES) {
      if (status === "pending") {
        expect(isTransitionAllowed("failed", status)).toBe(true);
      } else {
        expect(isTransitionAllowed("failed", status)).toBe(false);
      }
    }
  });
});

// ============================================================
// Active Statuses
// ============================================================
describe("active statuses", () => {
  it("includes the correct statuses", () => {
    expect(ACTIVE_STATUSES).toContain("assigned");
    expect(ACTIVE_STATUSES).toContain("in_progress");
    expect(ACTIVE_STATUSES).toContain("arrived_pickup");
    expect(ACTIVE_STATUSES).toContain("in_transit");
    expect(ACTIVE_STATUSES).toContain("arrived_delivery");
  });

  it("does not include terminal or non-active statuses", () => {
    expect(ACTIVE_STATUSES).not.toContain("pending");
    expect(ACTIVE_STATUSES).not.toContain("delivered");
    expect(ACTIVE_STATUSES).not.toContain("completed");
    expect(ACTIVE_STATUSES).not.toContain("cancelled");
    expect(ACTIVE_STATUSES).not.toContain("failed");
    expect(ACTIVE_STATUSES).not.toContain("blasted");
  });

  it("has exactly 5 active statuses", () => {
    expect(ACTIVE_STATUSES).toHaveLength(5);
  });
});

// ============================================================
// Happy Path Sequences
// ============================================================
describe("complete delivery lifecycle paths", () => {
  it("supports the standard delivery path: pending -> assigned -> in_progress -> arrived_pickup -> in_transit -> arrived_delivery -> delivered -> completed", () => {
    const path: LoadStatus[] = [
      "pending",
      "assigned",
      "in_progress",
      "arrived_pickup",
      "in_transit",
      "arrived_delivery",
      "delivered",
      "completed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(
        isTransitionAllowed(path[i], path[i + 1]),
      ).toBe(true);
    }
  });

  it("supports the fast delivery path: pending -> assigned -> in_progress -> delivered -> completed", () => {
    const path: LoadStatus[] = [
      "pending",
      "assigned",
      "in_progress",
      "delivered",
      "completed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(
        isTransitionAllowed(path[i], path[i + 1]),
      ).toBe(true);
    }
  });

  it("supports blast then assign path: pending -> blasted -> assigned -> in_progress -> in_transit -> delivered -> completed", () => {
    const path: LoadStatus[] = [
      "pending",
      "blasted",
      "assigned",
      "in_progress",
      "in_transit",
      "delivered",
      "completed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(
        isTransitionAllowed(path[i], path[i + 1]),
      ).toBe(true);
    }
  });

  it("supports cancellation from mid-delivery: pending -> assigned -> in_progress -> cancelled -> pending", () => {
    const path: LoadStatus[] = [
      "pending",
      "assigned",
      "in_progress",
      "cancelled",
      "pending",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(
        isTransitionAllowed(path[i], path[i + 1]),
      ).toBe(true);
    }
  });

  it("supports failure then retry: pending -> assigned -> failed -> pending -> assigned", () => {
    const path: LoadStatus[] = [
      "pending",
      "assigned",
      "failed",
      "pending",
      "assigned",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(
        isTransitionAllowed(path[i], path[i + 1]),
      ).toBe(true);
    }
  });

  it("supports skip to arrived_delivery: in_progress -> arrived_delivery -> delivered -> completed", () => {
    const path: LoadStatus[] = [
      "in_progress",
      "arrived_delivery",
      "delivered",
      "completed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(
        isTransitionAllowed(path[i], path[i + 1]),
      ).toBe(true);
    }
  });
});

// ============================================================
// Cancellation reachability
// ============================================================
describe("cancellation is reachable from most active states", () => {
  const cancellableStatuses: LoadStatus[] = [
    "pending",
    "assigned",
    "blasted",
    "in_progress",
    "arrived_pickup",
    "in_transit",
  ];

  for (const status of cancellableStatuses) {
    it(`${status} -> cancelled is allowed`, () => {
      expect(isTransitionAllowed(status, "cancelled")).toBe(true);
    });
  }

  it("arrived_delivery -> cancelled is NOT allowed (too late)", () => {
    expect(isTransitionAllowed("arrived_delivery", "cancelled")).toBe(false);
  });

  it("delivered -> cancelled is NOT allowed", () => {
    expect(isTransitionAllowed("delivered", "cancelled")).toBe(false);
  });
});

// ============================================================
// Failure reachability
// ============================================================
describe("failure is reachable from appropriate states", () => {
  const failableStatuses: LoadStatus[] = [
    "assigned",
    "in_progress",
    "arrived_pickup",
    "in_transit",
    "arrived_delivery",
    "delivered",
  ];

  for (const status of failableStatuses) {
    it(`${status} -> failed is allowed`, () => {
      expect(isTransitionAllowed(status, "failed")).toBe(true);
    });
  }

  it("pending -> failed is NOT allowed (nothing started yet)", () => {
    expect(isTransitionAllowed("pending", "failed")).toBe(false);
  });

  it("blasted -> failed is NOT allowed (no driver assigned yet)", () => {
    expect(isTransitionAllowed("blasted", "failed")).toBe(false);
  });
});
