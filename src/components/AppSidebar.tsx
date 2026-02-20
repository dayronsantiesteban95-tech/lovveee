import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  LogOut,
  Moon,
  Sun,
  BookOpen,
  Shield,
  Calculator,
  ClipboardList,
  Truck,
  FileCheck,
  Crosshair,
  Clock,
  TrendingUp,
  ReceiptText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import logoBlanco from "@/assets/logo-blanco.png";

const mainNav = [
  { title: "Command Center", url: "/command-center", icon: Crosshair },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Dispatch", url: "/dispatch", icon: ClipboardList },
  { title: "Billing", url: "/billing", icon: ReceiptText },
  { title: "Task Board", url: "/tasks", icon: CheckSquare },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Rate Calculator", url: "/rate-calculator", icon: Calculator },
];

const resourcesNav = [
  { title: "SOP Wiki", url: "/sop-wiki", icon: BookOpen },
];

const fleetNav = [
  { title: "Fleet Tracker", url: "/fleet", icon: Truck },
  { title: "POD Manager", url: "/pod-manager", icon: FileCheck },
  { title: "Time Clock", url: "/time-clock", icon: Clock },
  { title: "Performance", url: "/performance", icon: TrendingUp },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { isOwner } = useUserRole();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const NavItem = ({ item }: { item: typeof mainNav[0] }) => (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end={item.url === "/dashboard"}
          className="flex items-center gap-3 px-3 py-1.5 rounded-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-300"
          activeClassName="bg-sidebar-primary/20 text-sidebar-primary font-semibold shadow-sm"
        >
          <div className="relative">
            <item.icon className="h-4 w-4" />
          </div>
          <span className="text-sm">{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar className="glass-panel border-r-0">
      <SidebarContent className="pt-3 flex flex-col h-full overflow-hidden">
        {/* Logo */}
        <div className="px-5 pb-3 flex-shrink-0">
          <img src={logoBlanco} alt="Anika Logistics" className="h-7 w-auto object-contain" />
        </div>
        <Separator className="bg-sidebar-border/50 mb-1 flex-shrink-0" />

        {/* Nav -- fills remaining space, no scroll */}
        <div className="flex flex-col flex-1 justify-between min-h-0 py-1">
          <div className="space-y-0">
            {/* Operations */}
            <div className="px-3 pt-1 pb-0.5">
              <span className="text-sidebar-foreground/40 uppercase text-[9px] tracking-[0.18em] font-semibold">Operations</span>
            </div>
            <SidebarMenu className="space-y-0 px-1">
              {mainNav.map((item) => <NavItem key={item.title} item={item} />)}
            </SidebarMenu>

            <Separator className="bg-sidebar-border/30 my-1 mx-3" />

            {/* Fleet */}
            <div className="px-3 pt-0.5 pb-0.5">
              <span className="text-sidebar-foreground/40 uppercase text-[9px] tracking-[0.18em] font-semibold">Fleet</span>
            </div>
            <SidebarMenu className="space-y-0 px-1">
              {fleetNav.map((item) => <NavItem key={item.title} item={item} />)}
            </SidebarMenu>

            <Separator className="bg-sidebar-border/30 my-1 mx-3" />

            {/* Resources + Admin */}
            <SidebarMenu className="space-y-0 px-1">
              {resourcesNav.map((item) => <NavItem key={item.title} item={item} />)}
              <NavItem item={{ title: "Team Management", url: "/team", icon: Shield }} />
            </SidebarMenu>
          </div>

          {/* Footer pinned to bottom */}
          <div className="px-3 pb-3 space-y-0.5 flex-shrink-0">
            <Separator className="bg-sidebar-border/30 mb-2" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-full transition-all duration-300 h-8"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              <span className="text-xs">{dark ? "Light Mode" : "Dark Mode"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-full transition-all duration-300 h-8"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="text-xs">Sign Out</span>
            </Button>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
