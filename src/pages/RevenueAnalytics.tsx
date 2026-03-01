// -----------------------------------------------------------
// REVENUE ANALYTICS -- Anika Control OS
// Sections:
//   1. KPI Summary Cards
//   2. 6-Month Revenue Trend (Line Chart)
//   3. Revenue by Hub (Bar Chart + Table)
//   4. Top Drivers by Revenue (Table)
//   5. Top Clients by Revenue (Table)
//   6. Path to $200K Widget
// -----------------------------------------------------------
import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import AccessDenied from "@/components/AccessDenied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHLY_TARGET = 200_000;
const TARGET_DRIVER_AVG = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyLoadRow {
  revenue: number | null;
  driver_pay: number | null;
  hub: string;
  client_name: string | null;
  driver_id: string | null;
  load_date: string;
  status: string;
}

interface MonthPoint {
  label: string; // e.g. "Sep 25"
  revenue: number;
  margin: number;
}

interface HubRow {
  hub: string;
  loads: number;
  revenue: number;
  avgPerLoad: number;
  pct: number;
}

interface DriverRow {
  rank: number;
  driverId: string;
  loads: number;
  revenue: number;
  margin: number;
  avgPerLoad: number;
}

interface ClientRow {
  rank: number;
  client: string;
  loads: number;
  revenue: number;
  pct: number;
  avgPerLoad: number;
}

interface KpiData {
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  grossMarginPct: number;
  targetProgress: number;
  pctChange: number;
}

interface AnalyticsData {
  kpi: KpiData;
  trend: MonthPoint[];
  hubs: HubRow[];
  drivers: DriverRow[];
  clients: ClientRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}

function monthLabel(year: number, month: number): string {
  const d = new Date(year, month, 1);
  const mmm = d.toLocaleString("en-US", { month: "short" });
  const yy = String(d.getFullYear()).slice(2);
  return `${mmm} ${yy}`;
}

function safeNum(n: number | null | undefined): number {
  return n ?? 0;
}

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth(); // 0-based

  // Build last-6-months window
  const months: Array<{ year: number; month: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const sixMonthsAgo = monthRange(months[0].year, months[0].month).start;
  const endOfThisMonth = monthRange(thisYear, thisMonth).end;

  // Fetch all non-cancelled loads in the 6-month window
  const { data, error } = await supabase
    .from("daily_loads")
    .select("revenue, driver_pay, hub, client_name, driver_id, load_date, status")
    .neq("status", "cancelled")
    .gte("load_date", sixMonthsAgo)
    .lte("load_date", endOfThisMonth);

  if (error) throw error;

  const rows = (data ?? []) as DailyLoadRow[];

  // ---- KPI: this month and last month ----
  const thisMR = monthRange(thisYear, thisMonth);
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
  const lastMR = monthRange(lastMonthDate.getFullYear(), lastMonthDate.getMonth());

  const thisMonthRows = rows.filter(
    (r) => r.load_date >= thisMR.start && r.load_date <= thisMR.end
  );
  const lastMonthRows = rows.filter(
    (r) => r.load_date >= lastMR.start && r.load_date <= lastMR.end
  );

  const thisMonthRevenue = thisMonthRows.reduce((s, r) => s + safeNum(r.revenue), 0);
  const lastMonthRevenue = lastMonthRows.reduce((s, r) => s + safeNum(r.revenue), 0);

  const thisMonthGross = thisMonthRows.reduce(
    (s, r) => s + (safeNum(r.revenue) - safeNum(r.driver_pay)),
    0
  );
  const grossMarginPct =
    thisMonthRevenue > 0 ? (thisMonthGross / thisMonthRevenue) * 100 : 0;

  const pctChange =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

  const targetProgress = (thisMonthRevenue / MONTHLY_TARGET) * 100;

  // ---- 6-Month trend ----
  const trend: MonthPoint[] = months.map(({ year, month }) => {
    const mr = monthRange(year, month);
    const mRows = rows.filter((r) => r.load_date >= mr.start && r.load_date <= mr.end);
    const rev = mRows.reduce((s, r) => s + safeNum(r.revenue), 0);
    const gross = mRows.reduce(
      (s, r) => s + (safeNum(r.revenue) - safeNum(r.driver_pay)),
      0
    );
    return {
      label: monthLabel(year, month),
      revenue: Math.round(rev),
      margin: Math.round(gross),
    };
  });

  // ---- Revenue by Hub ----
  const hubMap: Record<string, { loads: number; revenue: number }> = {};
  for (const r of rows) {
    const h = r.hub || "Unknown";
    if (!hubMap[h]) hubMap[h] = { loads: 0, revenue: 0 };
    hubMap[h].loads += 1;
    hubMap[h].revenue += safeNum(r.revenue);
  }
  const totalRevAllHubs = Object.values(hubMap).reduce((s, h) => s + h.revenue, 0);
  const hubs: HubRow[] = Object.entries(hubMap)
    .map(([hub, v]) => ({
      hub,
      loads: v.loads,
      revenue: v.revenue,
      avgPerLoad: v.loads > 0 ? v.revenue / v.loads : 0,
      pct: totalRevAllHubs > 0 ? (v.revenue / totalRevAllHubs) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // ---- Top Drivers ----
  const driverMap: Record<string, { loads: number; revenue: number; gross: number }> = {};
  for (const r of rows) {
    const did = r.driver_id ?? "unknown";
    if (!driverMap[did]) driverMap[did] = { loads: 0, revenue: 0, gross: 0 };
    driverMap[did].loads += 1;
    driverMap[did].revenue += safeNum(r.revenue);
    driverMap[did].gross += safeNum(r.revenue) - safeNum(r.driver_pay);
  }
  const drivers: DriverRow[] = Object.entries(driverMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10)
    .map(([driverId, v], idx) => ({
      rank: idx + 1,
      driverId,
      loads: v.loads,
      revenue: v.revenue,
      margin: v.revenue > 0 ? (v.gross / v.revenue) * 100 : 0,
      avgPerLoad: v.loads > 0 ? v.revenue / v.loads : 0,
    }));

  // ---- Top Clients ----
  const clientMap: Record<string, { loads: number; revenue: number }> = {};
  for (const r of rows) {
    const cn = r.client_name ?? "Unknown";
    if (!clientMap[cn]) clientMap[cn] = { loads: 0, revenue: 0 };
    clientMap[cn].loads += 1;
    clientMap[cn].revenue += safeNum(r.revenue);
  }
  const totalRevAllClients = Object.values(clientMap).reduce((s, c) => s + c.revenue, 0);
  const clients: ClientRow[] = Object.entries(clientMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10)
    .map(([client, v], idx) => ({
      rank: idx + 1,
      client,
      loads: v.loads,
      revenue: v.revenue,
      pct: totalRevAllClients > 0 ? (v.revenue / totalRevAllClients) * 100 : 0,
      avgPerLoad: v.loads > 0 ? v.revenue / v.loads : 0,
    }));

  return {
    kpi: {
      thisMonthRevenue,
      lastMonthRevenue,
      grossMarginPct,
      targetProgress,
      pctChange,
    },
    trend,
    hubs,
    drivers,
    clients,
  };
}

// ---------------------------------------------------------------------------
// Custom Y-axis formatter
// ---------------------------------------------------------------------------

function fmtAxisMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

// ---------------------------------------------------------------------------
// Section 1: KPI Cards
// ---------------------------------------------------------------------------

interface KpiCardsProps {
  kpi: KpiData;
}

function KpiCards({ kpi }: KpiCardsProps) {
  const isUp = kpi.pctChange >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* This Month Revenue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            This Month Revenue
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmtMoney(kpi.thisMonthRevenue)}</div>
          <p className="text-xs text-muted-foreground mt-1">Current calendar month</p>
        </CardContent>
      </Card>

      {/* Last Month + % change */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Last Month Revenue
          </CardTitle>
          {isUp ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmtMoney(kpi.lastMonthRevenue)}</div>
          <p className={`text-xs mt-1 ${isUp ? "text-green-600" : "text-red-500"}`}>
            {isUp ? "+" : ""}
            {kpi.pctChange.toFixed(1)}% vs last month
          </p>
        </CardContent>
      </Card>

      {/* Gross Margin */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gross Margin
          </CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpi.grossMarginPct.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground mt-1">Revenue minus driver pay</p>
        </CardContent>
      </Card>

      {/* Target Progress */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Target Progress
          </CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.min(kpi.targetProgress, 100).toFixed(1)}%
          </div>
          <Progress
            value={Math.min(kpi.targetProgress, 100)}
            className="mt-2 h-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            of {fmtMoney(MONTHLY_TARGET)} monthly target
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: 6-Month Revenue Trend
// ---------------------------------------------------------------------------

interface TrendChartProps {
  data: MonthPoint[];
}

function TrendChart({ data }: TrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">6-Month Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 8, right: 24, left: 12, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtAxisMoney} tick={{ fontSize: 12 }} width={70} />
            <Tooltip
              formatter={(val: number, name: string) => [
                fmtMoney(val),
                name === "revenue" ? "Revenue" : "Gross Margin",
              ]}
            />
            <Legend
              formatter={(value) =>
                value === "revenue" ? "Revenue" : "Gross Margin"
              }
            />
            <ReferenceLine
              y={MONTHLY_TARGET}
              stroke="#ef4444"
              strokeDasharray="6 3"
              label={{ value: "Target", position: "insideTopRight", fontSize: 11, fill: "#ef4444" }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="margin"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Revenue by Hub
// ---------------------------------------------------------------------------

interface HubChartProps {
  data: HubRow[];
}

function HubChart({ data }: HubChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue by Hub</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tickFormatter={fmtAxisMoney} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="hub" tick={{ fontSize: 12 }} width={56} />
            <Tooltip
              formatter={(val: number) => fmtMoney(val)}
              labelFormatter={(label) => `Hub: ${label}`}
            />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hub</TableHead>
                <TableHead className="text-right">Loads</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Avg/Load</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.hub}>
                  <TableCell className="font-medium">{row.hub}</TableCell>
                  <TableCell className="text-right">{row.loads.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{fmtMoney(row.revenue)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(Math.round(row.avgPerLoad))}</TableCell>
                  <TableCell className="text-right">{row.pct.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hub data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Top Drivers by Revenue
// ---------------------------------------------------------------------------

interface DriversTableProps {
  data: DriverRow[];
}

function DriversTable({ data }: DriversTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Drivers by Revenue (6-Month Window)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Driver ID</TableHead>
                <TableHead className="text-right">Loads</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Avg/Load</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.driverId}>
                  <TableCell className="font-bold text-muted-foreground">
                    #{row.rank}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.driverId === "unknown"
                      ? "Unassigned"
                      : row.driverId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-right">{row.loads.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{fmtMoney(row.revenue)}</TableCell>
                  <TableCell className="text-right">{row.margin.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{fmtMoney(Math.round(row.avgPerLoad))}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No driver data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Top Clients by Revenue
// ---------------------------------------------------------------------------

interface ClientsTableProps {
  data: ClientRow[];
}

function ClientsTable({ data }: ClientsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Clients by Revenue (6-Month Window)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Loads</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
                <TableHead className="text-right">Avg/Load</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.client}>
                  <TableCell className="font-bold text-muted-foreground">
                    #{row.rank}
                  </TableCell>
                  <TableCell className="font-medium">{row.client}</TableCell>
                  <TableCell className="text-right">{row.loads.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{fmtMoney(row.revenue)}</TableCell>
                  <TableCell className="text-right">{row.pct.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{fmtMoney(Math.round(row.avgPerLoad))}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No client data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section 6: Path to $200K Widget
// ---------------------------------------------------------------------------

interface PathWidgetProps {
  kpi: KpiData;
  thisMonthLoads: number;
}

function PathWidget({ kpi, thisMonthLoads }: PathWidgetProps) {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const dailyPace =
    dayOfMonth > 0 ? kpi.thisMonthRevenue / dayOfMonth : 0;
  const projectedMonthly = dailyPace * daysInMonth;
  const gap = Math.max(0, MONTHLY_TARGET - kpi.thisMonthRevenue);
  const driversNeeded =
    kpi.thisMonthRevenue > 0
      ? Math.ceil((MONTHLY_TARGET - kpi.thisMonthRevenue) / TARGET_DRIVER_AVG)
      : Math.ceil(MONTHLY_TARGET / TARGET_DRIVER_AVG);
  const avgPerLoad =
    thisMonthLoads > 0 ? kpi.thisMonthRevenue / thisMonthLoads : 0;
  const loadsNeeded = avgPerLoad > 0 ? Math.ceil(gap / avgPerLoad) : 0;

  const onTrack = projectedMonthly >= MONTHLY_TARGET;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Path to {fmtMoney(MONTHLY_TARGET)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Daily Pace</p>
            <p className="text-lg font-bold">{fmtMoney(Math.round(dailyPace))}/day</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Projected Monthly</p>
            <p className={`text-lg font-bold ${onTrack ? "text-green-600" : "text-orange-500"}`}>
              {fmtMoney(Math.round(projectedMonthly))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Gap to Target</p>
            <p className="text-lg font-bold text-red-500">
              {gap > 0 ? fmtMoney(Math.round(gap)) : "Target met!"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Days Remaining</p>
            <p className="text-lg font-bold">{daysRemaining}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Drivers Needed (at {fmtMoney(TARGET_DRIVER_AVG)} avg)
            </p>
            <p className="text-lg font-bold">
              {gap > 0 ? `${driversNeeded} more` : "On track"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Loads Needed (at {fmtMoney(Math.round(avgPerLoad))} avg)
            </p>
            <p className="text-lg font-bold">
              {gap > 0 && loadsNeeded > 0 ? `${loadsNeeded} more` : gap === 0 ? "Done" : "N/A"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">Loading revenue data...</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-7 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content component
// ---------------------------------------------------------------------------

function RevenueAnalyticsContent() {
  const { toast } = useToast();
  const { role, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [thisMonthLoads, setThisMonthLoads] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchAnalyticsData();
        if (cancelled) return;

        // Compute this-month load count for Path widget
        const now = new Date();
        const thisMR = monthRange(now.getFullYear(), now.getMonth());
        const tmLoads = result.hubs.reduce((s, h) => {
          // We don't have per-hub monthly breakdown here, so we use trend last point
          return s;
        }, 0);

        // Use last trend point (this month) revenue to back-calculate
        const lastPoint = result.trend[result.trend.length - 1];
        const avgPerLoad =
          result.drivers.length > 0
            ? result.drivers.reduce((s, d) => s + d.avgPerLoad, 0) /
              result.drivers.length
            : 0;
        const estimated =
          avgPerLoad > 0 && lastPoint
            ? Math.round(lastPoint.revenue / avgPerLoad)
            : 0;

        if (!cancelled) {
          setData(result);
          setThisMonthLoads(estimated);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load revenue data";
        toast({ title: "Error", description: msg, variant: "destructive" });
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // -- Role guard (after all hooks) --
  if (roleLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (role !== "owner" && role !== "dispatcher") return <AccessDenied message="Admin or dispatcher access required to view Revenue Analytics." />;

  if (loading) return <LoadingSkeleton />;
  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No revenue data available.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Revenue Analytics</h1>
          <p className="text-sm text-muted-foreground">
            6-month window - excludes cancelled loads
          </p>
        </div>
      </div>

      {/* Section 1: KPI Cards */}
      <KpiCards kpi={data.kpi} />

      {/* Section 2: Trend Chart */}
      <TrendChart data={data.trend} />

      {/* Section 3: Hub Chart */}
      <HubChart data={data.hubs} />

      {/* Section 4 + 5: Side by side on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DriversTable data={data.drivers} />
        <ClientsTable data={data.clients} />
      </div>

      {/* Section 6: Path to $200K */}
      <PathWidget kpi={data.kpi} thisMonthLoads={thisMonthLoads} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export with ErrorBoundary
// ---------------------------------------------------------------------------

export default function RevenueAnalytics() {
  return (
    <ErrorBoundary>
      <RevenueAnalyticsContent />
    </ErrorBoundary>
  );
}
