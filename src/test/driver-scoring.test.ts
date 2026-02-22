import { describe, it, expect } from "vitest";
import { scoreDrivers, distanceMiles } from "@/utils/scoreDrivers";
import type { Driver, Load } from "@/pages/dispatch/types";
import type { DriverLocation } from "@/hooks/useRealtimeDriverLocations";

// ============================================================
// Test Factories
// ============================================================

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: overrides.id ?? "drv-1",
    full_name: overrides.full_name ?? "Test Driver",
    hub: overrides.hub ?? "phx",
    status: overrides.status ?? "active",
    ...overrides,
  };
}

function makeLocation(
  driverId: string,
  lat: number,
  lng: number,
): DriverLocation {
  return {
    id: `loc-${driverId}`,
    driver_id: driverId,
    driver_name: null,
    latitude: lat,
    longitude: lng,
    recorded_at: new Date().toISOString(),
    active_load_id: null,
  };
}

function makeLoad(overrides: Partial<Load> = {}): Load {
  return {
    id: overrides.id ?? "load-1",
    load_date: "2025-07-15",
    reference_number: null,
    dispatcher_id: null,
    driver_id: overrides.driver_id ?? null,
    vehicle_id: null,
    shift: "day",
    hub: "PHX",
    client_name: null,
    pickup_address: null,
    delivery_address: null,
    miles: 0,
    deadhead_miles: 0,
    start_time: null,
    end_time: null,
    wait_time_minutes: 0,
    revenue: 0,
    driver_pay: 0,
    fuel_cost: 0,
    status: "assigned",
    detention_eligible: false,
    detention_billed: 0,
    service_type: "AOG",
    packages: 1,
    weight_lbs: null,
    comments: null,
    pod_confirmed: false,
    created_at: "2025-07-15T10:00:00Z",
    updated_at: "2025-07-15T10:00:00Z",
    ...overrides,
  };
}

// ============================================================
// distanceMiles - Haversine formula
// ============================================================
describe("distanceMiles (Haversine)", () => {
  it("returns 0 for the same point", () => {
    expect(distanceMiles(33.4484, -112.074, 33.4484, -112.074)).toBeCloseTo(
      0,
      2,
    );
  });

  it("calculates distance between two known cities approximately", () => {
    // Phoenix to Tucson is ~110 miles
    const dist = distanceMiles(33.4484, -112.074, 32.2226, -110.9747);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(130);
  });

  it("calculates short distances accurately", () => {
    // ~1 mile apart in Phoenix metro
    const dist = distanceMiles(33.4484, -112.074, 33.4628, -112.074);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(2);
  });

  it("is symmetric (A->B == B->A)", () => {
    const ab = distanceMiles(33.4484, -112.074, 34.0489, -111.0937);
    const ba = distanceMiles(34.0489, -111.0937, 33.4484, -112.074);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it("handles cross-country distances", () => {
    // Phoenix to Atlanta is ~1600 miles
    const dist = distanceMiles(33.4484, -112.074, 33.749, -84.388);
    expect(dist).toBeGreaterThan(1400);
    expect(dist).toBeLessThan(1800);
  });
});

// ============================================================
// scoreDrivers - Scoring Algorithm
// ============================================================
describe("scoreDrivers", () => {
  // ----- Status Points (30 pts max) -----

  describe("status scoring", () => {
    it("awards 30 points for idle status", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      // With no GPS: distancePts=18, loadsToday=0: workloadPts=25
      // status=30 + distance=18 + workload=25 = 73
      expect(results[0].score).toBe(73);
    });

    it("awards 30 points for active status", () => {
      const drivers = [makeDriver({ id: "d1", status: "active" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].score).toBe(73);
    });

    it("awards 20 points for finishing_soon status", () => {
      const drivers = [makeDriver({ id: "d1", status: "finishing_soon" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      // 20 + 18 + 25 = 63
      expect(results[0].score).toBe(63);
    });

    it("awards 5 points for on_load status", () => {
      const drivers = [makeDriver({ id: "d1", status: "on_load" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      // 5 + 18 + 25 = 48
      expect(results[0].score).toBe(48);
    });

    it("awards 5 points for in_progress status", () => {
      const drivers = [makeDriver({ id: "d1", status: "in_progress" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      // 5 + 18 + 25 = 48
      expect(results[0].score).toBe(48);
    });

    it("awards 0 points for off/inactive status", () => {
      const drivers = [makeDriver({ id: "d1", status: "off" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      // 0 + 18 + 25 = 43
      expect(results[0].score).toBe(43);
    });

    it("is case-insensitive for status", () => {
      const drivers = [makeDriver({ id: "d1", status: "IDLE" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      // "IDLE".toLowerCase() === "idle" -> 30 pts
      expect(results[0].score).toBe(73);
    });
  });

  // ----- Distance Points (45 pts max) -----

  describe("distance scoring", () => {
    const pickupLat = 33.4484;
    const pickupLng = -112.074;

    it("awards 18 points (default) when no GPS data", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const results = scoreDrivers(drivers, [], pickupLat, pickupLng, "phx", []);
      // No location for d1, so distancePts=18
      // 30 + 18 + 25 = 73
      expect(results[0].score).toBe(73);
      expect(results[0].distanceMi).toBeNull();
    });

    it("awards 45 points when driver is < 5 miles away", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      // Very close to pickup (offset by ~0.01 degrees ~ <1 mile)
      const locs = [makeLocation("d1", pickupLat + 0.01, pickupLng)];
      const results = scoreDrivers(drivers, locs, pickupLat, pickupLng, "phx", []);
      // 30 + 45 + 25 = 100
      expect(results[0].score).toBe(100);
      expect(results[0].distanceMi).toBeLessThan(5);
    });

    it("awards 34 points when driver is 5-10 miles away", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      // ~7 miles away (0.1 degrees latitude is about 6.9 miles)
      const locs = [makeLocation("d1", pickupLat + 0.1, pickupLng)];
      const results = scoreDrivers(drivers, locs, pickupLat, pickupLng, "phx", []);
      // 30 + 34 + 25 = 89
      expect(results[0].score).toBe(89);
    });

    it("awards 23 points when driver is 10-20 miles away", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      // ~15 miles away (0.22 degrees ~ 15 mi)
      const locs = [makeLocation("d1", pickupLat + 0.22, pickupLng)];
      const results = scoreDrivers(drivers, locs, pickupLat, pickupLng, "phx", []);
      const dist = results[0].distanceMi!;
      expect(dist).toBeGreaterThanOrEqual(10);
      expect(dist).toBeLessThan(20);
      // 30 + 23 + 25 = 78
      expect(results[0].score).toBe(78);
    });

    it("awards 12 points when driver is 20-30 miles away", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      // ~25 miles away (0.36 degrees ~ 25 mi)
      const locs = [makeLocation("d1", pickupLat + 0.36, pickupLng)];
      const results = scoreDrivers(drivers, locs, pickupLat, pickupLng, "phx", []);
      const dist = results[0].distanceMi!;
      expect(dist).toBeGreaterThanOrEqual(20);
      expect(dist).toBeLessThan(30);
      // 30 + 12 + 25 = 67
      expect(results[0].score).toBe(67);
    });

    it("awards 5 points when driver is >= 30 miles away", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      // ~50 miles away
      const locs = [makeLocation("d1", pickupLat + 0.72, pickupLng)];
      const results = scoreDrivers(drivers, locs, pickupLat, pickupLng, "phx", []);
      expect(results[0].distanceMi!).toBeGreaterThanOrEqual(30);
      // 30 + 5 + 25 = 60
      expect(results[0].score).toBe(60);
    });

    it("awards default 18 when pickup coordinates are null", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const locs = [makeLocation("d1", 33.45, -112.07)];
      const results = scoreDrivers(drivers, locs, null, null, "phx", []);
      expect(results[0].distanceMi).toBeNull();
      // 30 + 18 + 25 = 73
      expect(results[0].score).toBe(73);
    });
  });

  // ----- Workload Points (25 pts max) -----

  describe("workload scoring", () => {
    it("awards 25 points for 0 loads today", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      // 30 + 18 + 25 = 73
      expect(results[0].score).toBe(73);
    });

    it("awards 18 points for 1 load today", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const loads = [makeLoad({ driver_id: "d1" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", loads);
      // 30 + 18 + 18 = 66
      expect(results[0].score).toBe(66);
    });

    it("awards 11 points for 2 loads today", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const loads = [
        makeLoad({ id: "l1", driver_id: "d1" }),
        makeLoad({ id: "l2", driver_id: "d1" }),
      ];
      const results = scoreDrivers(drivers, [], null, null, "phx", loads);
      // 30 + 18 + 11 = 59
      expect(results[0].score).toBe(59);
    });

    it("awards 5 points for 3+ loads today", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const loads = [
        makeLoad({ id: "l1", driver_id: "d1" }),
        makeLoad({ id: "l2", driver_id: "d1" }),
        makeLoad({ id: "l3", driver_id: "d1" }),
      ];
      const results = scoreDrivers(drivers, [], null, null, "phx", loads);
      // 30 + 18 + 5 = 53
      expect(results[0].score).toBe(53);
    });

    it("awards 5 points for 5 loads (>= 3 threshold)", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const loads = Array.from({ length: 5 }, (_, i) =>
        makeLoad({ id: `l${i}`, driver_id: "d1" }),
      );
      const results = scoreDrivers(drivers, [], null, null, "phx", loads);
      // 30 + 18 + 5 = 53
      expect(results[0].score).toBe(53);
    });

    it("only counts loads for the specific driver", () => {
      const drivers = [
        makeDriver({ id: "d1", status: "idle" }),
        makeDriver({ id: "d2", status: "idle" }),
      ];
      const loads = [
        makeLoad({ id: "l1", driver_id: "d1" }),
        makeLoad({ id: "l2", driver_id: "d1" }),
        makeLoad({ id: "l3", driver_id: "d2" }),
      ];
      const results = scoreDrivers(drivers, [], null, null, "phx", loads);
      const d1 = results.find((r) => r.driver.id === "d1")!;
      const d2 = results.find((r) => r.driver.id === "d2")!;
      // d1: 2 loads -> workload=11, d2: 1 load -> workload=18
      expect(d1.score).toBe(30 + 18 + 11); // 59
      expect(d2.score).toBe(30 + 18 + 18); // 66
    });
  });

  // ----- Ranking / Sorting -----

  describe("ranking order", () => {
    it("returns drivers sorted by score descending", () => {
      const drivers = [
        makeDriver({ id: "d1", status: "off", full_name: "Off Driver" }),        // 0+18+25=43
        makeDriver({ id: "d2", status: "idle", full_name: "Idle Driver" }),       // 30+18+25=73
        makeDriver({ id: "d3", status: "finishing_soon", full_name: "Finishing" }), // 20+18+25=63
      ];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].driver.id).toBe("d2"); // score 73
      expect(results[1].driver.id).toBe("d3"); // score 63
      expect(results[2].driver.id).toBe("d1"); // score 43
    });

    it("ranks nearby idle drivers first", () => {
      const pickupLat = 33.4484;
      const pickupLng = -112.074;

      const drivers = [
        makeDriver({ id: "far", status: "idle", full_name: "Far Driver" }),
        makeDriver({ id: "close", status: "idle", full_name: "Close Driver" }),
      ];

      const locs = [
        makeLocation("far", pickupLat + 0.72, pickupLng),   // ~50 mi => 5 pts
        makeLocation("close", pickupLat + 0.01, pickupLng), // <1 mi  => 45 pts
      ];

      const results = scoreDrivers(drivers, locs, pickupLat, pickupLng, "phx", []);
      expect(results[0].driver.id).toBe("close"); // 30+45+25=100
      expect(results[1].driver.id).toBe("far");   // 30+5+25=60
    });

    it("ranks lower-workload drivers higher when status and distance are equal", () => {
      const drivers = [
        makeDriver({ id: "busy", status: "idle", full_name: "Busy Driver" }),
        makeDriver({ id: "free", status: "idle", full_name: "Free Driver" }),
      ];
      const loads = [
        makeLoad({ id: "l1", driver_id: "busy" }),
        makeLoad({ id: "l2", driver_id: "busy" }),
        makeLoad({ id: "l3", driver_id: "busy" }),
      ];
      const results = scoreDrivers(drivers, [], null, null, "phx", loads);
      expect(results[0].driver.id).toBe("free"); // 73
      expect(results[1].driver.id).toBe("busy"); // 53
    });
  });

  // ----- Availability Flag -----

  describe("availability flag", () => {
    it("marks idle drivers as available", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].isAvailable).toBe(true);
    });

    it("marks active drivers as available", () => {
      const drivers = [makeDriver({ id: "d1", status: "active" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].isAvailable).toBe(true);
    });

    it("marks finishing_soon drivers as unavailable", () => {
      const drivers = [makeDriver({ id: "d1", status: "finishing_soon" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].isAvailable).toBe(false);
    });

    it("marks on_load drivers as unavailable", () => {
      const drivers = [makeDriver({ id: "d1", status: "on_load" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].isAvailable).toBe(false);
    });

    it("marks off drivers as unavailable", () => {
      const drivers = [makeDriver({ id: "d1", status: "off" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].isAvailable).toBe(false);
    });
  });

  // ----- Reasoning String -----

  describe("reasoning string", () => {
    it("includes distance when GPS data is available", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const locs = [makeLocation("d1", 33.45, -112.07)];
      const results = scoreDrivers(drivers, locs, 33.4484, -112.074, "phx", []);
      expect(results[0].reasoning).toContain("mi away");
    });

    it("includes 'No GPS data' when location is unavailable", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const results = scoreDrivers(drivers, [], 33.4484, -112.074, "phx", []);
      expect(results[0].reasoning).toContain("No GPS data");
    });

    it("includes 'Idle' for available drivers", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].reasoning).toContain("Idle");
    });

    it("includes 'Finishing soon' for finishing_soon status", () => {
      const drivers = [makeDriver({ id: "d1", status: "finishing_soon" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].reasoning).toContain("Finishing soon");
    });

    it("includes 'Currently on load' for on_load status", () => {
      const drivers = [makeDriver({ id: "d1", status: "on_load" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].reasoning).toContain("Currently on load");
    });

    it("includes 'Offline' for off status", () => {
      const drivers = [makeDriver({ id: "d1", status: "off" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].reasoning).toContain("Offline");
    });

    it("includes 'Light workload' when no loads today", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results[0].reasoning).toContain("Light workload");
    });

    it("includes load count when loads > 0", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const loads = [
        makeLoad({ id: "l1", driver_id: "d1" }),
        makeLoad({ id: "l2", driver_id: "d1" }),
      ];
      const results = scoreDrivers(drivers, [], null, null, "phx", loads);
      expect(results[0].reasoning).toContain("2 loads today");
    });

    it("uses singular 'load' for 1 load", () => {
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const loads = [makeLoad({ id: "l1", driver_id: "d1" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", loads);
      expect(results[0].reasoning).toContain("1 load today");
    });
  });

  // ----- Edge Cases -----

  describe("edge cases", () => {
    it("returns empty array when no drivers provided", () => {
      const results = scoreDrivers([], [], 33.4484, -112.074, "phx", []);
      expect(results).toEqual([]);
    });

    it("handles a single driver", () => {
      const drivers = [makeDriver({ id: "d1" })];
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results).toHaveLength(1);
    });

    it("handles many drivers", () => {
      const drivers = Array.from({ length: 50 }, (_, i) =>
        makeDriver({ id: `d${i}`, full_name: `Driver ${i}` }),
      );
      const results = scoreDrivers(drivers, [], null, null, "phx", []);
      expect(results).toHaveLength(50);
      // Should still be sorted
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("score range is 0-100", () => {
      // Perfect score: idle + <5mi + 0 loads
      const drivers = [makeDriver({ id: "d1", status: "idle" })];
      const locs = [makeLocation("d1", 33.4484, -112.074)]; // same point
      const results = scoreDrivers(drivers, locs, 33.4484, -112.074, "phx", []);
      expect(results[0].score).toBe(100);

      // Worst score: off + >= 30mi + 3+ loads
      const drivers2 = [makeDriver({ id: "d2", status: "off" })];
      const locs2 = [makeLocation("d2", 34.0, -112.074)]; // ~38 mi
      const loads = Array.from({ length: 3 }, (_, i) =>
        makeLoad({ id: `l${i}`, driver_id: "d2" }),
      );
      const results2 = scoreDrivers(drivers2, locs2, 33.4484, -112.074, "phx", loads);
      // 0 + 5 + 5 = 10
      expect(results2[0].score).toBe(10);
    });

    it("returns distanceMi as null when no GPS for driver", () => {
      const drivers = [makeDriver({ id: "d1" })];
      const results = scoreDrivers(drivers, [], 33.4484, -112.074, "phx", []);
      expect(results[0].distanceMi).toBeNull();
    });

    it("returns correct driver reference in results", () => {
      const driver = makeDriver({ id: "d1", full_name: "Jane Doe" });
      const results = scoreDrivers([driver], [], null, null, "phx", []);
      expect(results[0].driver).toBe(driver);
      expect(results[0].driver.full_name).toBe("Jane Doe");
    });
  });
});
