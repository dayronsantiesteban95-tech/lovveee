import { Suspense, lazy } from "react";
import * as Sentry from "@sentry/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/AppLayout";
import { WrongApp } from "@/components/WrongApp";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import NotFound from "./pages/NotFound";

// Chunk retry helper -- retries dynamic imports up to 3x with exponential back-off.
// Prevents "This section failed to load" on transient network blips after a redeploy.
function retryImport<T>(factory: () => Promise<T>, retries = 3, delay = 800): Promise<T> {
  return factory().catch(async (err) => {
    if (retries <= 0) throw err;
    await new Promise((r) => setTimeout(r, delay));
    return retryImport(factory, retries - 1, delay * 2);
  });
}

function lazyWithRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() => retryImport(factory));
}

// Lazy-loaded pages -- these are the largest chunks
const PrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/legal/TermsOfService"));
const QuickBooksCallback = lazy(() => import("@/pages/QuickBooksCallback"));
const RateCalculator = lazyWithRetry(() => import("@/pages/RateCalculator"));
const TaskBoard = lazyWithRetry(() => import("@/pages/TaskBoard"));
const CalendarView = lazyWithRetry(() => import("@/pages/CalendarView"));
const SopWiki = lazyWithRetry(() => import("@/pages/SopWiki"));
const TeamManagement = lazyWithRetry(() => import("@/pages/TeamManagement"));
const DispatchTracker = lazyWithRetry(() => import("@/pages/DispatchTracker"));
const FleetTracker = lazyWithRetry(() => import("@/pages/FleetTracker"));
const PodManager = lazyWithRetry(() => import("@/pages/PodManager"));
const CommandCenter = lazyWithRetry(() => import("@/pages/CommandCenter"));
const TrackDelivery = lazyWithRetry(() => import("@/pages/TrackDelivery"));
const TimeClock = lazyWithRetry(() => import("@/pages/TimeClock"));
const DriverPerformance = lazyWithRetry(() => import("@/pages/DriverPerformance"));
const Billing = lazyWithRetry(() => import("@/pages/Billing"));
const RevenueAnalytics = lazyWithRetry(() => import("@/pages/RevenueAnalytics"));
const PdfCombiner = lazyWithRetry(() => import("@/pages/PdfCombiner"));
import CommandBar from "@/components/CommandBar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed queries up to 3 times with exponential back-off
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      // Consider data stale after 60 seconds
      staleTime: 60_000,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

/** Lightweight fallback for route-level error boundaries */
function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        color: "#94a3b8",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <span style={{ fontSize: "2rem" }}>(!)</span>
      <p style={{ fontWeight: 600 }}>This section failed to load.</p>
      <p style={{ fontSize: "0.85rem" }}>
        The error has been reported. Try refreshing the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: "8px",
          padding: "0.4rem 1.2rem",
          background: "#f97316",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Refresh
      </button>
    </div>
  );
}

function ProtectedRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  // Wait for both auth and role to resolve before rendering anything
  if (authLoading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Drivers belong in the mobile app -- show the wrong-app screen immediately,
  // before any dispatcher page or Supabase query fires.
  if (role === "driver") return <WrongApp />;

  return <AppLayout />;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/command-center" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CommandBar />
        {/* Route-level error boundary: catches errors in any child route */}
        <Sentry.ErrorBoundary fallback={<RouteFallback />}>
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/auth/quickbooks/callback" element={<QuickBooksCallback />} />
              <Route path="/track" element={<TrackDelivery />} />
              <Route path="/track/:token" element={<TrackDelivery />} />
              <Route path="/legal/privacy" element={<PrivacyPolicy />} />
              <Route path="/legal/terms" element={<TermsOfService />} />
              <Route element={<ProtectedRoutes />}>
                {/* Critical ops wrapped with their own boundaries so a billing crash
                    doesn't take down dispatch, and vice versa */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tasks" element={<TaskBoard />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/sop-wiki" element={<SopWiki />} />
                <Route path="/team" element={<TeamManagement />} />
                <Route path="/rate-calculator" element={<RateCalculator />} />
                <Route
                  path="/command-center"
                  element={
                    <Sentry.ErrorBoundary fallback={<RouteFallback />}>
                      <CommandCenter />
                    </Sentry.ErrorBoundary>
                  }
                />
                <Route
                  path="/dispatch"
                  element={
                    <Sentry.ErrorBoundary fallback={<RouteFallback />}>
                      <DispatchTracker />
                    </Sentry.ErrorBoundary>
                  }
                />
                <Route
                  path="/fleet"
                  element={
                    <Sentry.ErrorBoundary fallback={<RouteFallback />}>
                      <FleetTracker />
                    </Sentry.ErrorBoundary>
                  }
                />
                <Route
                  path="/billing"
                  element={
                    <Sentry.ErrorBoundary fallback={<RouteFallback />}>
                      <Billing />
                    </Sentry.ErrorBoundary>
                  }
                />
                <Route
                  path="/revenue"
                  element={
                    <Sentry.ErrorBoundary fallback={<RouteFallback />}>
                      <RevenueAnalytics />
                    </Sentry.ErrorBoundary>
                  }
                />
                <Route path="/pod-manager" element={<PodManager />} />
                <Route path="/time-clock" element={<TimeClock />} />
                <Route path="/performance" element={<DriverPerformance />} />
                <Route path="/pdf-combiner" element={<PdfCombiner />} />
                <Route path="/" element={<Navigate to="/command-center" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Sentry.ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
