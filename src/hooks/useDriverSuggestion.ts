/**
 * useDriverSuggestion v2 — Auto-Dispatch Suggestion Hook
 *
 * Calls get_driver_suggestion RPC with pickup coords + optional cutoff_time.
 * Returns top-scored driver suggestion (ETA-aware, cutoff-enforced) or null.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverSuggestion {
  driver_id: string;
  driver_name: string;
  distance_km: number;
  active_loads_count: number;
  eta_to_pickup_min: number;
  eta_to_delivery_min: number;
  estimated_arrival_at_delivery: string;
  cutoff_margin_min: number | null;
  can_meet_cutoff: boolean;
  driver_status: "available" | "on_delivery";
  score: number;
}

interface LoadWithCoords {
  id: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  driver_id?: string | null;
  cutoff_time?: string | null;
}

interface UseDriverSuggestionResult {
  suggestion: DriverSuggestion | null;
  loading: boolean;
  error: string | null;
}

// ─── RPC param shape ──────────────────────────────────────────────────────────

interface GetDriverSuggestionParams {
  p_load_id: string;
  p_pickup_lat: number;
  p_pickup_lng: number;
  p_cutoff_time?: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDriverSuggestion(load: LoadWithCoords | null): UseDriverSuggestionResult {
  const [suggestion, setSuggestion] = useState<DriverSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch when we have a load with pickup coordinates and no driver assigned
    if (
      !load ||
      load.driver_id != null ||
      load.pickup_lat == null ||
      load.pickup_lng == null
    ) {
      setSuggestion(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchSuggestion = async () => {
      setLoading(true);
      setError(null);

      // Use type assertion — RPC not yet in generated types
      const client = supabase as unknown as {
        rpc: (
          fn: string,
          params: GetDriverSuggestionParams
        ) => Promise<{ data: DriverSuggestion[] | null; error: { message: string } | null }>;
      };

      const params: GetDriverSuggestionParams = {
        p_load_id: load.id,
        p_pickup_lat: load.pickup_lat,
        p_pickup_lng: load.pickup_lng,
        p_cutoff_time: load.cutoff_time ?? null,
      };

      const { data, error: rpcError } = await client.rpc("get_driver_suggestion", params);

      if (cancelled) return;

      if (rpcError) {
        // Gracefully degrade — don't surface error state to dispatcher
        setSuggestion(null);
        setError(null);
        setLoading(false);
        return;
      }

      setSuggestion(data && data.length > 0 ? data[0] : null);
      setLoading(false);
    };

    fetchSuggestion();

    return () => {
      cancelled = true;
    };
  }, [load?.id, load?.pickup_lat, load?.pickup_lng, load?.driver_id, load?.cutoff_time]);

  return { suggestion, loading, error };
}
