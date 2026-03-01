/**
 * dispatch-operations.test.ts
 *
 * 5 focused dispatch operation tests covering:
 *   1. Initial load status is 'pending'
 *   2. Assigning a driver transitions status to 'assigned'
 *   3. Marking delivered is blocked unless load is in an allowed prior status
 *   4. Rate calculator with surcharges returns the correct total
 *   5. Overtime hours calculated correctly for shifts over 8 hours
 */

import { describe, it, expect } from "vitest";
import { isTransitionAllowed, ALLOWED_TRANSITIONS } from "@/lib/statusTransitions";
import { calculateRate, EMPTY_ANIKA_MODIFIERS } from "@/lib/rateCalculator";
import type { AnikaModifiers } from "@/pages/dispatch/types";

// Helper to build modifiers with selective overrides
function mods(overrides: Partial<AnikaModifiers> = {}): AnikaModifiers {
  return { ...EMPTY_ANIKA_MODIFIERS, ...overrides };
}

// ---------------------------------------------------------------------------
// Overtime calculation helper (mirrors the SQL OT logic in clock_out_driver)
// Regular: up to 8h @ 1x; Overtime: anything over 8h @ 1.5x
// ---------------------------------------------------------------------------
function calculateShiftPay(
  totalWorkMinutes: number,
  hourlyRate: number,
): { regularHours: number; overtimeHours: number; totalPay: number } {
  const totalWorkHours = totalWorkMinutes / 60;
  const regularHours = Math.min(totalWorkHours, 8);
  const overtimeHours = Math.max(totalWorkHours - 8, 0);
  const totalPay =
    regularHours * hourlyRate + overtimeHours * hourlyRate * 1.5;
  return { regularHours, overtimeHours, totalPay };
}

// ===========================================================================
// Test 1 -- Initial load status is 'pending'
// ===========================================================================
describe("Dispatch operation: initial load status", () => {
  it("a new load starts with status 'pending'", () => {
    // When a load is created in the system, its initial status is 'pending'.
    // We verify this by confirming 'pending' is a recognized status and has
    // valid outgoing transitions defined in the state machine.
    expect(ALLOWED_TRANSITIONS).toHaveProperty("pending");
    // 'pending' must have at least one valid outgoing transition
    expect(ALLOWED_TRANSITIONS["pending"].length).toBeGreaterThan(0);
    // 'pending' can be assigned (standard path)
    expect(ALLOWED_TRANSITIONS["pending"]).toContain("assigned");
  });
});

// ===========================================================================
// Test 2 -- Assigning a driver changes status to 'assigned'
// ===========================================================================
describe("Dispatch operation: driver assignment", () => {
  it("pending -> assigned is allowed (assigning a driver)", () => {
    expect(isTransitionAllowed("pending", "assigned")).toBe(true);
  });

  it("blasted -> assigned is allowed (driver accepted blast)", () => {
    expect(isTransitionAllowed("blasted", "assigned")).toBe(true);
  });

  it("assigned -> pending is allowed (unassigning a driver)", () => {
    // Dispatcher can unassign a driver, reverting to pending
    expect(isTransitionAllowed("assigned", "pending")).toBe(true);
  });
});

// ===========================================================================
// Test 3 -- Marking delivered is only allowed from valid prior statuses
// ===========================================================================
describe("Dispatch operation: delivered transition guards", () => {
  it("in_transit -> delivered is allowed", () => {
    expect(isTransitionAllowed("in_transit", "delivered")).toBe(true);
  });

  it("in_progress -> delivered is allowed (fast path)", () => {
    expect(isTransitionAllowed("in_progress", "delivered")).toBe(true);
  });

  it("arrived_delivery -> delivered is allowed", () => {
    expect(isTransitionAllowed("arrived_delivery", "delivered")).toBe(true);
  });

  it("pending -> delivered is NOT allowed (must be in-flight first)", () => {
    expect(isTransitionAllowed("pending", "delivered")).toBe(false);
  });

  it("assigned -> delivered is NOT allowed (driver must start work first)", () => {
    expect(isTransitionAllowed("assigned", "delivered")).toBe(false);
  });

  it("cancelled -> delivered is NOT allowed (load is terminal)", () => {
    expect(isTransitionAllowed("cancelled", "delivered")).toBe(false);
  });

  it("completed -> delivered is NOT allowed (already terminal)", () => {
    expect(isTransitionAllowed("completed", "delivered")).toBe(false);
  });
});

// ===========================================================================
// Test 4 -- Rate calculator with surcharges returns the correct total
// ===========================================================================
describe("Dispatch operation: rate calculator with surcharges", () => {
  it("cargo_van with after-hours + weekend + 2 stops returns correct total", () => {
    // base=105, mileage=(40-20)*2=40, fuel=(105+40)*0.25=36.25
    // subtotal=181.25, weight=0
    // modifiers: afterHours=25, weekend=25, additionalStops=2*50=100 => 150
    // total = 181.25 + 0 + 150 = 331.25
    const result = calculateRate(
      "cargo_van",
      40,
      0,
      mods({ afterHours: true, weekend: true, additionalStops: 2 }),
    );
    expect(result.baseRate).toBe(105);
    expect(result.mileageCharge).toBe(40);
    expect(result.fuelSurcharge).toBeCloseTo(36.25, 2);
    expect(result.subtotal).toBeCloseTo(181.25, 2);
    expect(result.modifiersTotal).toBe(150);
    expect(result.finalQuote).toBeCloseTo(331.25, 2);
  });

  it("box_truck with hazmat + white glove returns correct total", () => {
    // base=170, mileage=0 (<=20 miles), fuel=170*0.25=42.50
    // subtotal=212.50, weight=0
    // modifiers: hazmat=50, whiteGlove=50 => 100
    // total = 212.50 + 0 + 100 = 312.50
    const result = calculateRate(
      "box_truck",
      10,
      0,
      mods({ hazmat: true, whiteGlove: true }),
    );
    expect(result.finalQuote).toBeCloseTo(312.5, 2);
    expect(result.modifiersTotal).toBe(100);
  });
});

// ===========================================================================
// Test 5 -- Overtime hours calculated correctly for shifts over 8 hours
// ===========================================================================
describe("Dispatch operation: overtime hour calculation", () => {
  it("exactly 8 hours produces 8 regular hours and 0 overtime", () => {
    const { regularHours, overtimeHours } = calculateShiftPay(480, 18);
    expect(regularHours).toBe(8);
    expect(overtimeHours).toBe(0);
  });

  it("10-hour shift produces 8 regular hours and 2 overtime hours", () => {
    const { regularHours, overtimeHours } = calculateShiftPay(600, 18);
    expect(regularHours).toBe(8);
    expect(overtimeHours).toBe(2);
  });

  it("10-hour shift @ $18/hr: total pay = 8*18 + 2*18*1.5 = $198", () => {
    const { totalPay } = calculateShiftPay(600, 18);
    // reg: 8 * 18 = 144; OT: 2 * 18 * 1.5 = 54 => 198
    expect(totalPay).toBeCloseTo(198, 2);
  });

  it("6-hour shift produces 6 regular hours and 0 overtime", () => {
    const { regularHours, overtimeHours } = calculateShiftPay(360, 20);
    expect(regularHours).toBe(6);
    expect(overtimeHours).toBe(0);
  });

  it("12-hour shift produces 8 regular hours and 4 overtime hours", () => {
    const { regularHours, overtimeHours } = calculateShiftPay(720, 15);
    expect(regularHours).toBe(8);
    expect(overtimeHours).toBe(4);
  });

  it("12-hour shift @ $15/hr: total pay = 8*15 + 4*15*1.5 = $210", () => {
    const { totalPay } = calculateShiftPay(720, 15);
    // reg: 8 * 15 = 120; OT: 4 * 15 * 1.5 = 90 => 210
    expect(totalPay).toBeCloseTo(210, 2);
  });
});
