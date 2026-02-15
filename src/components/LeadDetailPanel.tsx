import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LEAD_STAGES, CITY_HUBS, INDUSTRIES, SERVICE_TYPES, VEHICLE_TYPES, ACTIVITY_TYPES, ACTION_ZONE_CITIES } from "@/lib/constants";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format, differenceInDays } from "date-fns";
import {
    Phone, Mail, MapPin, TrendingUp, Clock, DollarSign,
    MessageSquare, FileText, Users, Crosshair, Truck, Building2,
    Star, Activity, CalendarDays, Target, Zap, BarChart3,
    Plus, Send, CheckCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────
type Lead = {
    id: string;
    company_name: string;
    contact_person: string;
    phone: string | null;
    email: string | null;
    main_lanes: string | null;
    estimated_monthly_loads: number | null;
    stage: string;
    next_action_date: string | null;
    created_at: string;
    city_hub: string | null;
    industry: string | null;
    delivery_points: string | null;
    service_type: string | null;
    avg_packages_day: number | null;
    delivery_radius_miles: number | null;
    vehicle_type: string | null;
    sla_requirement: string | null;
};

type Interaction = {
    id: string;
    note: string;
    activity_type: string;
    created_at: string;
    created_by: string;
};

type SavedQuote = {
    id: string;
    hub: string;
    vehicle_type: string;
    distance_miles: number;
    total_quote: number;
    notes: string | null;
    created_at: string;
};

type Contact = {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    job_title: string | null;
};

type SequenceStep = {
    id: string;
    step_type: string;
    status: string;
    response_status: string;
    follow_up_date: string | null;
    sent_at: string | null;
    created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────
const getStageIndex = (stage: string) => LEAD_STAGES.findIndex((s) => s.value === stage);
const getStageLabel = (stage: string) => LEAD_STAGES.find((s) => s.value === stage)?.label ?? stage;
const getCityLabel = (v: string | null) => CITY_HUBS.find((c) => c.value === v)?.label ?? null;
const getIndustryInfo = (v: string | null) => INDUSTRIES.find((i) => i.value === v) ?? null;
const getServiceLabel = (v: string | null) => SERVICE_TYPES.find((s) => s.value === v)?.label ?? null;
const getVehicleLabel = (v: string | null) => VEHICLE_TYPES.find((t) => t.value === v)?.label ?? null;

const checkActionZone = (deliveryPoints: string | null, cityHub: string | null): "in_zone" | "out_zone" | "no_data" => {
    if (!deliveryPoints || !cityHub) return "no_data";
    const zoneList = ACTION_ZONE_CITIES[cityHub];
    if (!zoneList) return "no_data";
    const lower = deliveryPoints.toLowerCase();
    return zoneList.some((city) => lower.includes(city)) ? "in_zone" : "out_zone";
};

const activityIcon = (type: string) => {
    const map: Record<string, React.ReactNode> = {
        note: <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
        email: <Mail className="h-3.5 w-3.5 text-green-500" />,
        call: <Phone className="h-3.5 w-3.5 text-orange-500" />,
        meeting: <Users className="h-3.5 w-3.5 text-purple-500" />,
    };
    return map[type] || <MessageSquare className="h-3.5 w-3.5" />;
};

// ─── Lead Score Calculation ───────────────────────────────
function calculateLeadScore(
    lead: Lead,
    interactionCount: number,
    quoteCount: number,
    sequenceSteps: SequenceStep[],
    lastContactDaysAgo: number | null,
): { score: number; label: string; color: string } {
    let score = 0;

    // Stage position (0-30 pts) — further in pipeline = higher score
    const stageIdx = getStageIndex(lead.stage);
    score += Math.min(30, Math.round((stageIdx / Math.max(1, LEAD_STAGES.length - 1)) * 30));

    // Recency of contact (0-25 pts) — more recent = higher
    if (lastContactDaysAgo !== null) {
        if (lastContactDaysAgo <= 2) score += 25;
        else if (lastContactDaysAgo <= 5) score += 20;
        else if (lastContactDaysAgo <= 10) score += 12;
        else if (lastContactDaysAgo <= 20) score += 5;
        // > 20 days = 0
    }

    // Interaction volume (0-20 pts)
    score += Math.min(20, interactionCount * 3);

    // Has quotes (0-15 pts)
    score += Math.min(15, quoteCount * 5);

    // Sequence response rate (0-10 pts)
    const sentSteps = sequenceSteps.filter((s) => s.status === "completed" || s.sent_at);
    const repliedSteps = sequenceSteps.filter((s) => s.response_status === "replied" || s.response_status === "interested_call");
    if (sentSteps.length > 0) {
        score += Math.round((repliedSteps.length / sentSteps.length) * 10);
    }

    score = Math.min(100, Math.max(0, score));

    const label = score >= 70 ? "Caliente 🔥" : score >= 40 ? "Tibio ☀️" : "Frío ❄️";
    const color = score >= 70 ? "text-red-500" : score >= 40 ? "text-yellow-500" : "text-blue-400";

    return { score, label, color };
}

// ─── Component ────────────────────────────────────────────
interface LeadDetailPanelProps {
    lead: Lead | null;
    open: boolean;
    onClose: () => void;
    onLeadUpdated: () => void;
}

export default function LeadDetailPanel({ lead, open, onClose, onLeadUpdated }: LeadDetailPanelProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    // Data state
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [quotes, setQuotes] = useState<SavedQuote[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
    const [loading, setLoading] = useState(true);

    // Activity form
    const [newNote, setNewNote] = useState("");
    const [activityType, setActivityType] = useState<string>("note");

    // ── Fetch All Data ──
    const fetchData = useCallback(async () => {
        if (!lead) return;
        setLoading(true);

        const [interactionsRes, quotesRes, contactsRes, seqRes] = await Promise.all([
            supabase
                .from("lead_interactions")
                .select("id, note, activity_type, created_at, created_by")
                .eq("lead_id", lead.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("saved_quotes")
                .select("id, hub, vehicle_type, distance_miles, total_quote, notes, created_at")
                .eq("lead_id", lead.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("contacts")
                .select("id, first_name, last_name, email, phone, job_title")
                .eq("lead_id", lead.id),
            supabase
                .from("lead_sequences")
                .select("id, step_type, status, response_status, follow_up_date, sent_at, created_at")
                .eq("lead_id", lead.id)
                .order("created_at", { ascending: true }),
        ]);

        setInteractions((interactionsRes.data as Interaction[]) ?? []);
        setQuotes((quotesRes.data as SavedQuote[]) ?? []);
        setContacts((contactsRes.data as Contact[]) ?? []);
        setSequenceSteps((seqRes.data as SequenceStep[]) ?? []);
        setLoading(false);
    }, [lead]);

    useEffect(() => {
        if (open && lead) {
            fetchData();
            setNewNote("");
            setActivityType("note");
        }
    }, [open, lead, fetchData]);

    // ── Add Interaction ──
    const addInteraction = async () => {
        if (!newNote.trim() || !lead || !user) return;
        const at = activityType as "note" | "email" | "call" | "meeting";
        const { error } = await supabase.from("lead_interactions").insert({
            lead_id: lead.id,
            note: newNote,
            activity_type: at,
            created_by: user.id,
        });
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            setNewNote("");
            fetchData();
            onLeadUpdated();
        }
    };

    if (!lead) return null;

    // ── Computed Metrics ──
    const leadAgeDays = differenceInDays(new Date(), new Date(lead.created_at));
    const lastInteraction = interactions.length > 0 ? interactions[0] : null;
    const lastContactDaysAgo = lastInteraction ? differenceInDays(new Date(), new Date(lastInteraction.created_at)) : null;
    const stageIdx = getStageIndex(lead.stage);
    const stagePct = Math.round(((stageIdx + 1) / LEAD_STAGES.length) * 100);

    const leadScore = calculateLeadScore(lead, interactions.length, quotes.length, sequenceSteps, lastContactDaysAgo);

    const totalQuoteValue = quotes.reduce((sum, q) => sum + q.total_quote, 0);
    const highestQuote = quotes.length > 0 ? Math.max(...quotes.map((q) => q.total_quote)) : 0;

    // Estimated monthly revenue (loads × avg quote)
    const avgQuote = quotes.length > 0 ? totalQuoteValue / quotes.length : 0;
    const estMonthlyRevenue = lead.estimated_monthly_loads && avgQuote > 0
        ? lead.estimated_monthly_loads * avgQuote
        : null;

    // Sequence progress
    const completedSteps = sequenceSteps.filter((s) => s.status === "completed").length;
    const totalSteps = sequenceSteps.length;
    const seqPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col">
                {/* ── Header ── */}
                <div className="p-6 pb-3 border-b bg-gradient-to-r from-primary/5 to-accent/5">
                    <SheetHeader>
                        <div className="flex items-start justify-between pr-8">
                            <div className="space-y-1">
                                <SheetTitle className="text-xl font-bold flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-primary" />
                                    {lead.company_name}
                                </SheetTitle>
                                <SheetDescription className="text-sm">
                                    {lead.contact_person}
                                    {lead.email && <span className="ml-2 text-muted-foreground">· {lead.email}</span>}
                                </SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>

                    {/* Badges + Stage Bar */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-xs px-2 py-0.5 font-semibold">
                            {getStageLabel(lead.stage)}
                        </Badge>
                        {getCityLabel(lead.city_hub) && (
                            <Badge variant="outline" className="text-xs px-2 py-0.5">
                                <MapPin className="h-3 w-3 mr-0.5" />{getCityLabel(lead.city_hub)}
                            </Badge>
                        )}
                        {getIndustryInfo(lead.industry) && (
                            <Badge className={`text-xs px-2 py-0.5 text-white ${getIndustryInfo(lead.industry)!.color}`}>
                                {getIndustryInfo(lead.industry)!.label}
                            </Badge>
                        )}
                        {getServiceLabel(lead.service_type) && (
                            <Badge variant="outline" className="text-xs px-2 py-0.5 border-accent/50 text-accent">
                                <Truck className="h-3 w-3 mr-0.5" />{getServiceLabel(lead.service_type)}
                            </Badge>
                        )}
                    </div>

                    {/* Pipeline Progress */}
                    <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Progreso en Pipeline</span>
                            <span className="font-semibold">{stagePct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                                style={{ width: `${stagePct}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-1">
                            {LEAD_STAGES.map((s, i) => (
                                <div
                                    key={s.value}
                                    className={`h-1.5 w-1.5 rounded-full transition-colors ${i <= stageIdx ? "bg-accent" : "bg-muted-foreground/30"}`}
                                    title={s.label}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="mx-6 mt-3 grid w-auto grid-cols-4 bg-muted/50">
                        <TabsTrigger value="overview" className="text-xs gap-1">
                            <BarChart3 className="h-3 w-3" /> Resumen
                        </TabsTrigger>
                        <TabsTrigger value="activity" className="text-xs gap-1">
                            <Activity className="h-3 w-3" /> Actividad
                        </TabsTrigger>
                        <TabsTrigger value="quotes" className="text-xs gap-1">
                            <DollarSign className="h-3 w-3" /> Cotizaciones
                        </TabsTrigger>
                        <TabsTrigger value="contacts" className="text-xs gap-1">
                            <Users className="h-3 w-3" /> Contactos
                        </TabsTrigger>
                    </TabsList>

                    {/* ═══════════ TAB 1: RESUMEN ═══════════ */}
                    <TabsContent value="overview" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-6">

                                {/* Lead Score */}
                                <Card className="border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
                                    <CardContent className="pt-5 pb-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Star className="h-4 w-4 text-accent" />
                                                <span className="text-sm font-semibold">Lead Score</span>
                                            </div>
                                            <span className={`text-sm font-bold ${leadScore.color}`}>{leadScore.label}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-3xl font-bold">{leadScore.score}</div>
                                            <div className="flex-1">
                                                <Progress value={leadScore.score} className="h-3" />
                                            </div>
                                            <span className="text-xs text-muted-foreground">/100</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Key Metrics Grid */}
                                <div>
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <TrendingUp className="h-3.5 w-3.5" /> Métricas de Venta
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <MetricCard
                                            icon={<CalendarDays className="h-4 w-4 text-blue-500" />}
                                            label="Edad del Lead"
                                            value={`${leadAgeDays} días`}
                                        />
                                        <MetricCard
                                            icon={<Clock className="h-4 w-4 text-orange-500" />}
                                            label="Último Contacto"
                                            value={lastContactDaysAgo !== null ? `Hace ${lastContactDaysAgo}d` : "Sin contacto"}
                                            alert={lastContactDaysAgo !== null && lastContactDaysAgo > 7}
                                        />
                                        <MetricCard
                                            icon={<MessageSquare className="h-4 w-4 text-green-500" />}
                                            label="Total Interacciones"
                                            value={String(interactions.length)}
                                        />
                                        <MetricCard
                                            icon={<FileText className="h-4 w-4 text-purple-500" />}
                                            label="Cotizaciones Enviadas"
                                            value={String(quotes.length)}
                                        />
                                        <MetricCard
                                            icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
                                            label="Cotización más Alta"
                                            value={highestQuote > 0 ? fmt(highestQuote) : "—"}
                                        />
                                        <MetricCard
                                            icon={<Target className="h-4 w-4 text-red-500" />}
                                            label="Ingreso Mensual Est."
                                            value={estMonthlyRevenue ? fmt(estMonthlyRevenue) : "—"}
                                            highlight={!!estMonthlyRevenue}
                                        />
                                    </div>
                                </div>

                                {/* Sequence Progress */}
                                {totalSteps > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <Zap className="h-3.5 w-3.5" /> Progreso de Secuencia
                                        </h4>
                                        <Card className="border shadow-sm">
                                            <CardContent className="pt-4 pb-3">
                                                <div className="flex items-center justify-between text-xs mb-2">
                                                    <span>{completedSteps} de {totalSteps} pasos completados</span>
                                                    <span className="font-semibold">{seqPct}%</span>
                                                </div>
                                                <Progress value={seqPct} className="h-2 mb-3" />
                                                <div className="flex gap-2 flex-wrap">
                                                    {sequenceSteps.map((step) => {
                                                        const isDone = step.status === "completed";
                                                        const isReplied = step.response_status === "replied" || step.response_status === "interested_call";
                                                        return (
                                                            <div
                                                                key={step.id}
                                                                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border ${isReplied
                                                                    ? "bg-green-500/10 border-green-500/40 text-green-600"
                                                                    : isDone
                                                                        ? "bg-blue-500/10 border-blue-500/40 text-blue-600"
                                                                        : "bg-muted border-muted-foreground/20 text-muted-foreground"
                                                                    }`}
                                                            >
                                                                {isReplied ? <CheckCircle className="h-3 w-3" /> : isDone ? <Send className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                                {step.step_type.replace("_", " ")}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Delivery Profile */}
                                <div>
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Truck className="h-3.5 w-3.5" /> Perfil de Entrega
                                    </h4>
                                    <Card className="border shadow-sm">
                                        <CardContent className="pt-4 pb-3 space-y-2 text-sm">
                                            <InfoRow label="Servicio" value={getServiceLabel(lead.service_type) ?? "—"} />
                                            <InfoRow label="Vehículo" value={getVehicleLabel(lead.vehicle_type) ?? "—"} />
                                            <InfoRow label="Cargas/Mes" value={lead.estimated_monthly_loads ? String(lead.estimated_monthly_loads) : "—"} />
                                            <InfoRow label="Paquetes/Día" value={lead.avg_packages_day ? String(lead.avg_packages_day) : "—"} />
                                            <InfoRow label="Radio" value={lead.delivery_radius_miles ? `${lead.delivery_radius_miles} millas` : "—"} />
                                            <InfoRow label="SLA" value={lead.sla_requirement ?? "—"} />
                                            {lead.delivery_points && (
                                                <div className="flex items-center justify-between pt-1">
                                                    <span className="text-muted-foreground text-xs">Zona de Acción</span>
                                                    {(() => {
                                                        const zone = checkActionZone(lead.delivery_points, lead.city_hub);
                                                        return (
                                                            <Badge variant="outline" className={`text-[10px] ${zone === "in_zone" ? "border-green-500 text-green-600" : "border-red-500 text-red-600"}`}>
                                                                <Crosshair className="h-3 w-3 mr-0.5" />
                                                                {zone === "in_zone" ? "En Zona" : "Fuera de Zona"}
                                                            </Badge>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                            {lead.main_lanes && (
                                                <div className="pt-1">
                                                    <span className="text-muted-foreground text-xs">Rutas Principales</span>
                                                    <p className="text-xs mt-0.5">{lead.main_lanes}</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Contact Info */}
                                <div>
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Phone className="h-3.5 w-3.5" /> Información de Contacto
                                    </h4>
                                    <Card className="border shadow-sm">
                                        <CardContent className="pt-4 pb-3 space-y-2 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="font-medium">{lead.contact_person}</span>
                                            </div>
                                            {lead.phone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <a href={`tel:${lead.phone}`} className="text-blue-500 hover:underline">{lead.phone}</a>
                                                </div>
                                            )}
                                            {lead.email && (
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <a href={`mailto:${lead.email}`} className="text-blue-500 hover:underline">{lead.email}</a>
                                                </div>
                                            )}
                                            {lead.next_action_date && (
                                                <div className="flex items-center gap-2">
                                                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span>Próxima Acción: <span className="font-medium">{lead.next_action_date}</span></span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* ═══════════ TAB 2: ACTIVIDAD ═══════════ */}
                    <TabsContent value="activity" className="flex-1 overflow-hidden flex flex-col">
                        <div className="px-6 pt-4 pb-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                Registrar Actividad
                            </h4>
                            <div className="flex gap-2">
                                <Select value={activityType} onValueChange={setActivityType}>
                                    <SelectTrigger className="w-28 h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACTIVITY_TYPES.map((a) => (
                                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    placeholder="Escribe una nota, email, llamada..."
                                    className="text-xs flex-1 min-h-[60px] resize-none"
                                />
                            </div>
                            <div className="flex justify-end mt-2">
                                <Button
                                    onClick={addInteraction}
                                    size="sm"
                                    disabled={!newNote.trim()}
                                    className="gap-1 btn-gradient text-xs"
                                >
                                    <Plus className="h-3 w-3" /> Registrar
                                </Button>
                            </div>
                        </div>
                        <Separator />
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-3">
                                {loading ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">Cargando actividad...</p>
                                ) : interactions.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">Sin actividad registrada</p>
                                        <p className="text-xs">Registra la primera interacción arriba</p>
                                    </div>
                                ) : (
                                    interactions.map((interaction) => (
                                        <div
                                            key={interaction.id}
                                            className="flex gap-3 group"
                                        >
                                            {/* Timeline dot + line */}
                                            <div className="flex flex-col items-center">
                                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                    {activityIcon(interaction.activity_type)}
                                                </div>
                                                <div className="w-px flex-1 bg-border mt-1" />
                                            </div>
                                            {/* Content */}
                                            <div className="flex-1 pb-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                                        {interaction.activity_type}
                                                    </Badge>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {format(new Date(interaction.created_at), "dd MMM yyyy · HH:mm")}
                                                    </span>
                                                </div>
                                                <p className="text-sm bg-muted/50 rounded-lg p-3">{interaction.note}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* ═══════════ TAB 3: COTIZACIONES ═══════════ */}
                    <TabsContent value="quotes" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-4">
                                {/* Summary */}
                                {quotes.length > 0 && (
                                    <div className="grid grid-cols-3 gap-3">
                                        <Card className="border-0 shadow-sm bg-green-500/5">
                                            <CardContent className="pt-3 pb-2 text-center">
                                                <p className="text-[10px] text-muted-foreground uppercase">Total Cotizadas</p>
                                                <p className="text-lg font-bold text-green-600">{fmt(totalQuoteValue)}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="border-0 shadow-sm bg-blue-500/5">
                                            <CardContent className="pt-3 pb-2 text-center">
                                                <p className="text-[10px] text-muted-foreground uppercase">Más Alta</p>
                                                <p className="text-lg font-bold text-blue-600">{fmt(highestQuote)}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="border-0 shadow-sm bg-purple-500/5">
                                            <CardContent className="pt-3 pb-2 text-center">
                                                <p className="text-[10px] text-muted-foreground uppercase">Cantidad</p>
                                                <p className="text-lg font-bold text-purple-600">{quotes.length}</p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Quote List */}
                                {loading ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">Cargando cotizaciones...</p>
                                ) : quotes.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">Sin cotizaciones vinculadas</p>
                                        <p className="text-xs">Las cotizaciones se vinculan desde el Rate Calculator</p>
                                    </div>
                                ) : (
                                    quotes.map((q, i) => (
                                        <Card key={q.id} className={`border shadow-sm transition-all hover:shadow-md ${i === 0 ? "border-accent/50" : ""}`}>
                                            <CardContent className="pt-4 pb-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <DollarSign className="h-4 w-4 text-green-500" />
                                                        <span className="text-lg font-bold">{fmt(q.total_quote)}</span>
                                                        {i === 0 && <Badge className="text-[9px] bg-accent/20 text-accent border-0">Más Reciente</Badge>}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(q.created_at), "dd MMM yyyy")}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 text-xs">
                                                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                                        {getCityLabel(q.hub) ?? q.hub}
                                                    </Badge>
                                                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                                        <Truck className="h-2.5 w-2.5 mr-0.5" />
                                                        {getVehicleLabel(q.vehicle_type) ?? q.vehicle_type}
                                                    </Badge>
                                                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                                        {q.distance_miles} mi
                                                    </Badge>
                                                </div>
                                                {q.notes && <p className="text-xs text-muted-foreground mt-2">{q.notes}</p>}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* ═══════════ TAB 4: CONTACTOS ═══════════ */}
                    <TabsContent value="contacts" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-4">
                                {loading ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">Cargando contactos...</p>
                                ) : contacts.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">Sin contactos vinculados</p>
                                        <p className="text-xs">Vincula contactos desde la sección Contactos en el menú lateral</p>
                                    </div>
                                ) : (
                                    contacts.map((c) => (
                                        <Card key={c.id} className="border shadow-sm hover:shadow-md transition-all">
                                            <CardContent className="pt-4 pb-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1">
                                                        <p className="font-semibold text-sm">{c.first_name} {c.last_name}</p>
                                                        {c.job_title && <p className="text-xs text-muted-foreground">{c.job_title}</p>}
                                                    </div>
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                        {c.first_name[0]}{c.last_name[0]}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-3 mt-2 text-xs">
                                                    {c.email && (
                                                        <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-blue-500 hover:underline">
                                                            <Mail className="h-3 w-3" /> {c.email}
                                                        </a>
                                                    )}
                                                    {c.phone && (
                                                        <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-blue-500 hover:underline">
                                                            <Phone className="h-3 w-3" /> {c.phone}
                                                        </a>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}

// ─── Sub-components ───────────────────────────────────────

function MetricCard({ icon, label, value, alert = false, highlight = false }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    alert?: boolean;
    highlight?: boolean;
}) {
    return (
        <div className={`rounded-xl border p-3 transition-all hover:shadow-sm ${alert ? "border-red-500/40 bg-red-500/5" : highlight ? "border-emerald-500/40 bg-emerald-500/5" : "bg-card"}`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
            <p className={`text-lg font-bold ${alert ? "text-red-500" : highlight ? "text-emerald-600" : ""}`}>{value}</p>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="text-xs font-medium">{value}</span>
        </div>
    );
}
