import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeDriverLocations } from "@/hooks/useRealtimeDriverLocations";
import { scoreDrivers } from "@/utils/scoreDrivers";
import { todayISO } from "@/lib/formatters";
import type { Driver, Load } from "@/pages/dispatch/types";
import type { DriverScore } from "@/utils/scoreDrivers";

export function useDriverAvailability(
  pickupLat?: number,
  pickupLng?: number,
  hub?: string,
) {
  const [drivers, setDrivers] = useState<DriverScore[]>([]);
  const [loading, setLoading] = useState(true);
  const { drivers: driverLocations } = useRealtimeDriverLocations();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. All active drivers
      const { data: driverData } = await supabase
        .from("drivers")
        .select("id, full_name, hub, status")
        .eq("status", "active");

      // 2. Today's loads for workload scoring
      const { data: loadsData } = await supabase
        .from("daily_loads")
        .select(
          "id, load_date, reference_number, dispatcher_id, driver_id, vehicle_id, shift, hub, client_name, pickup_address, delivery_address, miles, deadhead_miles, start_time, end_time, wait_time_minutes, revenue, driver_pay, fuel_cost, status, detention_eligible, detention_billed, service_type, packages, weight_lbs, comments, pod_confirmed, created_at, updated_at",
        )
        .eq("load_date", todayISO());

      const rawDrivers = (driverData ?? []) as Driver[];
      const rawLoads = (loadsData ?? []) as Load[];

      const scored = scoreDrivers(
        rawDrivers,
        driverLocations,
        pickupLat ?? null,
        pickupLng ?? null,
        hub ?? "PHX",
        rawLoads,
      );

      setDrivers(scored);
    } catch (err) {
      console.error("useDriverAvailability error:", err);
    } finally {
      setLoading(false);
    }
  }, [driverLocations, pickupLat, pickupLng, hub]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { drivers, loading, refresh: fetchData };
}
