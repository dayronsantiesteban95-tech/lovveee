import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages — these are the largest chunks
const QuickBooksCallback = lazy(() => import("@/pages/QuickBooksCallback"));
const RateCalculator = lazy(() => import("@/pages/RateCalculator"));
const TaskBoard = lazy(() => import("@/pages/TaskBoard"));
const CalendarView = lazy(() => import("@/pages/CalendarView"));
const SopWiki = lazy(() => import("@/pages/SopWiki"));
const TeamManagement = lazy(() => import("@/pages/TeamManagement"));
const DispatchTracker = lazy(() => import("@/pages/DispatchTracker"));
const FleetTracker = lazy(() => import("@/pages/FleetTracker"));
const PodManager = lazy(() => import("@/pages/PodManager"));
const CommandCenter = lazy(() => import("@/pages/CommandCenter"));
const TrackDelivery = lazy(() => import("@/pages/TrackDelivery"));
const TimeClock = lazy(() => import("@/pages/TimeClock"));
const DriverPerformance = lazy(() => import("@/pages/DriverPerformance"));
const Billing = lazy(() => import("@/pages/Billing"));
import CommandBar from "@/components/CommandBar";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

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
            <Route element={<ProtectedRoutes />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tasks" element={<TaskBoard />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/sop-wiki" element={<SopWiki />} />
              <Route path="/team" element={<TeamManagement />} />
              <Route path="/rate-calculator" element={<RateCalculator />} />
              <Route path="/command-center" element={<CommandCenter />} />
              <Route path="/dispatch" element={<DispatchTracker />} />
              <Route path="/fleet" element={<FleetTracker />} />
              <Route path="/pod-manager" element={<PodManager />} />
              <Route path="/time-clock" element={<TimeClock />} />
              <Route path="/performance" element={<DriverPerformance />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/" element={<Navigate to="/command-center" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
