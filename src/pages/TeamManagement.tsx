import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, Shield, Truck, Trash2, Copy, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

type TeamMember = {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "dispatcher" | null;
  created_at: string;
  last_sign_in_at: string | null;
};

export default function TeamManagement() {
  const { user } = useAuth();
  const { isOwner, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "dispatcher">("dispatcher");

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
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
      const data = await res.json();
      if (data.team) setTeam(data.team);
    } catch (err) {
      console.error("Failed to fetch team:", err);
    }
    setLoading(false);
  }, [getAuthHeaders]);

  useEffect(() => {
    if (isOwner) fetchTeam();
  }, [isOwner, fetchTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            email: inviteEmail,
            full_name: inviteFullName,
            role: inviteRole,
          }),
        }
      );
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "User created!", description: `${inviteFullName} has been added as ${inviteRole}.` });
        setRecoveryLink(data.recovery_link);
        setShowInvite(false);
        setInviteEmail("");
        setInviteFullName("");
        setInviteRole("dispatcher");
        fetchTeam();
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    }
    setInviteLoading(false);
  };

  const handleChangeRole = async (userId: string, newRole: "owner" | "dispatcher") => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "change_role", email: userId, role: newRole }),
        }
      );
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Role updated" });
        fetchTeam();
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    }
  };

  const handleRemove = async () => {
    if (!removeId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "remove", email: removeId }),
        }
      );
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "User removed" });
        fetchTeam();
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to remove user", variant: "destructive" });
    }
    setRemoveId(null);
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOwner) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 gradient-text">
            <Users className="h-6 w-6" /> Team Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your team members and their roles</p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="gap-2 btn-gradient">
          <Plus className="h-4 w-4" /> Invite User
        </Button>
      </div>

      {/* Recovery Link Banner */}
      {recoveryLink && (
        <Card className="border-accent/50 bg-accent/5">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm font-medium mb-2">🔑 Send this password-setup link to the new user:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-x-auto">{recoveryLink}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(recoveryLink);
                  toast({ title: "Copied!" });
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setRecoveryLink(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Team List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-3">
          {team.map((member) => (
            <Card key={member.id} className="shadow-sm border-0 glass-card">
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {member.role === "owner" ? (
                    <Shield className="h-5 w-5 text-accent" />
                  ) : (
                    <Truck className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={member.role || "dispatcher"}
                    onValueChange={(val) => handleChangeRole(member.id, val as "owner" | "dispatcher")}
                    disabled={member.id === user?.id}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {member.last_sign_in_at
                      ? `Last seen ${new Date(member.last_sign_in_at).toLocaleDateString()}`
                      : "Never signed in"}
                  </Badge>
                  {member.id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setRemoveId(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Create a new user account and assign a role.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={inviteFullName} onChange={(e) => setInviteFullName(e.target.value)} placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="john@anika.com" required />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "owner" | "dispatcher")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete their account and remove all access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
