import { useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { fmtMoney, fmtWait } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Load, Driver } from "./types";

// Wait badge helpers (duplicated from parent to avoid coupling)
const WAIT_COLORS = [
    { max: 15, label: "Good", class: "bg-green-500/15 text-green-700 dark:text-green-400" },
    { max: 30, label: "Caution", class: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    { max: 60, label: "High", class: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    { max: Infinity, label: "Critical", class: "bg-red-500/15 text-red-700 dark:text-red-400" },
];
function waitBadgeClass(mins: number) {
    return (WAIT_COLORS.find((w) => mins <= w.max) ?? WAIT_COLORS[3]).class;
}

interface DailyReportProps {
    loads: Load[];
    drivers: Driver[];
    selectedDate: string;
    onSelectedDateChange: (date: string) => void;
}

export default function DailyReport({ loads, drivers, selectedDate, onSelectedDateChange }: DailyReportProps) {
    const { toast } = useToast();

    const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.full_name ?? "--";

    const dailyReport = useMemo(() => {
        const dayLoads = loads.filter((l) => l.load_date === selectedDate);
        const totalRevenue = dayLoads.reduce((s, l) => s + Number(l.revenue), 0);
        const totalCosts = dayLoads.reduce((s, l) => s + Number(l.driver_pay) + Number(l.fuel_cost), 0);
        const totalMiles = dayLoads.reduce((s, l) => s + Number(l.miles), 0);
        const delivered = dayLoads.filter((l) => l.status === "delivered" || l.status === "completed").length;

        // Per-driver breakdown
        const byDriver: Record<string, { loads: number; miles: number; revenue: number; waitTotal: number }> = {};
        dayLoads.forEach((l) => {
            const d = driverName(l.driver_id);
            if (!byDriver[d]) byDriver[d] = { loads: 0, miles: 0, revenue: 0, waitTotal: 0 };
            byDriver[d].loads += 1;
            byDriver[d].miles += Number(l.miles);
            byDriver[d].revenue += Number(l.revenue);
            byDriver[d].waitTotal += l.wait_time_minutes;
        });
        const driverRows = Object.entries(byDriver).map(([name, v]) => ({
            name, ...v, avgWait: v.loads ? Math.round(v.waitTotal / v.loads) : 0,
        })).sort((a, b) => b.revenue - a.revenue);

        // Per-shift
        const dayShift = dayLoads.filter((l) => l.shift === "day");
        const nightShift = dayLoads.filter((l) => l.shift === "night");

        return {
            total: dayLoads.length, delivered, totalRevenue, totalCosts,
            profit: totalRevenue - totalCosts,
            margin: totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue * 100) : 0,
            totalMiles, driverRows,
            shifts: [
                { label: "Day", loads: dayShift.length, miles: dayShift.reduce((s, l) => s + Number(l.miles), 0), revenue: dayShift.reduce((s, l) => s + Number(l.revenue), 0) },
                { label: "Night", loads: nightShift.length, miles: nightShift.reduce((s, l) => s + Number(l.miles), 0), revenue: nightShift.reduce((s, l) => s + Number(l.revenue), 0) },
            ],
        };
    }, [loads, selectedDate, drivers]);

    const copyReport = () => {
        const r = dailyReport;
        const text = `?? DAILY OPS REPORT -- ${selectedDate}\n${"-".repeat(40)}\n` +
            `Loads: ${r.total} (${r.delivered} delivered)\nMiles: ${r.totalMiles}\n` +
            `Revenue: ${fmtMoney(r.totalRevenue)}\nCosts: ${fmtMoney(r.totalCosts)}\n` +
            `Profit: ${fmtMoney(r.profit)} (${r.margin.toFixed(1)}%)\n\n` +
            `DRIVER BREAKDOWN:\n${r.driverRows.map((d) => `  ${d.name}: ${d.loads} loads, ${d.miles} mi, ${fmtMoney(d.revenue)}, wait avg ${fmtWait(d.avgWait)}`).join("\n")}\n\n` +
            `SHIFTS:\n${r.shifts.map((s) => `  ${s.label}: ${s.loads} loads, ${s.miles} mi, ${fmtMoney(s.revenue)}`).join("\n")}`;
        navigator.clipboard.writeText(text);
        toast({ title: "Report copied to clipboard" });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground">Report Date</Label>
                <Input type="date" className="w-40 h-9" value={selectedDate} onChange={(e) => onSelectedDateChange(e.target.value)} />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={copyReport}>
                    <Copy className="h-3.5 w-3.5" /> Copy Report
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: "Total Loads", value: dailyReport.total, sub: `${dailyReport.delivered} delivered` },
                    { label: "Total Miles", value: dailyReport.totalMiles.toFixed(0), sub: "load miles" },
                    { label: "Revenue", value: fmtMoney(dailyReport.totalRevenue), sub: "gross" },
                    { label: "Costs", value: fmtMoney(dailyReport.totalCosts), sub: "driver + fuel" },
                    { label: "Profit", value: fmtMoney(dailyReport.profit), sub: dailyReport.profit >= 0 ? "?" : "?" },
                    { label: "Margin", value: `${dailyReport.margin.toFixed(1)}%`, sub: dailyReport.margin >= 30 ? "Healthy" : dailyReport.margin >= 15 ? "OK" : "Low" },
                ].map((s) => (
                    <Card key={s.label} className="glass-card rounded-2xl">
                        <CardContent className="pt-4 pb-3 px-4 text-center">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                            <p className="text-xl font-bold mt-1">{s.value}</p>
                            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Driver Performance Table */}
            <Card className="glass-card rounded-2xl">
                <CardHeader className="pb-2"><CardTitle className="text-base">Driver Performance</CardTitle></CardHeader>
                <CardContent>
                    {dailyReport.driverRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No loads for this date</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Driver</TableHead>
                                    <TableHead className="text-center">Loads</TableHead>
                                    <TableHead className="text-right">Miles</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                    <TableHead className="text-right">Rev/Mile</TableHead>
                                    <TableHead>Avg Wait</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dailyReport.driverRows.map((d) => (
                                    <TableRow key={d.name}>
                                        <TableCell className="font-medium">{d.name}</TableCell>
                                        <TableCell className="text-center">{d.loads}</TableCell>
                                        <TableCell className="text-right font-mono">{d.miles.toFixed(0)}</TableCell>
                                        <TableCell className="text-right font-mono">{fmtMoney(d.revenue)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{d.miles > 0 ? fmtMoney(d.revenue / d.miles) : "--"}</TableCell>
                                        <TableCell><Badge className={`${waitBadgeClass(d.avgWait)} text-xs`}>{fmtWait(d.avgWait)}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Shift Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dailyReport.shifts.map((s) => (
                    <Card key={s.label} className="glass-card rounded-2xl">
                        <CardContent className="pt-5 pb-4 px-5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">{s.label === "Day" ? "??" : "??"}</span>
                                <p className="font-semibold">{s.label} Shift</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div><p className="text-xs text-muted-foreground">Loads</p><p className="text-lg font-bold">{s.loads}</p></div>
                                <div><p className="text-xs text-muted-foreground">Miles</p><p className="text-lg font-bold">{s.miles.toFixed(0)}</p></div>
                                <div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-lg font-bold">{fmtMoney(s.revenue)}</p></div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

export default function DailyReportPage() {
  return (
    <ErrorBoundary>
      <DailyReport />
    </ErrorBoundary>
  );
}
