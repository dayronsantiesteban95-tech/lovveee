import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, fmtWait, todayISO } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, CheckSquare, AlertTriangle, Users, Building2, UserCheck,
  CalendarClock, BarChart3, Truck, Clock, DollarSign, ClipboardList, ArrowRight,
} from "lucide-react";
import { LEAD_STAGES, TASK_PRIORITIES, TASK_STATUSES, DEPARTMENTS } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import AiChatbot from "@/components/AiChatbot";

const STAGE_COLORS = ["hsl(30,100%,50%)", "hsl(200,80%,50%)", "hsl(260,60%,55%)", "hsl(340,70%,50%)", "hsl(140,60%,45%)"];
const STATUS_COLORS = ["hsl(200,80%,50%)", "hsl(40,90%,50%)", "hsl(140,60%,45%)"];

const priorityDot = (priority: string) => {
  const p = TASK_PRIORITIES.find((tp) => tp.value === priority);
  return p ? p.color : "bg-muted";
};

const deptLabel = (dept: string | null) => {
  if (!dept) return null;
  const d = DEPARTMENTS.find((dd) => dd.value === dept);
  return d?.label ?? dept;
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOwner } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ leads: 0, tasksDueToday: 0, overdue: 0, wonAccounts: 0, companies: 0, contacts: 0 });
  const [pipelineCounts, setPipelineCounts] = useState<{ name: string; value: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string; note: string; activity_type: string; created_at: string }[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Tables<"tasks">[]>([]);
  const [taskStatusCounts, setTaskStatusCounts] = useState<{ name: string; value: number }[]>([]);
  const [todayLoads, setTodayLoads] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    async function fetchStats() {
      const today = todayISO();
      const userId = user!.id;

      let tasksTodayQuery = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("due_date", today).neq("status", "done");
      if (!isOwner) tasksTodayQuery = tasksTodayQuery.eq("assigned_to", userId);

      const [leadsRes, tasksTodayRes, overdueRes, wonRes, companiesRes, contactsRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }),
        tasksTodayQuery,
        supabase.from("leads").select("id", { count: "exact", head: true }).lt("next_action_date", today),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "account_won"),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        leads: leadsRes.count ?? 0,
        tasksDueToday: tasksTodayRes.count ?? 0,
        overdue: overdueRes.count ?? 0,
        wonAccounts: wonRes.count ?? 0,
        companies: companiesRes.count ?? 0,
        contacts: contactsRes.count ?? 0,
      });

      const { data: allLeads } = await supabase.from("leads").select("stage");
      const counts: Record<string, number> = {};
      LEAD_STAGES.forEach((s) => (counts[s.value] = 0));
      allLeads?.forEach((l) => { counts[l.stage] = (counts[l.stage] || 0) + 1; });
      setPipelineCounts(LEAD_STAGES.map((s) => ({ name: s.label, value: counts[s.value] })));

      let activityQuery = supabase
        .from("lead_interactions")
        .select("id, note, activity_type, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (!isOwner) activityQuery = activityQuery.eq("created_by", userId);
      const { data: activity } = await activityQuery;
      if (activity) setRecentActivity(activity);

      let tasksQuery = supabase
        .from("tasks")
        .select("*")
        .neq("status", "done")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(5);
      if (!isOwner) tasksQuery = tasksQuery.eq("assigned_to", userId);
      const { data: tasks } = await tasksQuery;
      if (tasks) setUpcomingTasks(tasks);

      let allTasksQuery = supabase.from("tasks").select("status");
      if (!isOwner) allTasksQuery = allTasksQuery.eq("assigned_to", userId);
      const { data: allTasks } = await allTasksQuery;
      const statusCounts: Record<string, number> = {};
      TASK_STATUSES.forEach((s) => (statusCounts[s.value] = 0));
      allTasks?.forEach((t) => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
      setTaskStatusCounts(TASK_STATUSES.map((s) => ({ name: s.label, value: statusCounts[s.value] })));

      // Fetch today's load data for ops summary
      const db = supabase;
      const [loadsRes, driversRes] = await Promise.all([
        db.from("daily_loads").select("*").eq("load_date", today),
        db.from("drivers").select("id, full_name"),
      ]);
      if (loadsRes.data) setTodayLoads(loadsRes.data);
      if (driversRes.data) setDrivers(driversRes.data);

      setLoading(false);
    }
    fetchStats();
  }, [user, isOwner]);

  // ── Today's Ops Summary (must be above early return to satisfy rules of hooks) ──
  const opsStats = useMemo(() => {
    if (!todayLoads.length) return null;
    const totalRevenue = todayLoads.reduce((s: number, l: any) => s + Number(l.revenue || 0), 0);
    const totalCosts = todayLoads.reduce((s: number, l: any) => s + Number(l.driver_pay || 0) + Number(l.fuel_cost || 0), 0);
    const totalMiles = todayLoads.reduce((s: number, l: any) => s + Number(l.miles || 0), 0);
    const waitLoads = todayLoads.filter((l: any) => l.wait_time_minutes > 0);
    const avgWait = waitLoads.length ? Math.round(waitLoads.reduce((s: number, l: any) => s + l.wait_time_minutes, 0) / waitLoads.length) : 0;
    const delivered = todayLoads.filter((l: any) => l.status === "delivered").length;

    const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.full_name ?? "Unknown";
    const byDriver: Record<string, { loads: number; miles: number; revenue: number }> = {};
    todayLoads.forEach((l: any) => {
      const name = driverName(l.driver_id);
      if (!byDriver[name]) byDriver[name] = { loads: 0, miles: 0, revenue: 0 };
      byDriver[name].loads += 1;
      byDriver[name].miles += Number(l.miles || 0);
      byDriver[name].revenue += Number(l.revenue || 0);
    });
    const driverRows = Object.entries(byDriver)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { total: todayLoads.length, delivered, totalRevenue, totalCosts, profit: totalRevenue - totalCosts, totalMiles, avgWait, driverRows };
  }, [todayLoads, drivers]);

  if (loading) return <DashboardSkeleton />;

  const statCards = [
    { label: "Active Leads", value: stats.leads, icon: TrendingUp, color: "text-accent" },
    { label: "Tasks Due Today", value: stats.tasksDueToday, icon: CheckSquare, color: "text-blue-500" },
    { label: "Overdue Follow-ups", value: stats.overdue, icon: AlertTriangle, color: "text-red-500" },
    { label: "Accounts Won", value: stats.wonAccounts, icon: Users, color: "text-green-500" },
    { label: "Companies", value: stats.companies, icon: Building2, color: "text-purple-500" },
    { label: "Contacts", value: stats.contacts, icon: UserCheck, color: "text-indigo-500" },
  ];

  const activityTypeLabel: Record<string, string> = { note: "📝", email: "📧", call: "📞", meeting: "🤝" };
  const today = todayISO();
  const hasPipelineData = pipelineCounts.some((p) => p.value > 0);


  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight gradient-text">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome to Anika Operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="shadow-sm border-0 glass-card rounded-2xl hover:scale-[1.03] transition-transform duration-300 cursor-default relative accent-bar">
            <CardContent className="pt-6 pb-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">all time</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Today's Operations Summary ── */}
      {opsStats && (
        <Card className="shadow-sm border-0 glass-card rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-2 relative">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-accent" /> Today's Operations
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-accent" onClick={() => navigate("/dispatch")}>
                Full Report <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {[
                { label: "Loads", value: `${opsStats.delivered}/${opsStats.total}`, sub: "delivered", icon: Truck, color: "text-accent" },
                { label: "Miles", value: opsStats.totalMiles.toFixed(0), sub: "total", icon: TrendingUp, color: "text-blue-500" },
                { label: "Revenue", value: fmtMoney(opsStats.totalRevenue), sub: "gross", icon: DollarSign, color: "text-green-500" },
                { label: "Profit", value: fmtMoney(opsStats.profit), sub: opsStats.profit >= 0 ? "▲" : "▼", icon: BarChart3, color: opsStats.profit >= 0 ? "text-green-500" : "text-red-500" },
                { label: "Avg Wait", value: fmtWait(opsStats.avgWait), sub: opsStats.avgWait > 30 ? "⚠️ High" : "Normal", icon: Clock, color: opsStats.avgWait > 30 ? "text-red-500" : "text-yellow-500" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30">
                  <s.icon className={`h-4 w-4 ${s.color} shrink-0`} />
                  <div>
                    <p className="text-lg font-bold leading-tight">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label} · {s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            {opsStats.driverRows.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {opsStats.driverRows.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 text-sm">
                    <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{d.name}</p>
                      <p className="text-[10px] text-muted-foreground">{d.loads} loads · {d.miles.toFixed(0)} mi · {fmtMoney(d.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-0 glass-card rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {hasPipelineData ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pipelineCounts} layout="vertical" margin={{ left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {pipelineCounts.map((_, i) => (
                      <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium text-sm">No leads in pipeline yet</p>
                <p className="text-xs">Start prospecting to see your funnel here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 glass-card rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[220px] overflow-y-auto">
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
              )}
              {recentActivity.map((a) => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <span className="text-lg">{activityTypeLabel[a.activity_type] ?? "📝"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-1">{a.note}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-0 glass-card rounded-2xl lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              My Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingTasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No upcoming tasks</p>
              )}
              {upcomingTasks.map((task) => {
                const isOverdue = task.due_date != null && task.due_date < today;
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate("/tasks")}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:bg-muted/50 hover:translate-x-1 ${isOverdue ? "bg-destructive/10 border border-destructive/20" : ""}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${priorityDot(task.priority)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{task.title}</p>
                      <p className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {task.due_date ? new Date(task.due_date + "T00:00:00").toLocaleDateString() : "No date"}
                        {isOverdue && " · Overdue"}
                      </p>
                    </div>
                    {task.department && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {deptLabel(task.department)}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 glass-card rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Task Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={taskStatusCounts}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {taskStatusCounts.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-1">
              {taskStatusCounts.map((s, i) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[i] }} />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <AiChatbot />
    </div>
  );
}