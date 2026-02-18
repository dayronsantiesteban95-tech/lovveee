import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<"owner" | "dispatcher" | null>(null);
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
          // Log but don't crash — default to dispatcher
          console.warn("[useUserRole] Error fetching role:", error.message);
          setRole("dispatcher");
        } else if (!data || !data.role) {
          // No role row yet (new user) — default to dispatcher
          setRole("dispatcher");
        } else {
          setRole((data.role as "owner" | "dispatcher") ?? "dispatcher");
        }
        setLoading(false);
      })
      .catch((err) => {
        // Unexpected error — never crash, default gracefully
        console.warn("[useUserRole] Unexpected error:", err);
        setRole("dispatcher");
        setLoading(false);
      });
  }, [user, authLoading]);

  return { role, isOwner: role === "owner", loading };
}
