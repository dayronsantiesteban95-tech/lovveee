import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, LayoutList } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, addMonths, subMonths,
  addWeeks, subWeeks, isSameDay, isSameMonth, isToday,
} from "date-fns";

type Task = {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
};

function CalendarView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const { user } = useAuth();
  const { isOwner } = useUserRole();

  useEffect(() => {
    if (!user) return;
    let query = supabase.from("tasks").select("id, title, priority, due_date, status");
    if (!isOwner) query = query.eq("assigned_to", user.id);
    query.then(({ data }) => {
      if (data) setTasks(data as Task[]);
    });
  }, [user, isOwner]);

  const priorityColor = (p: string) => {
    const map: Record<string, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-green-500" };
    return map[p] || "bg-muted";
  };

  const getDays = () => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const days = getDays();
  const tasksForDay = (day: Date) =>
    tasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), day));

  const nav = (dir: 1 | -1) => {
    if (view === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">{format(currentDate, view === "month" ? "MMMM yyyy" : "'Week of' MMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => nav(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => nav(1)}><ChevronRight className="h-4 w-4" /></Button>
          <div className="ml-2 flex rounded-lg border overflow-hidden">
            <Button variant={view === "month" ? "default" : "ghost"} size="sm" onClick={() => setView("month")} className="rounded-none gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Month
            </Button>
            <Button variant={view === "week" ? "default" : "ghost"} size="sm" onClick={() => setView("week")} className="rounded-none gap-1">
              <LayoutList className="h-3.5 w-3.5" /> Week
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="grid grid-cols-7 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-r-0">{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div className={`grid grid-cols-7 ${view === "week" ? "min-h-[300px]" : ""}`}>
            {days.map((day, i) => (
              <div
                key={i}
                className={`border-r border-b last:border-r-0 p-1.5 ${view === "month" ? "min-h-[100px]" : "min-h-[250px]"} ${!isSameMonth(day, currentDate) && view === "month" ? "bg-muted/30" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 ${isToday(day) ? "bg-accent text-accent-foreground rounded-full w-6 h-6 flex items-center justify-center" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {tasksForDay(day).map((task) => (
                    <div key={task.id} className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] bg-card border hover:shadow-sm hover:-translate-y-px transition-all cursor-pointer">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityColor(task.priority)}`} />
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CalendarViewPage() {
  return (
    <ErrorBoundary>
      <CalendarView />
    </ErrorBoundary>
  );
}
