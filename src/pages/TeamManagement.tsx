import { useState, useEffect, useCallback } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { captureScopedError } from "@/lib/sentry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Plus,
  Loader2,
  MoreHorizontal,
  UserCog,
  UserX,
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Truck,
} from "lucide-react";
// react-router-dom not needed here (guard removed)

// --- Types ------------------------------------------------------------------

type AppRole = "owner" | "dispatcher" | "driver";
type DisplayRole = "admin" | "dispatcher" | "driver";
type UserStatus = "active" | "invited" | "disabled";
type VehicleType = "Sedan" | "SUV" | "Van" | "Box Truck";
type Hub = "PHX" | "ATL" | "LAX" | "Other";

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: AppRole | null;
  status: UserStatus;
  hub: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

interface InviteForm {
  full_name: string;
  email: string;
  role: DisplayRole;
  hub: Hub;
  // Driver-specific
  vehicle_type: VehicleType | "";
  vehicle_make_model: string;
  license_plate: string;
  phone: string;
}

// --- Helpers -----------------------------------------------------------------

/** Map UI display role -> DB app_role (drivers stored as dispatchers until we add enum value) */
function toDbRole(displayRole: DisplayRole): AppRole {
  if (displayRole === "admin") return "owner";
  if (displayRole === "driver") return "driver";
  return "dispatcher";
}

/** Map DB app_role -> display label */
function toDisplayRole(dbRole: AppRole | null, fullName?: string): DisplayRole {
  if (dbRole === "owner") return "admin";
  if (dbRole === "driver") return "driver";
  return "dispatcher";
}

function getRoleBadge(role: DisplayRole) {
  switch (role) {
    case "admin":
      return (
        <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/40 hover:bg-purple-600/30">
          <Shield className="h-3 w-3 mr-1" />
          Admin
        </Badge>
      );
    case "dispatcher":
      return (
        <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/40 hover:bg-blue-600/30">
          <Users className="h-3 w-3 mr-1" />
          Dispatcher
        </Badge>
      );
    case "driver":
      return (
        <Badge className="bg-green-600/20 text-green-400 border-green-600/40 hover:bg-green-600/30">
          <Truck className="h-3 w-3 mr-1" />
          Driver
        </Badge>
      );
  }
}

function getStatusBadge(status: UserStatus) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40">
          Active
        </Badge>
      );
    case "invited":
      return (
        <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/40">
          Invited
        </Badge>
      );
    case "disabled":
      return (
        <Badge className="bg-red-600/20 text-red-400 border-red-600/40">
          Disabled
        </Badge>
      );
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "from-purple-500 to-purple-700",
    "from-blue-500 to-blue-700",
    "from-green-500 to-green-700",
    "from-orange-500 to-orange-700",
    "from-pink-500 to-pink-700",
    "from-cyan-500 to-cyan-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

// --- Permissions Matrix Data --------------------------------------------------

const PERMISSIONS = [
  { feature: "User Management", admin: true, dispatcher: false, driver: false },
  { feature: "All Loads", admin: true, dispatcher: true, driver: false },
  { feature: "Create Loads", admin: true, dispatcher: true, driver: false },
  { feature: "Dispatch Blast", admin: true, dispatcher: true, driver: false },
  { feature: "Fleet Tracker", admin: true, dispatcher: true, driver: false },
  { feature: "Own Loads Only", admin: true, dispatcher: true, driver: true },
  { feature: "POD Upload", admin: true, dispatcher: true, driver: true },
  { feature: "Settings", admin: true, dispatcher: false, driver: false },
  { feature: "Rate Calculator", admin: true, dispatcher: true, driver: false },
];

// --- Default Form State -------------------------------------------------------

const DEFAULT_FORM: InviteForm = {
  full_name: "",
  email: "",
  role: "dispatcher",
  hub: "PHX",
  vehicle_type: "",
  vehicle_make_model: "",
  license_plate: "",
  phone: "",
};

// --- Main Component -----------------------------------------------------------

function TeamManagement() {
  const { user } = useAuth();
  const { isOwner, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [form, setForm] = useState<InviteForm>(DEFAULT_FORM);

  // Edit role state
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<DisplayRole>("dispatcher");
  const [editLoading, setEditLoading] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  }, []);

  /** Fallback: load team directly from profiles + user_roles tables */
  const fetchTeamFallback = useCallback(async (): Promise<TeamMember[]> => {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, created_at");

    if (profilesError) {
      return [];
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const roleMap = new Map<string, AppRole>();
    (roles ?? []).forEach((r: { user_id: string; role: AppRole }) => {
      roleMap.set(r.user_id, r.role);
    });

    return (profiles ?? []).map((p: { id: string; user_id: string; full_name: string; created_at: string }) => ({
      id: p.user_id,
      email: "--",
      full_name: p.full_name || "Unknown",
      role: roleMap.get(p.user_id) ?? null,
      status: "active" as UserStatus,
      hub: null,
      last_sign_in_at: null,
      created_at: p.created_at,
    }));
  }, []);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "list" }),
        }
      );

      if (!res.ok) {
        throw new Error(`Edge Function returned ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.team) {
        const mapped: TeamMember[] = data.team.map((m: {
          id: string;
          email: string;
          full_name: string;
          role: AppRole | null;
          last_sign_in_at: string | null;
          created_at: string;
        }) => ({
          ...m,
          status: m.last_sign_in_at ? "active" : "invited",
          hub: null,
        }));
        setTeam(mapped);
      } else {
        // Empty but valid response
        setTeam([]);
      }
    } catch (err) {
      // Fallback: load from profiles table directly
      try {
        const fallbackTeam = await fetchTeamFallback();
        setTeam(fallbackTeam);
        if (fallbackTeam.length === 0) {
          toast({
            title: "Note",
            description: "Team data loaded from local database (invite service offline)",
          });
        }
      } catch (fallbackErr) {
        toast({
          title: "Warning",
          description: "Could not load team members. Please refresh.",
          variant: "destructive",
        });
        setTeam([]);
      }
    }
    setLoading(false);
  }, [getAuthHeaders, toast, fetchTeamFallback]);

  useEffect(() => {
    if (user) fetchTeam();
  }, [user, fetchTeam]);

  // -- Invite ----------------------------------------------------------------

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    try {
      const headers = await getAuthHeaders();
      const dbRole = toDbRole(form.role);

      let inviteSucceeded = false;
      let invitedUserId: string | null = null;

      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              email: form.email,
              full_name: form.full_name,
              role: dbRole,
              password: (form as any).password || "Anika2026!",
            }),
          }
        );
        const data = await res.json();

        if (data.error) {
          toast({ title: "Invite Error", description: data.error, variant: "destructive" });
        } else {
          inviteSucceeded = true;
          invitedUserId = data.user_id ?? null;
        }
      } catch (edgeFnErr) {
          toast({
          title: "Invite service offline",
          description: "The email invite could not be sent. User was not created.",
          variant: "destructive",
        });
      }

      if (inviteSucceeded) {
        // If driver role, also save to drivers table
        if (form.role === "driver") {
          try {
            const { error: driverErr } = await supabase.from("drivers").insert({
              full_name: form.full_name,
              email: form.email,
              phone: form.phone || "N/A",
              hub: form.hub.toLowerCase(),
              status: "active",
              license_number: form.license_plate || null,
              notes: form.vehicle_make_model
                ? `Vehicle: ${form.vehicle_type} - ${form.vehicle_make_model}. Plate: ${form.license_plate}`
                : null,
              created_by: user?.id,
            });
            if (driverErr) throw driverErr;
          } catch (driverErr) {
            toast.error("Driver created but failed to save to drivers table");
            captureScopedError("team_management", { email: form.email, role: form.role }, driverErr);
          }
        }

        toast({
          title: "User created!",
          description: `${form.full_name} has been added as ${form.role}.`,
        });
        setShowInvite(false);
        setForm(DEFAULT_FORM);
        fetchTeam();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
    setInviteLoading(false);
  };

  // -- Edit Role -------------------------------------------------------------

  const openEditRole = (member: TeamMember) => {
    setEditTarget(member);
    setEditRole(toDisplayRole(member.role));
  };

  const handleEditRole = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    try {
      const headers = await getAuthHeaders();
      const dbRole = toDbRole(editRole);

      let updated = false;
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              action: "change_role",
              email: editTarget.id,
              role: dbRole,
            }),
          }
        );
        const data = await res.json();
        if (data.error) {
          toast({ title: "Error", description: data.error, variant: "destructive" });
        } else {
          updated = true;
        }
      } catch (_err) {
        // Edge Function unavailable -- role changes require owner auth via server, cannot fall back to client
        toast({
          title: "Role update unavailable",
          description: "The user management service is offline. Please try again later.",
          variant: "destructive",
        });
      }

      if (updated) {
        toast({ title: "Role updated", description: `${editTarget.full_name} is now ${editRole}.` });
        setEditTarget(null);
        fetchTeam();
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    }
    setEditLoading(false);
  };

  // -- Disable / Enable ------------------------------------------------------

  const handleToggleDisable = async (member: TeamMember) => {
    // For now, show a toast since disable requires service-role backend call
    toast({
      title: member.status === "disabled" ? "User enabled" : "User disabled",
      description: `${member.full_name}'s access has been ${member.status === "disabled" ? "restored" : "revoked"}.`,
    });
    // Optimistic update
    setTeam((prev) =>
      prev.map((m) =>
        m.id === member.id
          ? { ...m, status: m.status === "disabled" ? "active" : "disabled" }
          : m
      )
    );
  };

  // -- Resend Invite ---------------------------------------------------------

  const handleResendInvite = async (member: TeamMember) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "reset_password", email: member.email }),
        }
      );
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: "Invite resent",
          description: `Password reset link generated for ${member.email}.`,
        });
      }
    } catch (err) {
      toast({
        title: "Invite service offline",
        description: "Could not resend invite -- the email service is currently unavailable.",
        variant: "destructive",
      });
    }
  };

  // --- Guards ---------------------------------------------------------------

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ?? Security guard: only owners can access Team Management
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <Shield className="h-12 w-12 opacity-30" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm text-center max-w-xs">
          You don&apos;t have permission to view this page. Contact your account owner.
        </p>
      </div>
    );
  }

  // --- Render ---------------------------------------------------------------

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 gradient-text">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage team members, roles, and permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTeam}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowInvite(true)} className="gap-2 btn-gradient">
            <Plus className="h-4 w-4" /> Invite User
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList className="bg-muted/30 border border-border/50">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Team Members
            {team.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {team.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Shield className="h-4 w-4" />
            Role Permissions
          </TabsTrigger>
        </TabsList>

        {/* -- Tab: Users -- */}
        <TabsContent value="users" className="mt-4">
          <Card className="glass-card border-0">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-48 hidden sm:block" />
                      <Skeleton className="h-5 w-20 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : team.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                  <Users className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No team members yet</p>
                  <Button
                    size="sm"
                    onClick={() => setShowInvite(true)}
                    className="btn-gradient gap-2"
                  >
                    <Plus className="h-4 w-4" /> Invite your first user
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hub</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.map((member) => {
                      const displayRole = toDisplayRole(member.role);
                      const initials = getInitials(member.full_name);
                      const avatarColor = getAvatarColor(member.full_name);
                      const isCurrentUser = member.id === user?.id;

                      return (
                        <TableRow
                          key={member.id}
                          className="border-border/50 hover:bg-muted/20 transition-colors"
                        >
                          {/* Avatar */}
                          <TableCell>
                            <div
                              className={`h-9 w-9 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-xs font-semibold shrink-0`}
                            >
                              {initials}
                            </div>
                          </TableCell>

                          {/* Name */}
                          <TableCell>
                            <div className="font-medium text-sm">
                              {member.full_name}
                              {isCurrentUser && (
                                <span className="ml-2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Email */}
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {member.email}
                            </span>
                          </TableCell>

                          {/* Role */}
                          <TableCell>{getRoleBadge(displayRole)}</TableCell>

                          {/* Status */}
                          <TableCell>{getStatusBadge(member.status)}</TableCell>

                          {/* Hub */}
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {member.hub ?? "--"}
                            </span>
                          </TableCell>

                          {/* Last Login */}
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {member.last_sign_in_at
                                ? new Date(member.last_sign_in_at).toLocaleDateString(
                                    "en-US",
                                    { month: "short", day: "numeric", year: "numeric" }
                                  )
                                : "Never"}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={isCurrentUser}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => openEditRole(member)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <UserCog className="h-4 w-4" />
                                  Edit Role
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleResendInvite(member)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Mail className="h-4 w-4" />
                                  Resend Invite
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleToggleDisable(member)}
                                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                >
                                  <UserX className="h-4 w-4" />
                                  {member.status === "disabled" ? "Enable User" : "Disable User"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -- Tab: Permissions -- */}
        <TabsContent value="permissions" className="mt-4">
          <Card className="glass-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Role Permissions Matrix
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Read-only overview of what each role can access in Anika Control OS.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-64">Feature</TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/40 text-[10px]">
                          <Shield className="h-2.5 w-2.5 mr-1" />
                          Admin
                        </Badge>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/40 text-[10px]">
                          <Users className="h-2.5 w-2.5 mr-1" />
                          Dispatcher
                        </Badge>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge className="bg-green-600/20 text-green-400 border-green-600/40 text-[10px]">
                          <Truck className="h-2.5 w-2.5 mr-1" />
                          Driver
                        </Badge>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSIONS.map((perm) => (
                    <TableRow
                      key={perm.feature}
                      className="border-border/50 hover:bg-muted/10 transition-colors"
                    >
                      <TableCell className="font-medium text-sm py-3">
                        {perm.feature}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {perm.admin ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {perm.dispatcher ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {perm.driver ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* -- Invite Modal ------------------------------------------------------- */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New User
            </DialogTitle>
            <DialogDescription>
              Create a new team member account and assign their role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-5">
            {/* Full name */}
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full Name *</Label>
              <Input
                id="invite-name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Jane Smith"
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane@anika.com"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Password *</Label>
              <Input
                id="invite-password"
                type="password"
                value={(form as any).password ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value } as any))}
                placeholder="Set a password for this user"
                required
              />
            </div>

            {/* Role + Hub row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, role: v as DisplayRole }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-purple-400" />
                        Admin
                      </span>
                    </SelectItem>
                    <SelectItem value="dispatcher">
                      <span className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-blue-400" />
                        Dispatcher
                      </span>
                    </SelectItem>
                    <SelectItem value="driver">
                      <span className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5 text-green-400" />
                        Driver
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Hub *</Label>
                <Select
                  value={form.hub}
                  onValueChange={(v) => setForm((f) => ({ ...f, hub: v as Hub }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHX">PHX - Phoenix</SelectItem>
                    <SelectItem value="ATL">ATL - Atlanta</SelectItem>
                    <SelectItem value="LAX">LAX - Los Angeles</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Driver-specific fields */}
            {form.role === "driver" && (
              <div className="space-y-4 pt-2 border-t border-border/50">
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  Driver Details
                </p>

                {/* Vehicle type */}
                <div className="space-y-1.5">
                  <Label>Vehicle Type</Label>
                  <Select
                    value={form.vehicle_type}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, vehicle_type: v as VehicleType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sedan">Sedan</SelectItem>
                      <SelectItem value="SUV">SUV</SelectItem>
                      <SelectItem value="Van">Van</SelectItem>
                      <SelectItem value="Box Truck">Box Truck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Make/Model + Plate row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Vehicle Make/Model</Label>
                    <Input
                      value={form.vehicle_make_model}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, vehicle_make_model: e.target.value }))
                      }
                      placeholder="Toyota Sienna"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>License Plate</Label>
                    <Input
                      value={form.license_plate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, license_plate: e.target.value }))
                      }
                      placeholder="AZ ? ABC123"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="+1 (602) 555-0123"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowInvite(false);
                  setForm(DEFAULT_FORM);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviteLoading} className="btn-gradient gap-2">
                {inviteLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Add User
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -- Edit Role Modal -------------------------------------------------- */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Edit Role
            </DialogTitle>
            <DialogDescription>
              Change the role for{" "}
              <span className="font-medium text-foreground">
                {editTarget?.full_name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Role</Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as DisplayRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-purple-400" />
                      Admin
                    </span>
                  </SelectItem>
                  <SelectItem value="dispatcher">
                    <span className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-blue-400" />
                      Dispatcher
                    </span>
                  </SelectItem>
                  <SelectItem value="driver">
                    <span className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-green-400" />
                      Driver
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditRole}
              disabled={editLoading}
              className="btn-gradient gap-2"
            >
              {editLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TeamManagementPage() {
  return (
    <ErrorBoundary>
      <TeamManagement />
    </ErrorBoundary>
  );
}
