/**
 * Barrel export for all custom hooks
 * Enables clean imports: import { useAuth, useAlerts } from '@/hooks'
 * Organized by category for better maintainability
 */

// Authentication & Authorization
export { useAuth } from "./auth/useAuth";
export { useUserRole } from "./auth/useUserRole";

// Data Management
export { useDispatchData } from "./data/useDispatchData";
export { useMessages, useUnreadMessageCounts } from "./data/useMessages";

// Real-time Subscriptions
export { useRealtimeDriverLocations } from "./realtime/useRealtimeDriverLocations";
export { useRealtimeDriverMap } from "./realtime/useRealtimeDriverMap";
export { useDriverGPS } from "./realtime/useDriverGPS";

// Dispatch & BLAST System
export { useDispatchBlast } from "./dispatch/useDispatchBlast";
export { useDriverAvailability } from "./dispatch/useDriverAvailability";
export { useDriverSuggestion } from "./dispatch/useDriverSuggestion";
export { useLoadStatusActions } from "./dispatch/useLoadStatusActions";
export { useAlerts } from "./dispatch/useAlerts";

// Routing & Navigation (not moved)
export { useETA } from "./useETA";
export { useRouteOptimizer } from "./useRouteOptimizer";

// Notifications (not moved)
export { useNotifications } from "./useNotifications";

// Integrations (not moved)
export { useQuickBooks } from "./useQuickBooks";

// UI Utilities
export { useToast } from "./ui/use-toast";
export { useIsMobile } from "./ui/use-mobile";
