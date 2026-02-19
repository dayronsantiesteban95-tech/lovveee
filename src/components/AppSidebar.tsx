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
          className="flex items-center gap-3 px-3 py-2.5 rounded-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-300"
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
      <SidebarContent className="pt-5">
        {/* Logo */}
        <div className="px-5 pb-4">
          <img src={logoBlanco} alt="Anika Logistics" className="h-8 w-auto object-contain" />
        </div>
        <Separator className="bg-sidebar-border/50 mb-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-[0.18em] font-semibold mb-2 px-3">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainNav.map((item) => <NavItem key={item.title} item={item} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="bg-sidebar-border/30 my-2 mx-3" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-[0.18em] font-semibold mb-2 px-3">
            Fleet
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {fleetNav.map((item) => <NavItem key={item.title} item={item} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="bg-sidebar-border/30 my-2 mx-3" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-[0.18em] font-semibold mb-2 px-3">
            Resources
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {resourcesNav.map((item) => <NavItem key={item.title} item={item} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="bg-sidebar-border/30 my-2 mx-3" />
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-[0.18em] font-semibold mb-2 px-3">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              <NavItem item={{ title: "Team Management", url: "/team", icon: Shield }} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-full transition-all duration-300"
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="text-sm">{dark ? "Light Mode" : "Dark Mode"}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-full transition-all duration-300"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm">Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
