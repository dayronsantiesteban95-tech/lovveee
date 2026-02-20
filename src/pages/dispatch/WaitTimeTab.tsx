import { fmtMoney, fmtWait } from "@/lib/formatters";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Clock, DollarSign, BarChart3 } from "lucide-react";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import type { Load, Driver } from "./types";

const WAIT_COLORS = [
    { max: 15, label: "Good", class: "bg-green-500/15 text-green-700 dark:text-green-400" },
    { max: 30, label: "Caution", class: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    { max: 60, label: "High", class: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    { max: Infinity, label: "Critical", class: "bg-red-500/15 text-red-700 dark:text-red-400" },
];
const DETENTION_THRESHOLD = 30;

function waitBadgeClass(mins: number) {
    return (WAIT_COLORS.find((w) => mins <= w.max) ?? WAIT_COLORS[3]).class;
}

interface WaitAnalytics {
    avgAll: number;
    detentionEligible: Load[];
    detentionBilled: number;
    clientWait: { name: string; avg: number; loads: number }[];
    driverWait: { name: string; avg: number; loads: number }[];
}

interface WaitTimeTabProps {
    analytics: WaitAnalytics;
    driverName: (id: string | null) => string;
}

export default function WaitTimeTab({ analytics, driverName }: WaitTimeTabProps) {
    return (
        <div className="space-y-6">
            {/* Wait Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Avg Wait (Period)", value: fmtWait(analytics.avgAll), icon: Clock, color: analytics.avgAll > 30 ? "text-red-500" : "text-green-500" },
                    { label: "Detention Eligible", value: analytics.detentionEligible.length, icon: AlertTriangle, color: "text-orange-500" },
                    { label: "Detention Billed", value: fmtMoney(analytics.detentionBilled), icon: DollarSign, color: "text-green-500" },
                    { label: "Recovery Rate", value: analytics.detentionEligible.length > 0 ? `${Math.round(analytics.detentionEligible.filter((l) => l.detention_billed > 0).length / analytics.detentionEligible.length * 100)}%` : "N/A", icon: BarChart3, color: "text-blue-500" },
                ].map((s) => (
                    <Card key={s.label} className="glass-card rounded-2xl">
                        <CardContent className="pt-5 pb-4 px-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                                </div>
                                <s.icon className={`h-5 w-5 ${s.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Wait by Client */}
                <Card className="glass-card rounded-2xl">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Wait Time by Client</CardTitle></CardHeader>
                    <CardContent>
                        {analytics.clientWait.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No wait time data yet</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={analytics.clientWait} layout="vertical">
                                    <XAxis type="number" tick={{ fontSize: 11 }} unit="m" />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v: number) => [`${v} min`, "Avg Wait"]} />
                                    <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                                        {analytics.clientWait.map((_, i) => (
                                            <Cell key={i} fill={analytics.clientWait[i].avg >= 30 ? "hsl(0,70%,55%)" : analytics.clientWait[i].avg >= 15 ? "hsl(40,90%,50%)" : "hsl(140,60%,45%)"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Wait by Driver */}
                <Card className="glass-card rounded-2xl">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Wait Time by Driver</CardTitle></CardHeader>
                    <CardContent>
                        {analytics.driverWait.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No wait time data yet</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={analytics.driverWait} layout="vertical">
                                    <XAxis type="number" tick={{ fontSize: 11 }} unit="m" />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v: number) => [`${v} min`, "Avg Wait"]} />
                                    <Bar dataKey="avg" fill="hsl(200,80%,50%)" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detention-Eligible Loads */}
            <Card className="glass-card rounded-2xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" /> Detention-Eligible Loads (?{DETENTION_THRESHOLD}min)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {analytics.detentionEligible.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No detention-eligible loads in this period ??</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Ref #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Driver</TableHead>
                                    <TableHead>Wait</TableHead>
                                    <TableHead className="text-right">Detention Billed</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analytics.detentionEligible.map((l) => (
                                    <TableRow key={l.id}>
                                        <TableCell className="text-sm">{l.load_date}</TableCell>
                                        <TableCell className="font-mono text-xs">{l.reference_number || "--"}</TableCell>
                                        <TableCell className="text-sm">{l.client_name || "--"}</TableCell>
                                        <TableCell className="text-sm">{driverName(l.driver_id)}</TableCell>
                                        <TableCell><Badge className={`${waitBadgeClass(l.wait_time_minutes)} text-xs`}>{fmtWait(l.wait_time_minutes)}</Badge></TableCell>
                                        <TableCell className="text-right font-mono">{l.detention_billed > 0 ? fmtMoney(l.detention_billed) : <span className="text-red-500 text-xs">Not billed</span>}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function WaitTimeTabPage() {
  return (
    <ErrorBoundary>
      <WaitTimeTab />
    </ErrorBoundary>
  );
}
