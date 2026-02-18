import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalHeader } from "@/components/GlobalHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Outlet, useLocation } from "react-router-dom";

export function AppLayout() {
  const location = useLocation();
  const isFullBleed = location.pathname === "/command-center";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <GlobalHeader />
          <div className="flex items-center px-4 py-2 border-b bg-card/50 md:hidden">
            <SidebarTrigger />
          </div>
          <main className={`flex-1 overflow-auto ${isFullBleed ? "" : "p-6"}`}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
