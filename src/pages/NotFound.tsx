import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Truck, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />

      <div className="animate-in text-center max-w-md">
        <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-6 shadow-lg animate-float">
          <Truck className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-6xl font-bold gradient-text mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-1">Route not found</p>
        <p className="text-sm text-muted-foreground/70 mb-8">
          <code className="text-xs bg-muted px-2 py-1 rounded">{location.pathname}</code> doesn't exist in the operations portal.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </Button>
          <Button onClick={() => navigate("/dashboard")} className="gap-2 btn-gradient">
            <Home className="h-4 w-4" /> Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
