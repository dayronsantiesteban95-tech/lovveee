import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function Auth() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const { toast } = useToast();

  // Force-password-change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Check if the current user needs to change their password
  const needsPasswordChange = user?.user_metadata?.force_password_change === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "A password reset link has been sent." });
    }
    setLoading(false);
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { force_password_change: false },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated", description: "Your new password has been set. Welcome!" });
      // The AuthRoute will now see force_password_change is false and redirect to /command-center
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 relative overflow-hidden">
      {/* Animated background accents */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />

      <div className="animate-in w-full max-w-md">
        <Card className="shadow-2xl border-0 glass-card">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4 shadow-lg animate-float">
              <Truck className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold gradient-text">Anika Logistics</CardTitle>
            <CardDescription className="text-sm">
              {needsPasswordChange
                ? "Set your new password to continue"
                : resetMode
                  ? "Reset your password"
                  : "Operations & Growth Portal"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {needsPasswordChange ? (
              /* --- Force Password Change Form --- */
              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-200">
                  <ShieldCheck className="h-4 w-4 inline mr-2" />
                  Welcome! Please set a new password to secure your account.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    minLength={6}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 btn-gradient text-white font-medium pulse-glow" disabled={loading}>
                  {loading ? "Updating..." : (
                    <><ShieldCheck className="h-4 w-4 mr-2" /> Set Password & Continue</>
                  )}
                </Button>
              </form>
            ) : resetMode ? (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@anika.com" required className="h-11" />
                </div>
                <Button type="submit" className="w-full h-11 btn-gradient text-white font-medium" disabled={loading}>
                  {loading ? "Please wait..." : (
                    <><KeyRound className="h-4 w-4 mr-2" /> Send Reset Link</>
                  )}
                </Button>
                <Button type="button" variant="link" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setResetMode(false)}>
                  Back to Sign In
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@anika.com" required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" required className="h-11" />
                </div>
                <Button type="submit" className="w-full h-11 btn-gradient text-white font-medium pulse-glow" disabled={loading}>
                  {loading ? "Signing in..." : (
                    <>Sign In <ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
                <Button type="button" variant="link" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setResetMode(true)}>
                  Forgot password?
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Branded footer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Last-Mile Delivery | I-10 Corridor | Atlanta | Phoenix | LA
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <ErrorBoundary>
      <Auth />
    </ErrorBoundary>
  );
}
