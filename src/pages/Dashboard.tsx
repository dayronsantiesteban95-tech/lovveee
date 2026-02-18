import { useEffect, useState, useCallback } from "react";
import ETABadge from "@/components/ETABadge";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, todayISO, daysAgoISO } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Truck, PackageCheck, Clock, AlertCircle, DollarSign, Percent,
  Radio, Activity,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyLoad {
  id: string;
  reference_number: string | null;
  client_name: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  driver_id: string | null;
  status: string;
  estimated_delivery: string | null;
  revenue: number;
  end_time: string | null;
}

interface Driver {
  id: string;
  full_name: string;
  hub: string;
  onDuty: boolean;
  lastPing: string | null;
  activeLoadRef: string | null;
}

interface ActivityEvent {
  id: string;
  created_at: string;
  new_status: string;
  driverName: string;
  loadRef: string;
}

interface KPIs {
  totalLoads: number;
  inTransit: number;
  delivered: number;
  unassigned: number;
  onTimePct: number | null;
  revenue: number;
}

interface WeekStats {
  revenue: number;
  loads: number;
  onTimePct: number | null;
  topClient: string | null;
  topDriver: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  pending:     { label: "Pending",     color: "bg-muted text-muted-foreground",    badge: "secondary" },
  assigned:    { label: "Assigned",    color: "bg-blue-900/40 text-blue-300",      badge: "outline" },
  in_progress: { label: "In Transit",  color: "bg-yellow-900/40 text-yellow-300",  badge: "outline" },
  delivered:   { label: "Delivered",   color: "bg-green-900/40 text-green-300",    badge: "outline" },
  failed:      { label: "Failed",      color: "bg-red-900/40 text-red-300",        badge: "destructive" },
};

function statusBadge(status: string) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function timeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtStatus(s: string): string {
  return STATUS_CONFIG[s]?.label ?? s;
}

function Pulse() {
  return <span className="opacity-50 animate-pulse">—</span>;
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonKPI() {
  return (
    <Card className="opacity-50 animate-pulse">
      <CardContent className="p-5">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-8 w-16 bg-muted rounded" />
      </CardContent>
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const today = todayISO();
  const [loading, setLoading] = useState(true);
  const [loads, setLoads] = useState<DailyLoad[]>([]);
  const [kpis, setKpis] = useState<KPIs>({ totalLoads: 0, inTransit: 0, delivered: 0, unassigned: 0, onTimePct: null, revenue: 0 });
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [weekStats, setWeekStats] = useState<WeekStats>({ revenue: 0, loads: 0, onTimePct: null, topClient: null, topDriver: null });
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});

  // ── Fetch today's loads ───────────────────────────────────────────────────
  const fetchLoads = useCallback(async () => {
    const { data } = await supabase
      .from("daily_loads")
      .select("id,reference_number,client_name,pickup_address,delivery_address,driver_id,status,estimated_delivery,revenue,end_time")
      .eq("load_date", today)
      .order("created_at", { ascending: true });

    const rows = (data ?? []) as DailyLoad[];
    setLoads(rows);

    const total = rows.length;
    const inTransit = rows.filter(r => r.status === "in_progress").length;
    const delivered = rows.filter(r => r.status === "delivered" || r.status === "completed").length;
    const unassigned = rows.filter(r => r.status === "pending" && !r.driver_id).length;
    const revenue = rows.filter(r => r.status === "delivered" || r.status === "completed").reduce((s, r) => s + (r.revenue ?? 0), 0);
    // On-time: delivered/completed and end_time <= estimated_delivery (both present)
    const deliveredWithETA = rows.filter(r => (r.status === "delivered" || r.status === "completed") && r.estimated_delivery);
    const onTime = deliveredWithETA.filter(r => r.end_time && r.end_time <= r.estimated_delivery!).length;
    const onTimePct = deliveredWithETA.length > 0 ? Math.round((onTime / deliveredWithETA.length) * 100) : null;

    setKpis({ totalLoads: total, inTransit, delivered, unassigned, onTimePct, revenue });
  }, [today]);

  // ── Fetch drivers + shifts + last location ────────────────────────────────
  const fetchDrivers = useCallback(async () => {
    const [driversRes, shiftsRes, locRes, loadsActiveRes] = await Promise.all([
      supabase.from("drivers").select("id,full_name,hub").order("full_name"),
      supabase.from("driver_shifts").select("driver_id,status").gte("start_time", today + "T00:00:00").lte("start_time", today + "T23:59:59"),
      supabase.from("driver_locations").select("driver_id,recorded_at").order("recorded_at", { ascending: false }),
      supabase.from("daily_loads").select("driver_id,reference_number").eq("load_date", today).eq("status", "in_progress"),
    ]);

    const allDrivers = driversRes.data ?? [];
    const shiftMap: Record<string, boolean> = {};
    for (const s of (shiftsRes.data ?? [])) {
      if (s.status === "on_duty") shiftMap[s.driver_id] = true;
    }

    // Last ping per driver
    const pingMap: Record<string, string> = {};
    for (const loc of (locRes.data ?? [])) {
      if (!pingMap[loc.driver_id]) pingMap[loc.driver_id] = loc.recorded_at;
    }

    // Active load per driver
    const activeLoadMap: Record<string, string> = {};
    for (const l of (loadsActiveRes.data ?? [])) {
      if (l.driver_id) activeLoadMap[l.driver_id] = l.reference_number ?? l.driver_id;
    }

    const names: Record<string, string> = {};
    const driverList: Driver[] = allDrivers.map(d => {
      names[d.id] = d.full_name;
      return {
        id: d.id,
        full_name: d.full_name,
        hub: d.hub,
        onDuty: !!shiftMap[d.id],
        lastPing: pingMap[d.id] ?? null,
        activeLoadRef: activeLoadMap[d.id] ?? null,
      };
    });

    setDriverNames(names);
    setDrivers(driverList);
  }, [today]);

  // ── Fetch recent activity ─────────────────────────────────────────────────
  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from("load_status_events")
      .select("id,created_at,new_status,changed_by,load_id,daily_loads(reference_number)")
      .order("created_at", { ascending: false })
      .limit(20);

    // Collect unique changed_by IDs to resolve names
    const changedByIds = [...new Set((data ?? []).map((e: any) => e.changed_by).filter(Boolean))];
    const driverNameMap: Record<string, string> = {};
    if (changedByIds.length > 0) {
      const { data: driverRows } = await supabase
        .from("drivers")
        .select("id,full_name")
        .in("id", changedByIds);
      for (const d of (driverRows ?? [])) driverNameMap[d.id] = d.full_name;
    }

    const events: ActivityEvent[] = (data ?? []).map((e: any) => ({
      id: e.id,
      created_at: e.created_at,
      new_status: e.new_status,
      driverName: (e.changed_by ? driverNameMap[e.changed_by] : null) ?? "System",
      loadRef: e.daily_loads?.reference_number ?? e.load_id ?? "—",
    }));
    setActivity(events);
  }, []);

  // ── Fetch week stats ──────────────────────────────────────────────────────
  const fetchWeekStats = useCallback(async () => {
    const weekAgo = daysAgoISO(6);
    const { data } = await supabase
      .from("daily_loads")
      .select("status,revenue,client_name,driver_id,estimated_delivery,end_time")
      .gte("load_date", weekAgo)
      .lte("load_date", today);

    const rows = data ?? [];
    const revenue = rows.filter(r => r.status === "delivered" || r.status === "completed").reduce((s: number, r: any) => s + (r.revenue ?? 0), 0);
    const loads = rows.length;

    // On-time this week
    const withETA = rows.filter((r: any) => (r.status === "delivered" || r.status === "completed") && r.estimated_delivery);
    const onTime = withETA.filter((r: any) => r.end_time && r.end_time <= r.estimated_delivery).length;
    const onTimePct = withETA.length > 0 ? Math.round((onTime / withETA.length) * 100) : null;

    // Top client
    const clientCounts: Record<string, number> = {};
    for (const r of rows) { if (r.client_name) clientCounts[r.client_name] = (clientCounts[r.client_name] ?? 0) + 1; }
    const topClient = Object.entries(clientCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Top driver (by deliveries)
    const { data: driverRows } = await supabase
      .from("drivers")
      .select("id,full_name");
    const dMap: Record<string, string> = {};
    for (const d of (driverRows ?? [])) dMap[d.id] = d.full_name;

    const driverCounts: Record<string, number> = {};
    for (const r of rows.filter((r: any) => (r.status === "delivered" || r.status === "completed") && r.driver_id)) {
      const id = (r as any).driver_id;
      driverCounts[id] = (driverCounts[id] ?? 0) + 1;
    }
    const topDriverId = Object.entries(driverCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topDriver = topDriverId ? (dMap[topDriverId] ?? topDriverId) : null;

    setWeekStats({ revenue, loads, onTimePct, topClient, topDriver });
  }, [today]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchLoads(), fetchDrivers(), fetchActivity(), fetchWeekStats()]);
      setLoading(false);
    }
    init();

    // Realtime: daily_loads
    const loadsChannel = supabase
      .channel("dashboard-loads")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_loads" }, () => {
        fetchLoads();
        fetchWeekStats();
      })
      .subscribe();

    // Realtime: load_status_events
    const eventsChannel = supabase
      .channel("dashboard-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "load_status_events" }, () => {
        fetchActivity();
        fetchDrivers();
      })
      .subscribe();

    // Activity refresh every 30s
    const activityTimer = setInterval(fetchActivity, 30_000);

    // Load refresh every 60s — keeps live ETA badges current
    const loadRefreshTimer = setInterval(fetchLoads, 60_000);

    return () => {
      supabase.removeChannel(loadsChannel);
      supabase.removeChannel(eventsChannel);
      clearInterval(activityTimer);
      clearInterval(loadRefreshTimer);
    };
  }, [fetchLoads, fetchDrivers, fetchActivity, fetchWeekStats]);

  // ─── KPI card data ────────────────────────────────────────────────────────
  const kpiCards = [
    {
      title: "Today's Loads",
      value: loading ? null : kpis.totalLoads,
      icon: <Truck className="h-4 w-4 text-muted-foreground" />,
      color: "text-foreground",
    },
    {
      title: "In Transit",
      value: loading ? null : kpis.inTransit,
      icon: <Radio className="h-4 w-4 text-yellow-400" />,
      color: "text-yellow-400",
    },
    {
      title: "Delivered",
      value: loading ? null : kpis.delivered,
      icon: <PackageCheck className="h-4 w-4 text-green-400" />,
      color: "text-green-400",
    },
    {
      title: "Unassigned",
      value: loading ? null : kpis.unassigned,
      icon: <AlertCircle className="h-4 w-4 text-red-400" />,
      color: kpis.unassigned > 0 ? "text-red-400" : "text-foreground",
    },
    {
      title: "On-Time %",
      value: loading ? null : (kpis.onTimePct !== null ? `${kpis.onTimePct}%` : "—"),
      icon: <Percent className="h-4 w-4 text-blue-400" />,
      color: kpis.onTimePct !== null ? (kpis.onTimePct >= 80 ? "text-green-400" : kpis.onTimePct >= 60 ? "text-yellow-400" : "text-red-400") : "text-muted-foreground",
    },
    {
      title: "Today's Revenue",
      value: loading ? null : fmtMoney(kpis.revenue),
      icon: <DollarSign className="h-4 w-4 text-green-400" />,
      color: "text-green-400",
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatch Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      </div>

      {/* ROW 1 — KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonKPI key={i} />)
          : kpiCards.map((k) => (
              <Card key={k.title} className="border border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{k.title}</span>
                    {k.icon}
                  </div>
                  <div className={`text-2xl font-bold tabular-nums ${k.color}`}>
                    {k.value ?? <Pulse />}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* ROW 2 — Active Loads Table */}
      <Card className="border border-border/50">
        <CardHeader className="pb-2 px-5 pt-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Truck className="h-4 w-4" /> Today's Loads
            <Badge variant="secondary" className="ml-auto text-xs">{loads.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted/30 rounded animate-pulse opacity-50" />
              ))}
            </div>
          ) : loads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No loads today</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-5 py-2 font-medium">Ref #</th>
                    <th className="text-left px-3 py-2 font-medium">Client</th>
                    <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Route</th>
                    <th className="text-left px-3 py-2 font-medium">Driver</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">ETA</th>
                    <th className="text-right px-5 py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {loads.map((load, idx) => (
                    <tr
                      key={load.id}
                      className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/5"}`}
                    >
                      <td className="px-5 py-3 font-mono text-xs text-blue-400">
                        {load.reference_number ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs max-w-[120px] truncate">{load.client_name ?? "—"}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px]">
                        <span className="truncate block">
                          {load.pickup_address ? load.pickup_address.split(",")[0] : "—"}
                          <span className="text-muted-foreground/50 mx-1">→</span>
                          {load.delivery_address ? load.delivery_address.split(",")[0] : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {load.driver_id ? (driverNames[load.driver_id] ?? <span className="text-muted-foreground">Loading…</span>) : (
                          <span className="text-red-400 font-medium">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3">{statusBadge(load.status)}</td>
                      <td className="px-3 py-3 text-xs hidden lg:table-cell">
                        {load.status === "in_progress" ? (
                          <ETABadge
                            pickupAddress={load.pickup_address}
                            deliveryAddress={load.delivery_address}
                            enabled={true}
                            compact
                          />
                        ) : load.estimated_delivery ? (
                          <span className="text-muted-foreground">
                            {new Date(load.estimated_delivery).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-right font-mono text-green-400">
                        {load.status === "delivered" ? fmtMoney(load.revenue) : <span className="text-muted-foreground">{fmtMoney(load.revenue)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROW 3 — Driver Board + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Driver Status Board */}
        <Card className="border border-border/50">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Driver Status
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {loading ? (
              <div className="px-5 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted/30 rounded animate-pulse opacity-50" />
                ))}
              </div>
            ) : drivers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No drivers found</div>
            ) : (
              <div className="divide-y divide-border/30">
                {drivers.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/10">
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${d.onDuty ? "bg-green-400" : "bg-muted-foreground/40"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{d.full_name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{d.hub}</span>
                      </div>
                      {d.activeLoadRef && (
                        <span className="text-xs text-blue-400 font-mono">{d.activeLoadRef}</span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs font-medium ${d.onDuty ? "text-green-400" : "text-muted-foreground"}`}>
                        {d.onDuty ? "On Duty" : "Off Duty"}
                      </span>
                      {d.lastPing && (
                        <div className="text-xs text-muted-foreground/60">{timeAgo(d.lastPing)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="border border-border/50">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Recent Activity
              <span className="ml-auto text-xs text-muted-foreground/60 font-normal normal-case">auto-refresh 30s</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {loading ? (
              <div className="px-5 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-8 bg-muted/30 rounded animate-pulse opacity-50" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No recent activity</div>
            ) : (
              <div className="divide-y divide-border/20 max-h-72 overflow-y-auto">
                {activity.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 px-5 py-2 hover:bg-muted/10">
                    <span className="text-xs text-muted-foreground/60 flex-shrink-0 mt-0.5 w-14 text-right">
                      {timeAgo(ev.created_at)}
                    </span>
                    <div className="flex-1 min-w-0 text-xs">
                      <span className="font-medium">{ev.driverName}</span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span className="font-mono text-blue-400">{ev.loadRef}</span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span className={
                        ev.new_status === "delivered" ? "text-green-400"
                          : ev.new_status === "in_progress" ? "text-yellow-400"
                          : ev.new_status === "failed" ? "text-red-400"
                          : "text-muted-foreground"
                      }>
                        {fmtStatus(ev.new_status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 4 — Weekly Quick Stats Bar */}
      <Card className="border border-border/50">
        <CardContent className="px-5 py-4">
          <div className="flex flex-wrap gap-6 items-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-shrink-0">
              This Week
            </span>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Revenue</span>
                <div className="font-mono font-semibold text-green-400">
                  {loading ? <span className="animate-pulse opacity-50">—</span> : fmtMoney(weekStats.revenue)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Loads</span>
                <div className="font-semibold">
                  {loading ? <span className="animate-pulse opacity-50">—</span> : weekStats.loads}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Avg On-Time</span>
                <div className={`font-semibold ${weekStats.onTimePct !== null ? (weekStats.onTimePct >= 80 ? "text-green-400" : weekStats.onTimePct >= 60 ? "text-yellow-400" : "text-red-400") : ""}`}>
                  {loading ? <span className="animate-pulse opacity-50">—</span> : (weekStats.onTimePct !== null ? `${weekStats.onTimePct}%` : "—")}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Top Client</span>
                <div className="font-semibold truncate max-w-[120px]">
                  {loading ? <span className="animate-pulse opacity-50">—</span> : (weekStats.topClient ?? "—")}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Top Driver</span>
                <div className="font-semibold truncate max-w-[120px]">
                  {loading ? <span className="animate-pulse opacity-50">—</span> : (weekStats.topDriver ?? "—")}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
