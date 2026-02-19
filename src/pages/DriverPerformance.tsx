import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, daysAgoISO, todayISO } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trophy,
  Clock,
  DollarSign,
  ClipboardCheck,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriverPerf {
  driver_id: string;
  driver_name: string;
  hub: string;
  total_loads: number;
  delivered_loads: number;
  failed_loads: number;
  on_time_rate: number;
  total_revenue: number;
  total_miles: number;
  avg_revenue_per_load: number;
  pod_compliance_rate: number;
}

type SortKey = keyof Pick<
  DriverPerf,
  | "driver_name"
  | "hub"
  | "total_loads"
  | "total_revenue"
  | "avg_revenue_per_load"
  | "on_time_rate"
  | "pod_compliance_rate"
>;

type SortDir = "asc" | "desc";

// ─── Hub colour map ───────────────────────────────────────────────────────────

const HUB_COLORS: Record<string, string> = {
  Miami: "bg-blue-500",
  Atlanta: "bg-orange-500",
  Orlando: "bg-purple-500",
  Tampa: "bg-green-500",
  Jacksonville: "bg-red-500",
  Charlotte: "bg-yellow-500",
};

function hubColor(hub: string): string {
  return HUB_COLORS[hub] ?? "bg-slate-500";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 60
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({
  col,
  active,
  dir,
}: {
  col: SortKey;
  active: SortKey;
  dir: SortDir;
}) {
  if (col !== active) return <ChevronsUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
  return dir === "asc" ? (
    <ChevronUp className="h-3 w-3 ml-1 inline" />
  ) : (
    <ChevronDown className="h-3 w-3 ml-1 inline" />
  );
}

// ─── Row highlight for top 3 ─────────────────────────────────────────────────

const rankStyle: Record<number, string> = {
  0: "border-l-4 border-l-yellow-400",
  1: "border-l-4 border-l-slate-400",
  2: "border-l-4 border-l-amber-600",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export default function DriverPerformance() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DriverPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("total_revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase.rpc("get_driver_performance", {
        p_start_date: daysAgoISO(days),
        p_end_date: todayISO(),
      });
      if (error) throw error;
      // Cast numbers (Supabase may return strings for numeric columns)
      const parsed: DriverPerf[] = (rows ?? []).map((r: Record<string, unknown>) => ({
        driver_id: r.driver_id as string,
        driver_name: r.driver_name as string,
        hub: r.hub as string,
        total_loads: Number(r.total_loads ?? 0),
        delivered_loads: Number(r.delivered_loads ?? 0),
        failed_loads: Number(r.failed_loads ?? 0),
        on_time_rate: Number(r.on_time_rate ?? 0),
        total_revenue: Number(r.total_revenue ?? 0),
        total_miles: Number(r.total_miles ?? 0),
        avg_revenue_per_load: Number(r.avg_revenue_per_load ?? 0),
        pod_compliance_rate: Number(r.pod_compliance_rate ?? 0),
      }));
      setData(parsed);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = (col: SortKey) => {
    if (col === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("desc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc"
        ? av.localeCompare(bv)
        : bv.localeCompare(av);
    }
    return sortDir === "asc"
      ? (av as number) - (bv as number)
      : (bv as number) - (av as number);
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const topDriver = data[0] ?? null; // already ordered by revenue desc from DB
  const totalRevenue = data.reduce((s, d) => s + d.total_revenue, 0);
  const avgOnTime =
    data.length > 0
      ? data.reduce((s, d) => s + d.on_time_rate, 0) / data.length
      : 0;
  const avgPOD =
    data.length > 0
      ? data.reduce((s, d) => s + d.pod_compliance_rate, 0) / data.length
      : 0;

  // ── Th helper ─────────────────────────────────────────────────────────────
  const Th = ({
    col,
    children,
  }: {
    col: SortKey;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors"
      onClick={() => handleSort(col)}
    >
      {children}
      <SortIcon col={col} active={sortKey} dir={sortDir} />
    </TableHead>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold tracking-tight">Driver Performance</h1>
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.days}
              size="sm"
              variant={days === opt.days ? "default" : "outline"}
              onClick={() => setDays(opt.days)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top Driver */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Driver
            </CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
            ) : topDriver ? (
              <>
                <p className="text-lg font-bold truncate">{topDriver.driver_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtMoney(topDriver.total_revenue)} revenue
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Avg On-Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg On-Time Rate
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-6 w-1/2 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <p className="text-2xl font-bold">{avgOnTime.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  across {data.length} driver{data.length !== 1 ? "s" : ""}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <p className="text-2xl font-bold">{fmtMoney(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  all active drivers
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Avg POD */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg POD Compliance
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-6 w-1/2 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <p className="text-2xl font-bold">{avgPOD.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  proof of delivery
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Loading spinner ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!loading && data.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No performance data found</p>
            <p className="text-xs text-muted-foreground">
              Try extending the date range or check that drivers have active loads.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Driver Cards Grid ───────────────────────────────────────────────── */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.map((d) => (
            <Card key={d.driver_id} className="overflow-hidden">
              <CardContent className="p-4 space-y-4">
                {/* Header row */}
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full ${hubColor(d.hub)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                  >
                    {initials(d.driver_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{d.driver_name}</p>
                    <Badge variant="secondary" className="text-xs mt-0.5">
                      {d.hub}
                    </Badge>
                  </div>
                </div>

                {/* 4 stat boxes */}
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { label: "Loads", value: String(d.total_loads) },
                      { label: "Revenue", value: fmtMoney(d.total_revenue) },
                      { label: "Rev/Load", value: fmtMoney(d.avg_revenue_per_load) },
                      {
                        label: "On-Time",
                        value: `${d.on_time_rate.toFixed(1)}%`,
                      },
                    ] as const
                  ).map((s) => (
                    <div
                      key={s.label}
                      className="bg-muted/50 rounded-lg p-2 text-center"
                    >
                      <p className="text-[10px] text-muted-foreground mb-1">{s.label}</p>
                      <p className="text-xs font-bold truncate">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bars */}
                <div className="space-y-2">
                  <ProgressBar value={d.on_time_rate} label="On-Time Rate" />
                  <ProgressBar value={d.pod_compliance_rate} label="POD Compliance" />
                </div>

                {/* Footer row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span>
                    🛣️{" "}
                    {d.total_miles.toLocaleString("en-US", { maximumFractionDigits: 0 })} mi
                  </span>
                  {d.failed_loads > 0 ? (
                    <span className="flex items-center gap-1 text-red-500 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {d.failed_loads} failed
                    </span>
                  ) : (
                    <span className="text-emerald-500 font-medium">✓ No failures</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Rankings Table ──────────────────────────────────────────────────── */}
      {!loading && data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Driver Rankings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 pl-4">Rank</TableHead>
                    <Th col="driver_name">Driver</Th>
                    <Th col="hub">Hub</Th>
                    <Th col="total_loads">Loads</Th>
                    <Th col="total_revenue">Revenue</Th>
                    <Th col="avg_revenue_per_load">Rev/Load</Th>
                    <Th col="on_time_rate">On-Time%</Th>
                    <Th col="pod_compliance_rate">POD%</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((d, i) => {
                    // Find original rank by revenue for medal coloring
                    const revenueRank = data.findIndex(
                      (x) => x.driver_id === d.driver_id
                    );
                    const rowClass =
                      rankStyle[revenueRank] ??
                      "border-l-4 border-l-transparent";

                    return (
                      <TableRow
                        key={d.driver_id}
                        className={`${rowClass} hover:bg-muted/50`}
                      >
                        <TableCell className="pl-4 font-medium text-muted-foreground">
                          {revenueRank === 0
                            ? "🥇"
                            : revenueRank === 1
                            ? "🥈"
                            : revenueRank === 2
                            ? "🥉"
                            : i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-7 w-7 rounded-full ${hubColor(d.hub)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}
                            >
                              {initials(d.driver_name)}
                            </div>
                            <span className="font-medium">{d.driver_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {d.hub}
                          </Badge>
                        </TableCell>
                        <TableCell>{d.total_loads}</TableCell>
                        <TableCell className="font-medium">
                          {fmtMoney(d.total_revenue)}
                        </TableCell>
                        <TableCell>{fmtMoney(d.avg_revenue_per_load)}</TableCell>
                        <TableCell>
                          <span
                            className={
                              d.on_time_rate >= 80
                                ? "text-emerald-600 font-medium"
                                : d.on_time_rate >= 60
                                ? "text-yellow-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            {d.on_time_rate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              d.pod_compliance_rate >= 80
                                ? "text-emerald-600 font-medium"
                                : d.pod_compliance_rate >= 60
                                ? "text-yellow-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            {d.pod_compliance_rate.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
