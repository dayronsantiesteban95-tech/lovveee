import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Notification = {
    id: string;
    user_id: string;
    type: "task_assigned" | "task_updated" | "task_due_soon" | "task_overdue" | "task_completed" | "task_comment";
    title: string;
    message: string;
    task_id: string | null;
    triggered_by: string | null;
    is_read: boolean;
    created_at: string;
    // Joined fields
    triggered_by_profile?: { full_name: string } | null;
};

// Helper to get a typed reference to the notifications table
function notificationsTable() {
    return supabase.from("notifications");
}

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;

        const { data, error } = await notificationsTable()
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);

        if (!error && data) {
            // Fetch triggered_by profiles in one go
            const triggerIds = [...new Set(
                (data as Notification[]).filter(n => n.triggered_by).map(n => n.triggered_by as string)
            )];
            let profileMap: Record<string, string> = {};

            if (triggerIds.length > 0) {
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("user_id, full_name")
                    .in("user_id", triggerIds);

                if (profiles) {
                    profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));
                }
            }

            const enriched = (data as Notification[]).map(n => ({
                ...n,
                triggered_by_profile: n.triggered_by && profileMap[n.triggered_by]
                    ? { full_name: profileMap[n.triggered_by] }
                    : null,
            }));

            setNotifications(enriched);
            setUnreadCount(enriched.filter(n => !n.is_read).length);
        }
        setLoading(false);
    }, [user]);

    // Mark a single notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        await notificationsTable()
            .update({ is_read: true } as never)
            .eq("id", notificationId);

        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        if (!user) return;
        await notificationsTable()
            .update({ is_read: true } as never)
            .eq("user_id", user.id)
            .eq("is_read" as string, false as never);

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    }, [user]);

    // Delete a single notification
    const deleteNotification = useCallback(async (notificationId: string) => {
        const notification = notifications.find(n => n.id === notificationId);
        await notificationsTable().delete().eq("id", notificationId);

        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (notification && !notification.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    }, [notifications]);

    // Clear all notifications
    const clearAll = useCallback(async () => {
        if (!user) return;
        await notificationsTable().delete().eq("user_id", user.id);
        setNotifications([]);
        setUnreadCount(0);
    }, [user]);

    // Initial fetch
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Real-time subscription
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel("notifications-realtime")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchNotifications]);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        refetch: fetchNotifications,
    };
}
