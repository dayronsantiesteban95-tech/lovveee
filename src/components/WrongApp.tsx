import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

const APK_URL =
  "https://expo.dev/artifacts/eas/52ctcfSw9B2tTC8KfrNsJx.apk";

export function WrongApp() {
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-6">
      {/* Logo / wordmark */}
      <div className="text-3xl font-bold tracking-tight text-foreground">
        Anika
      </div>

      {/* Main message */}
      <div className="flex flex-col gap-2 max-w-sm">
        <h1 className="text-xl font-semibold text-foreground">
          You're in the wrong place.
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The <strong>Anika Driver App</strong> is where you need to be.
          <br />
          This portal is for dispatchers and managers only.
        </p>
      </div>

      {/* APK download link -- only shown on mobile */}
      {isMobile && (
        <a
          href={APK_URL}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
          download
        >
          ?? Download the Driver App (APK)
        </a>
      )}

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}
