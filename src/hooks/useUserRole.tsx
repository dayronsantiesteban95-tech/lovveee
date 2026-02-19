import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Role hierarchy for the Anika dispatcher app:
//   owner      → Full access. Can delete loads, manage QB OAuth, delete users.
//   dispatcher → Operational access. Can add/remove users, see billing, create/edit loads.
//                Cannot delete loads permanently or access QB OAuth settings.
//   driver     → No dispatcher app access (redirected to WrongApp). Uses driver mobile app only.
//
// TODO(driver-rls): Driver data isolation must be enforced at the Supabase RLS level
// on the driver app side. Drivers should only be able to SELECT/UPDATE their own rows
// in daily_loads (WHERE driver_id = auth.uid()). Do NOT implement here — enforce via
// Supabase RLS policies on the driver app's Supabase project.

export type UserRole = "owner" | "dispatcher" | "driver";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Don't resolve role until auth has finished loading
    if (authLoading) return;

    if (!user) { setRole(null); setLoading(false); return; }

    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          // Don't crash — default to dispatcher
          setRole("dispatcher");
        } else if (!data || !data.role) {
          // No role row yet (new user) — default to dispatcher
          setRole("dispatcher");
        } else {
          setRole((data.role as UserRole) ?? "dispatcher");
        }
        setLoading(false);
      })
      .catch(() => {
        // Unexpected error — never crash, default gracefully
        setRole("dispatcher");
        setLoading(false);
      });
  }, [user, authLoading]);

  const isOwner = role === "owner";
  const isDispatcher = role === "dispatcher";

  return { role, isOwner, isDispatcher, loading };
}
