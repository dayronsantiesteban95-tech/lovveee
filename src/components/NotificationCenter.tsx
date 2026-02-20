import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
    Bell,
    CheckCheck,
    Trash2,
    ClipboardCheck,
    UserPlus,
    AlertTriangle,
    Clock,
    CheckCircle2,
    MessageSquare,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const typeConfig: Record<
    Notification["type"],
    { icon: typeof Bell; color: string; bgColor: string }
> = {
    task_assigned: {
        icon: UserPlus,
        color: "text-blue-400",
        bgColor: "bg-blue-500/15",
    },
    task_updated: {
        icon: ClipboardCheck,
        color: "text-amber-400",
        bgColor: "bg-amber-500/15",
    },
    task_due_soon: {
        icon: Clock,
        color: "text-orange-400",
        bgColor: "bg-orange-500/15",
    },
    task_overdue: {
        icon: AlertTriangle,
        color: "text-red-400",
        bgColor: "bg-red-500/15",
    },
    task_completed: {
        icon: CheckCircle2,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/15",
    },
    task_comment: {
        icon: MessageSquare,
        color: "text-purple-400",
        bgColor: "bg-purple-500/15",
    },
};

function NotificationItem({
    notification,
    onMarkRead,
    onDelete,
    onNavigate,
}: {
    notification: Notification;
    onMarkRead: (id: string) => void;
    onDelete: (id: string) => void;
    onNavigate: () => void;
}) {
    const config = typeConfig[notification.type] || typeConfig.task_assigned;
    const Icon = config.icon;

    return (
        <div
            className={cn(
                "group relative flex items-start gap-3 px-4 py-3 transition-all duration-200 cursor-pointer hover:bg-muted/60",
                !notification.is_read && "bg-accent/5 border-l-2 border-l-accent"
            )}
            onClick={() => {
                if (!notification.is_read) onMarkRead(notification.id);
                if (notification.task_id) onNavigate();
            }}
        >
            {/* Icon */}
            <div
                className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5",
                    config.bgColor
                )}
            >
                <Icon className={cn("h-4 w-4", config.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p
                        className={cn(
                            "text-sm leading-tight",
                            !notification.is_read ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}
                    >
                        {notification.title}
                    </p>
                    {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-accent shrink-0 animate-pulse" />
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                    {notification.message}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
            </div>

            {/* Actions on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {!notification.is_read && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkRead(notification.id);
                        }}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Mark as read"
                    >
                        <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(notification.id);
                    }}
                    className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

export function NotificationCenter() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
    } = useNotifications();

    const handleNavigateToTask = () => {
        setOpen(false);
        navigate("/tasks");
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-full hover:bg-muted/80 transition-all duration-200"
                    id="notification-bell"
                >
                    <Bell className="h-[18px] w-[18px] text-muted-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-lg shadow-accent/30 animate-in zoom-in-50 duration-200">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] rounded-full bg-accent animate-ping opacity-30" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[400px] p-0 rounded-xl shadow-2xl border border-border/60 bg-card/95 backdrop-blur-xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                            <Badge
                                variant="secondary"
                                className="h-5 px-1.5 text-[10px] font-bold bg-accent/15 text-accent border-0"
                            >
                                {unreadCount} new
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                                onClick={markAllAsRead}
                            >
                                <CheckCheck className="h-3 w-3" />
                                Mark all read
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                                onClick={clearAll}
                            >
                                <X className="h-3 w-3" />
                                Clear
                            </Button>
                        )}
                    </div>
                </div>

                {/* Notification List */}
                <ScrollArea className="max-h-[420px]">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                                <Bell className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">
                                No notifications yet
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1 text-center">
                                You'll be notified when tasks are assigned to you
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={markAsRead}
                                    onDelete={deleteNotification}
                                    onNavigate={handleNavigateToTask}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* Footer */}
                {notifications.length > 0 && (
                    <>
                        <Separator className="bg-border/30" />
                        <div className="px-4 py-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                                onClick={handleNavigateToTask}
                            >
                                View Task Board ->
                            </Button>
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
