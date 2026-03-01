// AccessDenied -- Shown when a user's role doesn't permit page access
import { ShieldX } from "lucide-react";

interface AccessDeniedProps {
  message?: string;
}

export default function AccessDenied({
  message = "You don't have permission to view this page. Contact your account administrator.",
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground select-none">
      <ShieldX className="h-12 w-12 opacity-30" />
      <p className="text-lg font-semibold text-foreground">Access Denied</p>
      <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}
