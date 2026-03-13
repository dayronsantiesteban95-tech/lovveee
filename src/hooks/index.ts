/**
 * Barrel export for all custom hooks
 * Enables clean imports: import { useAuth, useAlerts } from '@/hooks'
 */

// Authentication & Authorization
export { useAuth } from "./useAuth";
export { useUserRole } from "./useUserRole";

// Real-time Data Subscriptions
export { useDispatchData } from "./useDispatchData";
export { useDriverGPS } from "./useDriverGPS";
export { useRealtimeDriverLocations } from "./useRealtimeDriverLocations";
export { useRealtimeDriverMap } from "./useRealtimeDriverMap";
export { useMessages } from "./useMessages";

// Dispatch & BLAST System
export { useDispatchBlast } from "./useDispatchBlast";
export { useDriverAvailability } from "./useDriverAvailability";
export { useDriverSuggestion } from "./useDriverSuggestion";
export { useLoadStatusActions } from "./useLoadStatusActions";

// Routing & Navigation
export { useETA } from "./useETA";
export { useRouteOptimizer } from "./useRouteOptimizer";

// Notifications & Alerts
export { useAlerts } from "./useAlerts";
export { useNotifications } from "./useNotifications";
export { useToast } from "./use-toast";

// Integrations
export { useQuickBooks } from "./useQuickBooks";

// UI Utilities
export { useMobile } from "./use-mobile";
