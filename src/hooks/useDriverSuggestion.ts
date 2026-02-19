/**
 * useDriverSuggestion — Auto-Dispatch Suggestion Hook
 *
 * Calls the get_driver_suggestion RPC with a load's pickup coordinates.
 * Returns the top-scored driver suggestion, or null when unavailable.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverSuggestion {
  driver_id: string;
  driver_name: string;
  distance_km: number;
  active_loads_count: number;
  shift_hours: number;
  score: number;
  last_lat: number;
  last_lng: number;
}

interface LoadWithCoords {
  id: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  driver_id?: string | null;
}

interface UseDriverSuggestionResult {
  suggestion: DriverSuggestion | null;
  loading: boolean;
  error: string | null;
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

      // Use type assertion so we can call this RPC before Supabase types are regenerated
      const client = supabase as unknown as {
        rpc: (
          fn: string,
          params: Record<string, unknown>
        ) => Promise<{ data: DriverSuggestion[] | null; error: { message: string } | null }>;
      };

      const { data, error: rpcError } = await client.rpc("get_driver_suggestion", {
        p_load_id: load.id,
        p_pickup_lat: load.pickup_lat,
        p_pickup_lng: load.pickup_lng,
      });

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
  }, [load?.id, load?.pickup_lat, load?.pickup_lng, load?.driver_id]);

  return { suggestion, loading, error };
}
