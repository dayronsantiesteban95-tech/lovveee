import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires immediately with the current session on subscription,
    // so getSession() is redundant and creates a race condition -- removed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setLoading(false);

        if (currentUser) {
          Sentry.setUser({
            id: currentUser.id,
            email: currentUser.email,
          });
        } else {
          Sentry.setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
