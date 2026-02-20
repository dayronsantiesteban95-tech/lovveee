import type { Driver, Load } from "@/pages/dispatch/types";
import type { DriverLocation } from "@/hooks/useRealtimeDriverLocations";

// --- Haversine distance in miles ---------------------------------------------

export function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Types -------------------------------------------------------------------

export interface DriverScore {
  driver: Driver;
  score: number;        // 0-100
  distanceMi: number | null;
  reasoning: string;
  isAvailable: boolean;
}

// --- Scoring -----------------------------------------------------------------

export function scoreDrivers(
  drivers: Driver[],
  driverLocations: DriverLocation[],
  pickupLat: number | null,
  pickupLng: number | null,
  _loadHub: string, // Hub is a hard filter applied by the caller -- not scored here
  todayLoads: Load[],
): DriverScore[] {
  const results: DriverScore[] = drivers.map((driver) => {
    // -- GPS lookup ----------------------------------------------------------
    const loc = driverLocations.find((l) => l.driver_id === driver.id);
    let distanceMi: number | null = null;
    if (loc && pickupLat != null && pickupLng != null) {
      distanceMi = distanceMiles(pickupLat, pickupLng, loc.latitude, loc.longitude);
    }

    // -- Load count today ----------------------------------------------------
    const loadsToday = todayLoads.filter((l) => l.driver_id === driver.id).length;

    // -- Status (30 pts) -----------------------------------------------------
    const statusLower = driver.status.toLowerCase();
    let statusPts = 0;
    if (statusLower === "idle" || statusLower === "active") statusPts = 30;
    else if (statusLower === "finishing_soon") statusPts = 20;
    else if (statusLower === "on_load" || statusLower === "in_progress") statusPts = 5;
    // off / inactive = 0

    // -- Distance (45 pts) ---------------------------------------------------
    // Hub is a hard filter applied upstream -- no hub pts here.
    let distancePts = 18; // default when no GPS (proportional middle)
    if (distanceMi != null) {
      if (distanceMi < 5) distancePts = 45;
      else if (distanceMi < 10) distancePts = 34;
      else if (distanceMi < 20) distancePts = 23;
      else if (distanceMi < 30) distancePts = 12;
      else distancePts = 5;
    }

    // -- Workload (25 pts) ---------------------------------------------------
    let workloadPts = 25;
    if (loadsToday === 1) workloadPts = 18;
    else if (loadsToday === 2) workloadPts = 11;
    else if (loadsToday >= 3) workloadPts = 5;

    const score = statusPts + distancePts + workloadPts;

    // -- Availability flag ---------------------------------------------------
    const isAvailable = statusLower === "idle" || statusLower === "active";

    // -- Reasoning string ----------------------------------------------------
    const parts: string[] = [];

    if (distanceMi != null) {
      parts.push(`${distanceMi.toFixed(1)} mi away`);
    } else {
      parts.push("No GPS data");
    }

    if (isAvailable) {
      parts.push("Idle");
    } else if (statusLower === "finishing_soon") {
      parts.push("Finishing soon");
    } else if (statusLower === "on_load" || statusLower === "in_progress") {
      parts.push("Currently on load");
    } else {
      parts.push("Offline");
    }

    if (loadsToday === 0) {
      parts.push("Light workload");
    } else {
      parts.push(`${loadsToday} load${loadsToday > 1 ? "s" : ""} today`);
    }

    return {
      driver,
      score,
      distanceMi,
      reasoning: parts.join(" ? "),
      isAvailable,
    };
  });

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}
