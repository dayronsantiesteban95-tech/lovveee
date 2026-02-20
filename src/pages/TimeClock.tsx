/**
 * TimeClock.tsx -- Anika Control OS | Phase 8
 * Driver Time Clock -- Clock in/out, breaks, payroll summary
 * Created by Jarvis -- Feb 19, 2026 (overnight)
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Clock, LogIn, LogOut, Coffee, RefreshCw, Users,
  DollarSign, Timer, TrendingUp, AlertCircle, Play, Square,
  ChevronDown, ChevronUp, Calendar, BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// --- Types -------------------------------------------------------

interface Driver {
  id: string;
  full_name: string;
  hub: string;
  status: string;
  hourly_rate: number;
  phone: string | null;
}

interface ActiveClock {
  entry_id: string;
  driver_id: string;
  driver_name: string;
  hourly_rate: number;
  hub: string;
  shift: string;
  clock_in: string;
  work_date: string;
  elapsed_minutes: number;
  on_break: boolean;
  active_break_id: string | null;
}

interface TimeEntry {
  id: string;
  driver_id: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_minutes: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_pay: number | null;
  hub: string;
  shift: string;
  work_date: string;
  notes: string | null;
  drivers?: { full_name: string; hourly_rate: number };
}

interface PayrollRow {
  driver_id: string;
  full_name: string;
  hourly_rate: number;
  hub: string;
  week_start: string;
  shifts: number;
  total_work_minutes: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_pay: number;
}

// --- Helpers -----------------------------------------------------

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtElapsed(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtHours(h: number | null): string {
  if (h == null) return "--";
  return `${h.toFixed(2)}h`;
}

function fmtPay(pay: number | null): string {
  if (pay == null) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
  }).format(pay);
}

const HUB_OPTIONS = ["PHX", "ATL", "LA"];
const SHIFT_OPTIONS = ["day", "night", "weekend"];

// --- Sub-components -----------------------------------------------

interface ActiveCardProps {
  clock: ActiveClock;
  onClockOut: (entryId: string, driverName: string) => void;
  onStartBreak: (entryId: string, driverId: string, driverName: string) => void;
  onEndBreak: (breakId: string, driverName: string) => void;
  refreshCount: number;
}

function ActiveDriverCard({ clock, onClockOut, onStartBreak, onEndBreak, refreshCount }: ActiveCardProps) {
  const [elapsed, setElapsed] = useState(clock.elapsed_minutes);

  // Live tick every minute
  useEffect(() => {
    setElapsed(clock.elapsed_minutes);
    const interval = setInterval(() => setElapsed(prev => prev + 1), 60_000);
    return () => clearInterval(interval);
  }, [clock.elapsed_minutes, refreshCount]);

  const earnedSoFar = (elapsed / 60) * clock.hourly_rate;

  return (
    <Card className="glass-panel border-0 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
      {/* Subtle top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${clock.on_break ? "bg-amber-500" : "bg-emerald-500"}`} />
      <CardContent className="p-5 space-y-4">
        {/* Driver header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-foreground">{clock.driver_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{clock.hub}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{clock.shift}</Badge>
              {clock.on_break ? (
                <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">On Break</Badge>
              ) : (
                <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-mono font-bold text-foreground">{fmtElapsed(elapsed)}</p>
            <p className="text-xs text-muted-foreground">since {fmtTime(clock.clock_in)}</p>
          </div>
        </div>

        {/* Earned estimate */}
        <div className="bg-muted/30 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Est. earned
          </span>
          <span className="text-sm font-semibold text-emerald-400">{fmtPay(earnedSoFar)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {clock.on_break ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              onClick={() => onEndBreak(clock.active_break_id!, clock.driver_name)}
            >
              <Play className="h-3 w-3" /> End Break
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-2 border-border hover:bg-muted"
              onClick={() => onStartBreak(clock.entry_id, clock.driver_id, clock.driver_name)}
            >
              <Coffee className="h-3 w-3" /> Break
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
            onClick={() => onClockOut(clock.entry_id, clock.driver_name)}
          >
            <Square className="h-3 w-3" /> Clock Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Page ----------------------------------------------------

export default function TimeClock() {
  const { toast } = useToast();
  const { isOwner } = useUserRole();

  // Data state
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeClocks, setActiveClocks] = useState<ActiveClock[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  // Clock-in dialog
  const [clockInOpen, setClockInOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedHub, setSelectedHub] = useState<string>("PHX");
  const [selectedShift, setSelectedShift] = useState<string>("day");
  const [clockInNotes, setClockInNotes] = useState<string>("");
  const [clockInLoading, setClockInLoading] = useState(false);

  // Clock-out dialog
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [clockOutEntry, setClockOutEntry] = useState<{ id: string; name: string } | null>(null);
  const [clockOutNotes, setClockOutNotes] = useState<string>("");
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [clockOutResult, setClockOutResult] = useState<Record<string, number> | null>(null);

  // Break dialogs
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [breakTarget, setBreakTarget] = useState<{ entryId: string; driverId: string; name: string } | null>(null);
  const [breakType, setBreakType] = useState<"break" | "lunch">("break");
  const [breakLoading, setBreakLoading] = useState(false);

  // --- Data fetching ----------------------------------------------

  const fetchAll = useCallback(async () => {
    try {
      const [driversRes, activeRes, entriesRes] = await Promise.all([
        supabase.from("drivers").select("id,full_name,hub,status,hourly_rate,phone").order("full_name"),
        supabase.from("v_active_clocks").select("*"),
        supabase
          .from("time_entries")
          .select("*, drivers(full_name, hourly_rate)")
          .order("clock_in", { ascending: false })
          .limit(50),
      ]);

      if (driversRes.data) setDrivers(driversRes.data);
      if (activeRes.data) setActiveClocks(activeRes.data as ActiveClock[]);
      if (entriesRes.data) setRecentEntries(entriesRes.data as TimeEntry[]);
    } catch {
      // Silent failure -- will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPayroll = useCallback(async () => {
    const { data } = await supabase.from("v_payroll_summary").select("*").limit(100);
    if (data) setPayrollRows(data as PayrollRow[]);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshCount]);

  const refresh = () => {
    setRefreshCount(c => c + 1);
    fetchPayroll();
  };

  // --- Clock-in action -------------------------------------------

  const handleClockIn = async () => {
    if (!selectedDriver) return;
    setClockInLoading(true);
    try {
      const { data, error } = await supabase.rpc("clock_in_driver", {
        p_driver_id: selectedDriver,
        p_hub: selectedHub,
        p_shift: selectedShift,
        p_notes: clockInNotes || null,
      });
      if (error) throw error;

      const driverName = drivers.find(d => d.id === selectedDriver)?.full_name ?? "Driver";
      toast({ title: "Clocked In v", description: `${driverName} is now on shift.` });
      setClockInOpen(false);
      setSelectedDriver("");
      setClockInNotes("");
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Clock-in failed", description: msg, variant: "destructive" });
    } finally {
      setClockInLoading(false);
    }
  };

  // --- Clock-out action ------------------------------------------

  const openClockOut = (entryId: string, driverName: string) => {
    setClockOutEntry({ id: entryId, name: driverName });
    setClockOutResult(null);
    setClockOutNotes("");
    setClockOutOpen(true);
  };

  const handleClockOut = async () => {
    if (!clockOutEntry) return;
    setClockOutLoading(true);
    try {
      const { data, error } = await supabase.rpc("clock_out_driver", {
        p_entry_id: clockOutEntry.id,
        p_notes: clockOutNotes || null,
      });
      if (error) throw error;
      setClockOutResult(data as Record<string, number>);
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Clock-out failed", description: msg, variant: "destructive" });
    } finally {
      setClockOutLoading(false);
    }
  };

  const closeClockOut = () => {
    setClockOutOpen(false);
    setClockOutEntry(null);
    setClockOutResult(null);
  };

  // --- Break actions ---------------------------------------------

  const openStartBreak = (entryId: string, driverId: string, name: string) => {
    setBreakTarget({ entryId, driverId, name });
    setBreakType("break");
    setBreakDialogOpen(true);
  };

  const handleStartBreak = async () => {
    if (!breakTarget) return;
    setBreakLoading(true);
    try {
      const { error } = await supabase.rpc("start_break", {
        p_entry_id: breakTarget.entryId,
        p_driver_id: breakTarget.driverId,
        p_type: breakType,
      });
      if (error) throw error;
      toast({ title: "Break started", description: `${breakTarget.name} is on ${breakType}.` });
      setBreakDialogOpen(false);
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Break failed", description: msg, variant: "destructive" });
    } finally {
      setBreakLoading(false);
    }
  };

  const handleEndBreak = async (breakId: string, name: string) => {
    try {
      const { error } = await supabase.rpc("end_break", { p_break_id: breakId });
      if (error) throw error;
      toast({ title: "Break ended", description: `${name} is back on shift.` });
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Break end failed", description: msg, variant: "destructive" });
    }
  };

  // --- Derived stats ---------------------------------------------

  const totalOnShift = activeClocks.length;
  const onBreakCount = activeClocks.filter(c => c.on_break).length;
  const totalEstPay = activeClocks.reduce((acc, c) => {
    return acc + (c.elapsed_minutes / 60) * c.hourly_rate;
  }, 0);
  const todayEntries = recentEntries.filter(e =>
    e.work_date === new Date().toISOString().slice(0, 10)
  );
  const todayTotalPay = todayEntries.reduce((acc, e) => acc + (e.total_pay ?? 0), 0);

  // Available to clock in = drivers not currently on shift
  const activeDriverIds = new Set(activeClocks.map(c => c.driver_id));
  const availableDrivers = drivers.filter(d => !activeDriverIds.has(d.id) && d.status !== "inactive");

  // --- Render ----------------------------------------------------

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* -- Header -- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6 text-accent" /> Time Clock
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Driver hours, breaks & payroll tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={() => setClockInOpen(true)}
            disabled={availableDrivers.length === 0}
          >
            <LogIn className="h-4 w-4" /> Clock In Driver
          </Button>
        </div>
      </div>

      {/* -- Summary KPIs -- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: <Users className="h-5 w-5 text-emerald-400" />,
            label: "On Shift",
            value: loading ? "--" : `${totalOnShift}`,
            sub: `${onBreakCount} on break`,
            color: "text-emerald-400",
          },
          {
            icon: <Coffee className="h-5 w-5 text-amber-400" />,
            label: "On Break",
            value: loading ? "--" : `${onBreakCount}`,
            sub: `of ${totalOnShift} drivers`,
            color: "text-amber-400",
          },
          {
            icon: <DollarSign className="h-5 w-5 text-accent" />,
            label: "Est. Live Pay",
            value: loading ? "--" : fmtPay(totalEstPay),
            sub: "all active drivers",
            color: "text-accent",
          },
          {
            icon: <BarChart3 className="h-5 w-5 text-blue-400" />,
            label: "Today Payroll",
            value: loading ? "--" : fmtPay(todayTotalPay),
            sub: `${todayEntries.filter(e => e.clock_out).length} completed shifts`,
            color: "text-blue-400",
          },
        ].map((stat) => (
          <Card key={stat.label} className="glass-panel border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {stat.icon}
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</span>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* -- Main Content -- */}
      <Tabs defaultValue="live" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="live" className="gap-2">
            <Timer className="h-3.5 w-3.5" /> Live Clocks ({totalOnShift})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Calendar className="h-3.5 w-3.5" /> History
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2" onClick={fetchPayroll}>
            <TrendingUp className="h-3.5 w-3.5" /> Payroll
          </TabsTrigger>
        </TabsList>

        {/* -- Live Clocks Tab -- */}
        <TabsContent value="live" className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : activeClocks.length === 0 ? (
            <Card className="glass-panel border-0">
              <CardContent className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                <Clock className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground">No drivers currently clocked in</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setClockInOpen(true)}
                  disabled={availableDrivers.length === 0}
                >
                  <LogIn className="h-4 w-4" /> Clock In First Driver
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeClocks.map(clock => (
                <ActiveDriverCard
                  key={clock.entry_id}
                  clock={clock}
                  refreshCount={refreshCount}
                  onClockOut={openClockOut}
                  onStartBreak={openStartBreak}
                  onEndBreak={handleEndBreak}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* -- History Tab -- */}
        <TabsContent value="history">
          <Card className="glass-panel border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Recent Entries (last 50)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-2">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead className="text-xs">Driver</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Hub</TableHead>
                      <TableHead className="text-xs">Clock In</TableHead>
                      <TableHead className="text-xs">Clock Out</TableHead>
                      <TableHead className="text-xs">Work Hours</TableHead>
                      <TableHead className="text-xs">OT</TableHead>
                      <TableHead className="text-xs">Break</TableHead>
                      <TableHead className="text-xs text-right">Pay</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentEntries.map(entry => (
                      <TableRow key={entry.id} className="border-border/20 hover:bg-muted/20">
                        <TableCell className="font-medium text-sm">
                          {(entry.drivers as { full_name: string } | undefined)?.full_name ?? "--"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(entry.work_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{entry.hub}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{fmtTime(entry.clock_in)}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {entry.clock_out ? fmtTime(entry.clock_out) : (
                            <span className="text-emerald-400 text-xs">Active</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{fmtHours(entry.regular_hours)}</TableCell>
                        <TableCell className="text-xs">
                          {entry.overtime_hours && entry.overtime_hours > 0 ? (
                            <span className="text-amber-400 font-semibold">{fmtHours(entry.overtime_hours)}</span>
                          ) : "--"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.break_minutes ? `${entry.break_minutes}m` : "--"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {entry.total_pay != null ? (
                            <span className="text-emerald-400">{fmtPay(entry.total_pay)}</span>
                          ) : "--"}
                        </TableCell>
                        <TableCell>
                          {entry.clock_out ? (
                            <Badge className="text-xs bg-muted text-muted-foreground border-0">Complete</Badge>
                          ) : (
                            <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Live</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {recentEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          No time entries yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -- Payroll Tab -- */}
        <TabsContent value="payroll">
          <Card className="glass-panel border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Weekly Payroll Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead className="text-xs">Driver</TableHead>
                    <TableHead className="text-xs">Week Of</TableHead>
                    <TableHead className="text-xs">Hub</TableHead>
                    <TableHead className="text-xs">Shifts</TableHead>
                    <TableHead className="text-xs">Reg Hours</TableHead>
                    <TableHead className="text-xs">OT Hours</TableHead>
                    <TableHead className="text-xs">Rate</TableHead>
                    <TableHead className="text-xs text-right">Total Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRows.map((row, idx) => (
                    <TableRow key={idx} className="border-border/20 hover:bg-muted/20">
                      <TableCell className="font-medium text-sm">{row.full_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(row.week_start)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{row.hub}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{row.shifts}</TableCell>
                      <TableCell className="text-xs">{fmtHours(row.total_regular_hours)}</TableCell>
                      <TableCell className="text-xs">
                        {row.total_overtime_hours > 0 ? (
                          <span className="text-amber-400 font-semibold">{fmtHours(row.total_overtime_hours)}</span>
                        ) : "--"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        ${row.hourly_rate}/hr
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-400">
                        {fmtPay(row.total_pay)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {payrollRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No payroll data yet -- complete some shifts first
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ----------------------------------------
          DIALOGS
      ---------------------------------------- */}

      {/* -- Clock In Dialog -- */}
      <Dialog open={clockInOpen} onOpenChange={setClockInOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-emerald-400" /> Clock In Driver
            </DialogTitle>
            <DialogDescription>Select the driver starting their shift.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Driver</label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2">
                        {d.full_name}
                        <Badge variant="outline" className="text-xs ml-1">{d.hub}</Badge>
                        <span className="text-muted-foreground text-xs">${d.hourly_rate}/hr</span>
                      </span>
                    </SelectItem>
                  ))}
                  {availableDrivers.length === 0 && (
                    <SelectItem value="none" disabled>All drivers on shift</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Hub</label>
                <Select value={selectedHub} onValueChange={setSelectedHub}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HUB_OPTIONS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Shift</label>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHIFT_OPTIONS.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="e.g. AOG standby, airport run..."
                value={clockInNotes}
                onChange={e => setClockInNotes(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockInOpen(false)}>Cancel</Button>
            <Button
              onClick={handleClockIn}
              disabled={!selectedDriver || clockInLoading}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {clockInLoading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Clocking in...</>
              ) : (
                <><LogIn className="h-4 w-4" /> Clock In</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- Clock Out Dialog -- */}
      <Dialog open={clockOutOpen} onOpenChange={open => { if (!open) closeClockOut(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-red-400" />
              Clock Out -- {clockOutEntry?.name}
            </DialogTitle>
          </DialogHeader>

          {clockOutResult ? (
            /* - Summary screen - */
            <div className="space-y-4 py-2">
              <div className="bg-muted/30 rounded-xl p-5 space-y-3">
                <p className="text-sm font-semibold text-center text-foreground">Shift Summary</p>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  {[
                    ["Total Time", fmtElapsed(clockOutResult.total_minutes)],
                    ["Break Time", `${clockOutResult.break_minutes}m`],
                    ["Regular Hours", fmtHours(clockOutResult.regular_hours)],
                    ["Overtime", clockOutResult.overtime_hours > 0 ? fmtHours(clockOutResult.overtime_hours) : "None"],
                    ["Hourly Rate", `$${clockOutResult.hourly_rate}/hr`],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{val}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Total Pay</span>
                  <span className="text-xl font-bold text-emerald-400">{fmtPay(clockOutResult.total_pay)}</span>
                </div>
              </div>
              <Button className="w-full" onClick={closeClockOut}>Done</Button>
            </div>
          ) : (
            /* - Confirmation screen - */
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Clocking out <strong>{clockOutEntry?.name}</strong>. Their hours and pay will be calculated automatically.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="e.g. Completed all AOG runs, no issues..."
                  value={clockOutNotes}
                  onChange={e => setClockOutNotes(e.target.value)}
                  className="resize-none"
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeClockOut}>Cancel</Button>
                <Button
                  onClick={handleClockOut}
                  disabled={clockOutLoading}
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  {clockOutLoading ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    <><LogOut className="h-4 w-4" /> Clock Out</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* -- Break Dialog -- */}
      <Dialog open={breakDialogOpen} onOpenChange={setBreakDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-amber-400" />
              Start Break -- {breakTarget?.name}
            </DialogTitle>
            <DialogDescription>Break time will be tracked and deducted from payroll.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Break Type</label>
              <Select value={breakType} onValueChange={v => setBreakType(v as "break" | "lunch")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="break">Short Break (15 min)</SelectItem>
                  <SelectItem value="lunch">Lunch Break (30 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBreakDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleStartBreak}
              disabled={breakLoading}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {breakLoading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Starting...</>
              ) : (
                <><Coffee className="h-4 w-4" /> Start Break</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
