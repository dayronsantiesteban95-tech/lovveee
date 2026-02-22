import { describe, it, expect } from "vitest";
import {
  calculateRate,
  ANIKA_RATES,
  EMPTY_ANIKA_MODIFIERS,
} from "@/lib/rateCalculator";
import type { AnikaModifiers } from "@/pages/dispatch/types";

/** Helper to create modifiers with overrides */
function mods(overrides: Partial<AnikaModifiers> = {}): AnikaModifiers {
  return { ...EMPTY_ANIKA_MODIFIERS, ...overrides };
}

// ============================================================
// Base Rate Selection
// ============================================================
describe("Base Rate Selection", () => {
  it("uses cargo_van base rate ($105) for cargo_van", () => {
    const result = calculateRate("cargo_van", 0, 0, mods());
    expect(result.baseRate).toBe(105);
  });

  it("uses box_truck base rate ($170) for box_truck", () => {
    const result = calculateRate("box_truck", 0, 0, mods());
    expect(result.baseRate).toBe(170);
  });

  it("defaults to cargo_van for unrecognized vehicle types", () => {
    const result = calculateRate("sprinter", 0, 0, mods());
    expect(result.baseRate).toBe(ANIKA_RATES.cargo_van.base);
  });

  it("defaults to cargo_van for car_suv", () => {
    const result = calculateRate("car_suv", 0, 0, mods());
    expect(result.baseRate).toBe(105);
  });

  it("defaults to cargo_van for empty string vehicle type", () => {
    const result = calculateRate("", 0, 0, mods());
    expect(result.baseRate).toBe(105);
  });
});

// ============================================================
// Mileage Calculation
// ============================================================
describe("Mileage Calculation", () => {
  it("charges $0 mileage for distances <= 20 miles (cargo_van)", () => {
    expect(calculateRate("cargo_van", 0, 0, mods()).mileageCharge).toBe(0);
    expect(calculateRate("cargo_van", 10, 0, mods()).mileageCharge).toBe(0);
    expect(calculateRate("cargo_van", 20, 0, mods()).mileageCharge).toBe(0);
  });

  it("charges per-mile only after first 20 miles (cargo_van @ $2.00/mi)", () => {
    const result = calculateRate("cargo_van", 30, 0, mods());
    // (30 - 20) * 2.0 = $20
    expect(result.mileageCharge).toBe(20);
  });

  it("charges per-mile only after first 20 miles (box_truck @ $2.50/mi)", () => {
    const result = calculateRate("box_truck", 50, 0, mods());
    // (50 - 20) * 2.5 = $75
    expect(result.mileageCharge).toBe(75);
  });

  it("handles exactly 21 miles (1 mile charge)", () => {
    const result = calculateRate("cargo_van", 21, 0, mods());
    // (21 - 20) * 2.0 = $2
    expect(result.mileageCharge).toBe(2);
  });

  it("handles large mileage values", () => {
    const result = calculateRate("cargo_van", 500, 0, mods());
    // (500 - 20) * 2.0 = $960
    expect(result.mileageCharge).toBe(960);
  });

  it("charges $0 mileage at exactly 0 miles", () => {
    const result = calculateRate("box_truck", 0, 0, mods());
    expect(result.mileageCharge).toBe(0);
  });
});

// ============================================================
// Fuel Surcharge (25% of base + mileage)
// ============================================================
describe("Fuel Surcharge", () => {
  it("is 25% of base rate when no mileage charge (cargo_van)", () => {
    const result = calculateRate("cargo_van", 0, 0, mods());
    // 105 * 0.25 = $26.25
    expect(result.fuelSurcharge).toBeCloseTo(26.25, 2);
  });

  it("is 25% of base rate when no mileage charge (box_truck)", () => {
    const result = calculateRate("box_truck", 0, 0, mods());
    // 170 * 0.25 = $42.50
    expect(result.fuelSurcharge).toBeCloseTo(42.5, 2);
  });

  it("is 25% of (base + mileage) when there is mileage", () => {
    const result = calculateRate("cargo_van", 30, 0, mods());
    // base=105, mileage=20, (105+20)*0.25 = $31.25
    expect(result.fuelSurcharge).toBeCloseTo(31.25, 2);
  });

  it("scales correctly with high mileage", () => {
    const result = calculateRate("box_truck", 100, 0, mods());
    // base=170, mileage=(100-20)*2.5=200, (170+200)*0.25 = $92.50
    expect(result.fuelSurcharge).toBeCloseTo(92.5, 2);
  });
});

// ============================================================
// Subtotal (base + mileage + fuel surcharge)
// ============================================================
describe("Subtotal", () => {
  it("equals base + mileage + fuel surcharge", () => {
    const result = calculateRate("cargo_van", 30, 0, mods());
    const expected = result.baseRate + result.mileageCharge + result.fuelSurcharge;
    expect(result.subtotal).toBeCloseTo(expected, 2);
  });

  it("cargo_van at 0 miles: 105 + 0 + 26.25 = 131.25", () => {
    const result = calculateRate("cargo_van", 0, 0, mods());
    expect(result.subtotal).toBeCloseTo(131.25, 2);
  });

  it("box_truck at 0 miles: 170 + 0 + 42.50 = 212.50", () => {
    const result = calculateRate("box_truck", 0, 0, mods());
    expect(result.subtotal).toBeCloseTo(212.5, 2);
  });

  it("cargo_van at 50 miles: 105 + 60 + 41.25 = 206.25", () => {
    // mileage = (50-20)*2.0 = 60
    // fuel = (105+60)*0.25 = 41.25
    const result = calculateRate("cargo_van", 50, 0, mods());
    expect(result.subtotal).toBeCloseTo(206.25, 2);
  });
});

// ============================================================
// Weight Surcharge
// ============================================================
describe("Weight Surcharge", () => {
  it("is $0 when weight is under threshold (cargo_van, threshold=100 lbs)", () => {
    expect(calculateRate("cargo_van", 0, 50, mods()).weightSurcharge).toBe(0);
    expect(calculateRate("cargo_van", 0, 100, mods()).weightSurcharge).toBe(0);
  });

  it("charges per-lb over threshold (cargo_van @ $0.10/lb)", () => {
    const result = calculateRate("cargo_van", 0, 150, mods());
    // (150 - 100) * 0.10 = $5.00
    expect(result.weightSurcharge).toBeCloseTo(5.0, 2);
  });

  it("is $0 when weight is under threshold (box_truck, threshold=600 lbs)", () => {
    expect(calculateRate("box_truck", 0, 300, mods()).weightSurcharge).toBe(0);
    expect(calculateRate("box_truck", 0, 600, mods()).weightSurcharge).toBe(0);
  });

  it("charges per-lb over threshold (box_truck @ $0.15/lb)", () => {
    const result = calculateRate("box_truck", 0, 800, mods());
    // (800 - 600) * 0.15 = $30.00
    expect(result.weightSurcharge).toBeCloseTo(30.0, 2);
  });

  it("handles zero weight", () => {
    const result = calculateRate("cargo_van", 0, 0, mods());
    expect(result.weightSurcharge).toBe(0);
  });

  it("handles weight exactly at threshold", () => {
    const resultVan = calculateRate("cargo_van", 0, 100, mods());
    expect(resultVan.weightSurcharge).toBe(0);

    const resultTruck = calculateRate("box_truck", 0, 600, mods());
    expect(resultTruck.weightSurcharge).toBe(0);
  });

  it("handles very heavy cargo", () => {
    const result = calculateRate("box_truck", 0, 5000, mods());
    // (5000 - 600) * 0.15 = $660
    expect(result.weightSurcharge).toBeCloseTo(660, 2);
  });
});

// ============================================================
// Accessorial / Modifier Charges
// ============================================================
describe("Accessorial & Modifier Charges", () => {
  it("after hours adds $25", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ afterHours: true }));
    expect(result.modifiersTotal).toBe(25);
  });

  it("weekend adds $25", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ weekend: true }));
    expect(result.modifiersTotal).toBe(25);
  });

  it("holiday adds $50", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ holiday: true }));
    expect(result.modifiersTotal).toBe(50);
  });

  it("tendering fee adds $15", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ tenderingFee: true }));
    expect(result.modifiersTotal).toBe(15);
  });

  it("attempt charge adds the base rate (cargo_van=$105)", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ attemptCharge: true }));
    expect(result.modifiersTotal).toBe(105);
  });

  it("attempt charge adds the base rate (box_truck=$170)", () => {
    const result = calculateRate("box_truck", 0, 0, mods({ attemptCharge: true }));
    expect(result.modifiersTotal).toBe(170);
  });

  it("additional stops add $50 each", () => {
    const r1 = calculateRate("cargo_van", 0, 0, mods({ additionalStops: 1 }));
    expect(r1.modifiersTotal).toBe(50);

    const r3 = calculateRate("cargo_van", 0, 0, mods({ additionalStops: 3 }));
    expect(r3.modifiersTotal).toBe(150);
  });

  it("extra pieces add $15 each", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ extraPieces: 4 }));
    expect(result.modifiersTotal).toBe(60);
  });

  it("special handling adds $20", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ specialHandling: true }));
    expect(result.modifiersTotal).toBe(20);
  });

  it("documents adds $20", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ documents: true }));
    expect(result.modifiersTotal).toBe(20);
  });

  it("holding adds $50 per day", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ holding: 2 }));
    expect(result.modifiersTotal).toBe(100);
  });

  it("wait time adds $30 per 15-min increment", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ waitTime: 3 }));
    expect(result.modifiersTotal).toBe(90);
  });

  it("second person adds $100", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ secondPerson: true }));
    expect(result.modifiersTotal).toBe(100);
  });

  it("white glove adds $50", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ whiteGlove: true }));
    expect(result.modifiersTotal).toBe(50);
  });

  it("hazmat adds $50", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({ hazmat: true }));
    expect(result.modifiersTotal).toBe(50);
  });

  it("stacks multiple modifiers correctly", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({
      afterHours: true,    // +25
      weekend: true,       // +25
      holiday: true,       // +50
      additionalStops: 2,  // +100
      whiteGlove: true,    // +50
      hazmat: true,        // +50
    }));
    expect(result.modifiersTotal).toBe(25 + 25 + 50 + 100 + 50 + 50);
    expect(result.modifiersTotal).toBe(300);
  });

  it("returns 0 modifiers when none are active", () => {
    const result = calculateRate("cargo_van", 0, 0, mods());
    expect(result.modifiersTotal).toBe(0);
  });

  it("stacks all boolean and numeric modifiers together", () => {
    const result = calculateRate("cargo_van", 0, 0, mods({
      afterHours: true,       // +25
      weekend: true,          // +25
      holiday: true,          // +50
      tenderingFee: true,     // +15
      attemptCharge: true,    // +105 (base rate)
      additionalStops: 1,    // +50
      extraPieces: 2,        // +30
      specialHandling: true, // +20
      documents: true,       // +20
      holding: 1,            // +50
      waitTime: 1,           // +30
      secondPerson: true,    // +100
      whiteGlove: true,      // +50
      hazmat: true,          // +50
    }));
    const expected = 25 + 25 + 50 + 15 + 105 + 50 + 30 + 20 + 20 + 50 + 30 + 100 + 50 + 50;
    expect(result.modifiersTotal).toBe(expected);
    expect(result.modifiersTotal).toBe(620);
  });
});

// ============================================================
// Final Quote (Total) Calculation
// ============================================================
describe("Final Quote Accuracy", () => {
  it("final = subtotal + weight surcharge + modifiers", () => {
    const result = calculateRate("cargo_van", 50, 200, mods({ afterHours: true, additionalStops: 2 }));
    const expected = result.subtotal + result.weightSurcharge + result.modifiersTotal;
    expect(result.finalQuote).toBeCloseTo(expected, 2);
  });

  it("cargo_van: 0 miles, 0 weight, no modifiers => base only", () => {
    const result = calculateRate("cargo_van", 0, 0, mods());
    // base=105, mileage=0, fuel=26.25, subtotal=131.25
    // weight=0, modifiers=0
    // final = 131.25
    expect(result.finalQuote).toBeCloseTo(131.25, 2);
  });

  it("box_truck: 100 miles, 1000 lbs, after hours + holiday", () => {
    const result = calculateRate("box_truck", 100, 1000, mods({ afterHours: true, holiday: true }));
    // base=170, mileage=(100-20)*2.5=200, fuel=(170+200)*0.25=92.50
    // subtotal=170+200+92.50=462.50
    // weight=(1000-600)*0.15=60
    // modifiers=25+50=75
    // final=462.50+60+75=597.50
    expect(result.finalQuote).toBeCloseTo(597.5, 2);
  });

  it("cargo_van: real-world scenario - 31 miles, 50 lbs, weekend, 1 extra stop", () => {
    const result = calculateRate("cargo_van", 31, 50, mods({ weekend: true, additionalStops: 1 }));
    // base=105, mileage=(31-20)*2.0=22, fuel=(105+22)*0.25=31.75
    // subtotal=105+22+31.75=158.75
    // weight: 50 < 100, surcharge=0
    // modifiers=25+50=75
    // final=158.75+0+75=233.75
    expect(result.finalQuote).toBeCloseTo(233.75, 2);
  });

  it("all zeros produces base + fuel surcharge only", () => {
    const resultVan = calculateRate("cargo_van", 0, 0, mods());
    expect(resultVan.finalQuote).toBe(resultVan.subtotal);

    const resultTruck = calculateRate("box_truck", 0, 0, mods());
    expect(resultTruck.finalQuote).toBe(resultTruck.subtotal);
  });

  it("breakdown components sum to finalQuote", () => {
    const result = calculateRate("box_truck", 75, 900, mods({
      afterHours: true,
      whiteGlove: true,
      additionalStops: 3,
      extraPieces: 5,
      waitTime: 2,
    }));
    const computedFinal = result.subtotal + result.weightSurcharge + result.modifiersTotal;
    expect(result.finalQuote).toBeCloseTo(computedFinal, 10);
  });
});

// ============================================================
// Breakdown Object Shape
// ============================================================
describe("Breakdown Object Shape", () => {
  it("returns all expected fields", () => {
    const result = calculateRate("cargo_van", 30, 150, mods({ afterHours: true }));
    expect(result).toHaveProperty("baseRate");
    expect(result).toHaveProperty("mileageCharge");
    expect(result).toHaveProperty("fuelSurcharge");
    expect(result).toHaveProperty("subtotal");
    expect(result).toHaveProperty("weightSurcharge");
    expect(result).toHaveProperty("modifiersTotal");
    expect(result).toHaveProperty("finalQuote");
  });

  it("all values are numbers", () => {
    const result = calculateRate("cargo_van", 30, 150, mods());
    for (const [_key, value] of Object.entries(result)) {
      expect(typeof value).toBe("number");
    }
  });

  it("no values are NaN", () => {
    const result = calculateRate("cargo_van", 30, 150, mods());
    for (const [_key, value] of Object.entries(result)) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it("all values are non-negative for valid inputs", () => {
    const result = calculateRate("cargo_van", 30, 150, mods());
    expect(result.baseRate).toBeGreaterThanOrEqual(0);
    expect(result.mileageCharge).toBeGreaterThanOrEqual(0);
    expect(result.fuelSurcharge).toBeGreaterThanOrEqual(0);
    expect(result.subtotal).toBeGreaterThanOrEqual(0);
    expect(result.weightSurcharge).toBeGreaterThanOrEqual(0);
    expect(result.modifiersTotal).toBeGreaterThanOrEqual(0);
    expect(result.finalQuote).toBeGreaterThanOrEqual(0);
  });
});
