import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CITY_HUBS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    TrendingUp, TrendingDown, Shield, AlertTriangle,
    Plus, BarChart3, Zap, ArrowUpRight, ArrowDownRight, Edit2,
    Trash2, RefreshCw, Target, Award, Info,
} from "lucide-react";
import { differenceInDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────
type CompetitorRate = {
    id: string;
    competitor_name: string;
    hub: string;
    vehicle_type: string;
    service_type: string;
    base_rate: number;
    per_mile_rate: number;
    fuel_surcharge_pct: number;
    included_miles: number;
    min_charge: number;
    source: string;
    source_url: string | null;
    confidence: string;
    notes: string | null;
    effective_date: string;
    expiration_date: string | null;
    updated_at: string;
};

type ComparisonResult = {
    competitor: string;
    theirTotal: number;
    ourTotal: number;
    delta: number;        // positive = we're cheaper
    deltaPct: number;
    confidence: string;
    source: string;
    updatedAt: string;
};

// ─── Props ────────────────────────────────────────────────
interface MarketComparisonProps {
    hub: string;
    vehicleType: string;
    distance: number;
    ourTotal: number | null;   // our current quote total
}

export default function MarketComparison({ hub, vehicleType, distance, ourTotal }: MarketComparisonProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [rates, setRates] = useState<CompetitorRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<CompetitorRate | null>(null);

    // ── Fetch Competitor Rates ──
    const fetchRates = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("competitor_rates")
            .select("*")
            .eq("hub", hub)
            .eq("vehicle_type", vehicleType)
            .order("competitor_name");

        if (error) {
            // Silently fail — competitor rates table may not be populated
        } else {
            setRates((data ?? []).map((r) => ({
                ...r,
                base_rate: Number(r.base_rate) || 0,
                per_mile_rate: Number(r.per_mile_rate) || 0,
                fuel_surcharge_pct: Number(r.fuel_surcharge_pct) || 0,
                included_miles: Number(r.included_miles) || 0,
                min_charge: Number(r.min_charge) || 0,
            })) as CompetitorRate[]);
        }
        setLoading(false);
    }, [hub, vehicleType]);

    useEffect(() => { fetchRates(); }, [fetchRates]);

    // ── Calculate Competitor Quotes ──
    const comparisons: ComparisonResult[] = useMemo(() => {
        if (ourTotal === null || ourTotal <= 0) return [];

        return rates.map((r) => {
            // Calculate their quote using THEIR rate structure
            const billableMiles = Math.max(0, distance - r.included_miles);
            const transportation = r.base_rate + (billableMiles * r.per_mile_rate);
            const fuelSurcharge = transportation * (r.fuel_surcharge_pct / 100);
            const theirTotal = Math.max(r.min_charge, transportation + fuelSurcharge);

            const delta = theirTotal - ourTotal; // positive = we're cheaper
            const deltaPct = ourTotal > 0 ? (delta / ourTotal) * 100 : 0;

            return {
                competitor: r.competitor_name,
                theirTotal: +theirTotal.toFixed(2),
                ourTotal,
                delta: +delta.toFixed(2),
                deltaPct: +deltaPct.toFixed(1),
                confidence: r.confidence,
                source: r.source,
                updatedAt: r.updated_at,
            };
        }).sort((a, b) => a.theirTotal - b.theirTotal); // cheapest first
    }, [rates, ourTotal, distance]);

    // ── Market Position ──
    const marketPosition = useMemo(() => {
        if (comparisons.length === 0 || ourTotal === null) return null;

        const cheaperThanUs = comparisons.filter((c) => c.delta < 0).length;
        const moreExpensiveThanUs = comparisons.filter((c) => c.delta > 0).length;
        const avgCompetitorPrice = comparisons.reduce((sum, c) => sum + c.theirTotal, 0) / comparisons.length;
        const cheapest = comparisons[0];
        const mostExpensive = comparisons[comparisons.length - 1];
        const vsAvg = ourTotal - avgCompetitorPrice;
        const vsAvgPct = avgCompetitorPrice > 0 ? (vsAvg / avgCompetitorPrice) * 100 : 0;

        let position: "cheapest" | "competitive" | "premium" | "expensive";
        if (vsAvgPct < -10) position = "cheapest";
        else if (vsAvgPct <= 5) position = "competitive";
        else if (vsAvgPct <= 20) position = "premium";
        else position = "expensive";

        return {
            position,
            cheaperThanUs,
            moreExpensiveThanUs,
            avgCompetitorPrice: +avgCompetitorPrice.toFixed(2),
            vsAvg: +vsAvg.toFixed(2),
            vsAvgPct: +vsAvgPct.toFixed(1),
            cheapest,
            mostExpensive,
        };
    }, [comparisons, ourTotal]);

    // ── Save Rate ──
    const handleSaveRate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            competitor_name: fd.get("competitor_name") as string,
            hub,
            vehicle_type: vehicleType,
            service_type: "last_mile",
            base_rate: parseFloat(fd.get("base_rate") as string) || 0,
            per_mile_rate: parseFloat(fd.get("per_mile_rate") as string) || 0,
            fuel_surcharge_pct: parseFloat(fd.get("fuel_surcharge_pct") as string) || 0,
            included_miles: parseInt(fd.get("included_miles") as string) || 0,
            min_charge: parseFloat(fd.get("min_charge") as string) || 0,
            source: fd.get("source") as string || "manual",
            confidence: fd.get("confidence") as string || "medium",
            notes: fd.get("notes") as string || null,
            effective_date: new Date().toISOString().split("T")[0],
            created_by: user?.id,
        };

        let error;
        if (editingRate) {
            ({ error } = await supabase.from("competitor_rates").update(payload).eq("id", editingRate.id));
        } else {
            ({ error } = await supabase.from("competitor_rates").insert(payload));
        }

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({ title: editingRate ? "Tarifa actualizada" : "Tarifa agregada", description: `${payload.competitor_name} guardado.` });
            setAddDialogOpen(false);
            setEditingRate(null);
            fetchRates();
        }
    };

    // ── Delete Rate ──
    const handleDelete = async (id: string) => {
        const { error } = await supabase.from("competitor_rates").delete().eq("id", id);
        if (!error) {
            toast({ title: "Eliminado", description: "Tarifa de competidor eliminada." });
            fetchRates();
        }
    };

    const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const hubLabel = CITY_HUBS.find((h) => h.value === hub)?.label ?? hub;

    const positionConfig = {
        cheapest: { label: "Más Barato", color: "text-green-600", bg: "bg-green-500/10", icon: <Award className="h-4 w-4" /> },
        competitive: { label: "Competitivo", color: "text-blue-600", bg: "bg-blue-500/10", icon: <Target className="h-4 w-4" /> },
        premium: { label: "Premium", color: "text-amber-600", bg: "bg-amber-500/10", icon: <TrendingUp className="h-4 w-4" /> },
        expensive: { label: "Sobre Mercado", color: "text-red-600", bg: "bg-red-500/10", icon: <AlertTriangle className="h-4 w-4" /> },
    };

    const confidenceColor = (c: string) =>
        c === "high" ? "border-green-500/50 text-green-600" :
            c === "medium" ? "border-yellow-500/50 text-yellow-600" :
                "border-gray-400/50 text-gray-500";

    const sourceLabel = (s: string) =>
        s === "website" ? "Sitio Web" :
            s === "broker_post" ? "Broker" :
                s === "customer_intel" ? "Intel Cliente" : "Manual";

    const freshness = (updatedAt: string) => {
        const days = differenceInDays(new Date(), new Date(updatedAt));
        if (days <= 7) return { label: "Fresco", color: "text-green-500" };
        if (days <= 30) return { label: `${days}d`, color: "text-yellow-500" };
        return { label: `${days}d ⚠️`, color: "text-red-500" };
    };

    if (loading) {
        return (
            <Card className="border-0 shadow-sm">
                <CardContent className="pt-5 pb-4 text-center text-sm text-muted-foreground">
                    Cargando datos de mercado...
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Comparativa de Mercado
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">
                        {hubLabel} · {vehicleType === "cargo_van" ? "Cargo Van" : "Box Truck"}
                    </Badge>
                </h3>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={fetchRates} className="h-7 w-7 p-0">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingRate(null); setAddDialogOpen(true); }}
                        className="h-7 gap-1 text-xs"
                    >
                        <Plus className="h-3 w-3" /> Agregar
                    </Button>
                </div>
            </div>

            {/* ── Market Position Summary ── */}
            {marketPosition && ourTotal && (
                <Card className={`border-0 shadow-sm ${positionConfig[marketPosition.position].bg}`}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                {positionConfig[marketPosition.position].icon}
                                <span className={`text-sm font-bold ${positionConfig[marketPosition.position].color}`}>
                                    {positionConfig[marketPosition.position].label}
                                </span>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                                vs {comparisons.length} competidores
                            </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase">Tu Precio</p>
                                <p className="text-lg font-bold">{fmt(ourTotal)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase">Promedio Mercado</p>
                                <p className="text-lg font-bold">{fmt(marketPosition.avgCompetitorPrice)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase">Diferencia</p>
                                <p className={`text-lg font-bold flex items-center justify-center gap-0.5 ${marketPosition.vsAvg < 0 ? "text-green-600" : marketPosition.vsAvg > 0 ? "text-red-500" : ""
                                    }`}>
                                    {marketPosition.vsAvg < 0 ? <ArrowDownRight className="h-4 w-4" /> : marketPosition.vsAvg > 0 ? <ArrowUpRight className="h-4 w-4" /> : null}
                                    {marketPosition.vsAvgPct > 0 ? "+" : ""}{marketPosition.vsAvgPct}%
                                </p>
                            </div>
                        </div>

                        {/* Position bar */}
                        <div className="mt-3">
                            <div className="relative h-6 rounded-full bg-gradient-to-r from-green-500/20 via-blue-500/20 to-red-500/20 overflow-hidden">
                                {/* Market avg indicator */}
                                <div className="absolute inset-y-0 w-0.5 bg-muted-foreground/40" style={{ left: "50%" }} />

                                {/* Our position dot */}
                                {(() => {
                                    const minPrice = Math.min(ourTotal, ...comparisons.map(c => c.theirTotal)) * 0.9;
                                    const maxPrice = Math.max(ourTotal, ...comparisons.map(c => c.theirTotal)) * 1.1;
                                    const range = maxPrice - minPrice;
                                    const ourPos = range > 0 ? ((ourTotal - minPrice) / range) * 100 : 50;
                                    return (
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-primary shadow-lg border-2 border-white flex items-center justify-center z-10 transition-all"
                                            style={{ left: `calc(${Math.min(95, Math.max(5, ourPos))}% - 10px)` }}
                                            title={`Anika: ${fmt(ourTotal)}`}
                                        >
                                            <span className="text-[7px] font-bold text-white">A</span>
                                        </div>
                                    );
                                })()}

                                {/* Competitor dots */}
                                {comparisons.map((c) => {
                                    const minPrice = Math.min(ourTotal, ...comparisons.map(x => x.theirTotal)) * 0.9;
                                    const maxPrice = Math.max(ourTotal, ...comparisons.map(x => x.theirTotal)) * 1.1;
                                    const range = maxPrice - minPrice;
                                    const pos = range > 0 ? ((c.theirTotal - minPrice) / range) * 100 : 50;
                                    return (
                                        <div
                                            key={c.competitor}
                                            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-muted-foreground/50 border border-background transition-all"
                                            style={{ left: `calc(${Math.min(95, Math.max(5, pos))}% - 6px)` }}
                                            title={`${c.competitor}: ${fmt(c.theirTotal)}`}
                                        />
                                    );
                                })}
                            </div>
                            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                                <span>Más Barato</span>
                                <span>Más Caro</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Competitor Grid ── */}
            {comparisons.length === 0 && rates.length === 0 ? (
                <Card className="border shadow-sm">
                    <CardContent className="pt-6 pb-4 text-center">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">Sin datos de competidores para este hub/vehículo</p>
                        <p className="text-xs text-muted-foreground mt-1">Agrega tarifas de competidores para comparar</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingRate(null); setAddDialogOpen(true); }}
                            className="mt-3 gap-1 text-xs"
                        >
                            <Plus className="h-3 w-3" /> Agregar Competidor
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {comparisons.map((c) => {
                        const fresh = freshness(c.updatedAt);
                        return (
                            <Card
                                key={c.competitor}
                                className={`border shadow-sm transition-all hover:shadow-md ${c.delta > 0 ? "border-l-green-500 border-l-2" :
                                    c.delta < 0 ? "border-l-red-500 border-l-2" :
                                        "border-l-gray-300 border-l-2"
                                    }`}
                            >
                                <CardContent className="pt-3 pb-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{c.competitor}</span>
                                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${confidenceColor(c.confidence)}`}>
                                                {c.confidence === "high" ? "Alta" : c.confidence === "medium" ? "Media" : "Baja"}
                                            </Badge>
                                            <span className={`text-[10px] ${fresh.color}`}>{fresh.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold">{fmt(c.theirTotal)}</span>
                                            {c.delta !== 0 && (
                                                <Badge className={`text-[10px] px-1.5 py-0 border-0 ${c.delta > 0 ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"
                                                    }`}>
                                                    {c.delta > 0 ?
                                                        <><ArrowUpRight className="h-3 w-3 mr-0.5" />+{fmt(c.delta)}</> :
                                                        <><ArrowDownRight className="h-3 w-3 mr-0.5" />{fmt(c.delta)}</>
                                                    }
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                                        <span>Base: {fmt(rates.find(r => r.competitor_name === c.competitor)?.base_rate ?? 0)}</span>
                                        <span>·</span>
                                        <span>${rates.find(r => r.competitor_name === c.competitor)?.per_mile_rate?.toFixed(2) ?? "0"}/mi</span>
                                        <span>·</span>
                                        <span>FSC: {rates.find(r => r.competitor_name === c.competitor)?.fuel_surcharge_pct ?? 0}%</span>
                                        <span>·</span>
                                        <span>{sourceLabel(c.source)}</span>
                                        <div className="flex-1" />
                                        <Button
                                            variant="ghost" size="sm"
                                            className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
                                            onClick={() => { setEditingRate(rates.find(r => r.competitor_name === c.competitor)!); setAddDialogOpen(true); }}
                                        >
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost" size="sm"
                                            className="h-5 w-5 p-0 opacity-50 hover:opacity-100 text-destructive"
                                            onClick={() => handleDelete(rates.find(r => r.competitor_name === c.competitor)!.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ── Insights ── */}
            {marketPosition && ourTotal && (
                <Card className="border shadow-sm bg-muted/20">
                    <CardContent className="pt-4 pb-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5" /> Insights de Pricing
                        </h4>
                        <ul className="space-y-1.5 text-xs">
                            {marketPosition.vsAvg < 0 && (
                                <li className="flex items-start gap-1.5">
                                    <TrendingDown className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                                    <span>Estás <strong className="text-green-600">{Math.abs(marketPosition.vsAvgPct)}% debajo</strong> del promedio de mercado — excelente posición competitiva.</span>
                                </li>
                            )}
                            {marketPosition.vsAvg > 0 && marketPosition.vsAvg <= marketPosition.avgCompetitorPrice * 0.15 && (
                                <li className="flex items-start gap-1.5">
                                    <Shield className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                                    <span>Estás <strong>{marketPosition.vsAvgPct}% arriba</strong> del mercado — justificable con calidad de servicio y confiabilidad.</span>
                                </li>
                            )}
                            {marketPosition.vsAvg > marketPosition.avgCompetitorPrice * 0.15 && (
                                <li className="flex items-start gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                    <span>Estás <strong className="text-red-500">+{marketPosition.vsAvgPct}% sobre</strong> el mercado — considera activar Win Client Mode o ajustar márgenes.</span>
                                </li>
                            )}
                            {marketPosition.cheapest && marketPosition.cheapest.delta < 0 && (
                                <li className="flex items-start gap-1.5">
                                    <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                    <span><strong>{marketPosition.cheapest.competitor}</strong> es {fmt(Math.abs(marketPosition.cheapest.delta))} más barato — diferencia de {Math.abs(marketPosition.cheapest.deltaPct)}%.</span>
                                </li>
                            )}
                            {marketPosition.moreExpensiveThanUs > 0 && (
                                <li className="flex items-start gap-1.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                    <span>Eres más barato que <strong>{marketPosition.moreExpensiveThanUs} de {comparisons.length}</strong> competidores en este escenario.</span>
                                </li>
                            )}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* ── Add/Edit Dialog ── */}
            <Dialog open={addDialogOpen} onOpenChange={() => { setAddDialogOpen(false); setEditingRate(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingRate ? "Editar Tarifa" : "Agregar Competidor"}</DialogTitle>
                        <DialogDescription>
                            Ingresa las tarifas del competidor para {hubLabel} · {vehicleType === "cargo_van" ? "Cargo Van" : "Box Truck"}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveRate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Label>Nombre del Competidor *</Label>
                                <Input
                                    name="competitor_name"
                                    defaultValue={editingRate?.competitor_name ?? ""}
                                    placeholder="ej. FedEx, GoShare, Frayt..."
                                    required
                                />
                            </div>
                            <div>
                                <Label>Base Rate ($)</Label>
                                <Input name="base_rate" type="number" step="0.01" defaultValue={editingRate?.base_rate ?? ""} placeholder="0.00" />
                            </div>
                            <div>
                                <Label>Per Mile Rate ($)</Label>
                                <Input name="per_mile_rate" type="number" step="0.01" defaultValue={editingRate?.per_mile_rate ?? ""} placeholder="0.00" />
                            </div>
                            <div>
                                <Label>Fuel Surcharge (%)</Label>
                                <Input name="fuel_surcharge_pct" type="number" step="0.1" defaultValue={editingRate?.fuel_surcharge_pct ?? "0"} placeholder="0" />
                            </div>
                            <div>
                                <Label>Included Miles</Label>
                                <Input name="included_miles" type="number" defaultValue={editingRate?.included_miles ?? "0"} placeholder="0" />
                            </div>
                            <div>
                                <Label>Min Charge ($)</Label>
                                <Input name="min_charge" type="number" step="0.01" defaultValue={editingRate?.min_charge ?? ""} placeholder="0.00" />
                            </div>
                            <div>
                                <Label>Fuente</Label>
                                <select
                                    name="source"
                                    defaultValue={editingRate?.source ?? "manual"}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="manual">Manual</option>
                                    <option value="website">Sitio Web</option>
                                    <option value="broker_post">Broker Post</option>
                                    <option value="customer_intel">Intel Cliente</option>
                                </select>
                            </div>
                            <div>
                                <Label>Confianza</Label>
                                <select
                                    name="confidence"
                                    defaultValue={editingRate?.confidence ?? "medium"}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="high">Alta — dato confirmado</option>
                                    <option value="medium">Media — estimado confiable</option>
                                    <option value="low">Baja — referencia general</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <Label>Notas</Label>
                                <Textarea
                                    name="notes"
                                    defaultValue={editingRate?.notes ?? ""}
                                    placeholder="Fuente, fecha, condiciones especiales..."
                                    className="text-sm"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">{editingRate ? "Guardar Cambios" : "Agregar Competidor"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
