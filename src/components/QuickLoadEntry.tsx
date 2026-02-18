/**
 * ═══════════════════════════════════════════════════════════
 * ORDER ENTRY — Full Load Creation (OnTime 360-Style)
 *
 * Comprehensive load entry form matching OnTime's fields but
 * with a modern, sleek UI. Sections:
 *
 *   1. Customer Select          — search + autocomplete
 *   2. Collection Location      — pickup + time window
 *   3. Delivery Location        — delivery + time window
 *   4. Package Details          — qty, weight, dims, type
 *   5. Service & Pricing        — type, rate, charges
 *   6. Assignment               — driver, vehicle, branch
 *   7. Notes & Reference        — ref #, PO, instructions
 *
 * Features:
 *   • Auto-generated reference # (ANK-YYMMDD-XXXX)
 *   • Client info sidebar (email, phone, address)
 *   • Recent address autocomplete
 *   • Batch mode — keep creating without closing
 *   • One-click clone support
 *   • Keyboard shortcut: Ctrl+Enter to save
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
    Plus, Package, MapPin, Building2,
    CheckCircle2, RefreshCw, Layers, DollarSign,
    Truck, FileText, Phone, Mail, Box,
    RotateCw, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Reference # generator ────────────────────────────

function generateReference(): string {
    const d = new Date();
    const datePart = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    // Use timestamp + random for better collision resistance at scale
    const rand = (Date.now() % 100000).toString(36).toUpperCase() +
        Math.random().toString(36).substring(2, 4).toUpperCase();
    return `ANK-${datePart}-${rand.slice(0, 5)}`;
}

// ─── Types ─────────────────────────────────────────────

interface OrderFormData {
    // Customer
    client_name: string;
    requested_by: string;
    // Collection
    pickup_address: string;
    pickup_zone: string;
    pickup_date: string;
    pickup_time_from: string;
    pickup_time_to: string;
    // Delivery
    delivery_address: string;
    delivery_zone: string;
    delivery_date: string;
    delivery_time_from: string;
    delivery_time_to: string;
    // Details
    description: string;
    packages: number;
    weight_lbs: number;
    distance_miles: number;
    dim_length: number;
    dim_width: number;
    dim_height: number;
    // Reference & IDs
    reference_number: string;
    purchase_order: string;
    // Package / Vehicle
    package_type: string;
    vehicle_type: string;
    // Service & Pricing
    service_type: string;
    pricing_method: string;
    base_rate: number;
    per_mile_rate: number;
    fuel_surcharge: number;
    additional_charges: number;
    total_cost: number;
    // Customer contact
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    // Assignment
    hub: string;
    // Notes
    comments: string;
}

const EMPTY_FORM: OrderFormData = {
    client_name: "",
    requested_by: "",
    pickup_address: "",
    pickup_zone: "",
    pickup_date: new Date().toISOString().split("T")[0],
    pickup_time_from: "",
    pickup_time_to: "",
    delivery_address: "",
    delivery_zone: "",
    delivery_date: new Date().toISOString().split("T")[0],
    delivery_time_from: "",
    delivery_time_to: "",
    description: "",
    packages: 1,
    weight_lbs: 0,
    distance_miles: 0,
    dim_length: 0,
    dim_width: 0,
    dim_height: 0,
    reference_number: "",
    purchase_order: "",
    package_type: "box",
    vehicle_type: "car",
    service_type: "standard",
    pricing_method: "flat",
    base_rate: 0,
    per_mile_rate: 0,
    fuel_surcharge: 0,
    additional_charges: 0,
    total_cost: 0,
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    hub: "phoenix",
    comments: "",
};

const SERVICE_TYPES = [
    { value: "standard", label: "Standard Delivery", icon: "📦" },
    { value: "same_day", label: "Same Day", icon: "⚡" },
    { value: "rush", label: "Rush / Hot Shot", icon: "🔥" },
    { value: "scheduled", label: "Scheduled", icon: "📅" },
    { value: "round_trip", label: "Round Trip", icon: "🔄" },
    { value: "white_glove", label: "White Glove", icon: "🤍" },
];

const PACKAGE_TYPES = [
    { value: "box", label: "Box" },
    { value: "envelope", label: "Envelope" },
    { value: "pallet", label: "Pallet" },
    { value: "crate", label: "Crate" },
    { value: "tube", label: "Tube" },
    { value: "custom", label: "Custom" },
];

const VEHICLE_TYPES = [
    { value: "car", label: "Car / Sedan" },
    { value: "suv", label: "SUV / Cargo Van" },
    { value: "box_truck", label: "Box Truck" },
    { value: "flatbed", label: "Flatbed" },
    { value: "sprinter", label: "Sprinter Van" },
];

const PRICING_METHODS = [
    { value: "flat", label: "Flat Rate" },
    { value: "distance", label: "Distance Based" },
    { value: "cost_plus", label: "Cost + Markup" },
];

// ═══════════════════════════════════════════════════════════

interface QuickLoadEntryProps {
    loadDate?: string;
    hub?: string;
    onLoadCreated?: () => void;
    prefill?: Partial<OrderFormData>;
    compact?: boolean;
    drivers?: { id: string; full_name: string }[];
}

export default function QuickLoadEntry({
    loadDate, hub, onLoadCreated, prefill, compact, drivers,
}: QuickLoadEntryProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const firstFieldRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState<OrderFormData>({
        ...EMPTY_FORM,
        hub: hub ?? "phoenix",
        reference_number: generateReference(),
        pickup_date: loadDate ?? new Date().toISOString().split("T")[0],
        delivery_date: loadDate ?? new Date().toISOString().split("T")[0],
        ...prefill,
    });
    const [saving, setSaving] = useState(false);
    const [batchMode, setBatchMode] = useState(false);
    const [loadCount, setLoadCount] = useState(0);
    const [selectedDriverId, setSelectedDriverId] = useState<string>("");
    const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
    const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
    const [expandedSections, setExpandedSections] = useState({
        customer: true,
        collection: true,
        delivery: true,
        details: true,
        service: true,
        assignment: true,
        notes: false,
    });
    const [clientInfo, setClientInfo] = useState<{
        email?: string; phone?: string; address?: string;
    } | null>(null);

    // Load recent data for autocomplete
    useEffect(() => {
        const fetchRecent = async () => {
            const [addrRes, clientRes] = await Promise.all([
                (supabase as any)
                    .from("daily_loads")
                    .select("delivery_address, pickup_address")
                    .not("delivery_address", "is", null)
                    .order("created_at", { ascending: false })
                    .limit(80) as Promise<{ data: any[] | null }>,
                (supabase as any)
                    .from("daily_loads")
                    .select("client_name")
                    .not("client_name", "is", null)
                    .order("created_at", { ascending: false })
                    .limit(100) as Promise<{ data: any[] | null }>,
            ]);

            if (addrRes.data) {
                const all = [
                    ...addrRes.data.map((d: any) => d.delivery_address),
                    ...addrRes.data.map((d: any) => d.pickup_address),
                ].filter(Boolean);
                setRecentAddresses([...new Set(all)]);
            }
            if (clientRes.data) {
                setClientSuggestions([...new Set(clientRes.data.map((d: any) => d.client_name).filter(Boolean))]);
            }
        };
        fetchRecent();
    }, []);

    // Re-apply prefill when clone data changes (e.g. user clones a load)
    useEffect(() => {
        if (prefill && Object.keys(prefill).length > 0) {
            setForm((prev) => ({
                ...prev,
                ...prefill,
                // Always generate a fresh ref # for clones
                reference_number: prefill.reference_number || generateReference(),
            }));
        }
    }, [prefill]);

    // Fetch client info when client changes
    useEffect(() => {
        if (!form.client_name || form.client_name.length < 2) {
            setClientInfo(null);
            return;
        }
        const timeout = setTimeout(async () => {
            try {
                // Join companies to find contacts by client name
                const { data: companyData } = await (supabase as any)
                    .from("companies")
                    .select("id, name, phone, address, city, state")
                    .ilike("name", `%${form.client_name}%`)
                    .limit(1) as { data: any[] | null };

                if (companyData && companyData.length > 0) {
                    const company = companyData[0];
                    const { data: contactData } = await (supabase as any)
                        .from("contacts")
                        .select("email, phone, first_name, last_name")
                        .eq("company_id", company.id)
                        .limit(1) as { data: any[] | null };

                    setClientInfo({
                        email: contactData?.[0]?.email ?? undefined,
                        phone: contactData?.[0]?.phone ?? company.phone ?? undefined,
                        address: [company.address, company.city, company.state].filter(Boolean).join(", ") || undefined,
                    });
                } else {
                    setClientInfo(null);
                }
            } catch {
                setClientInfo(null);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [form.client_name]);

    const updateField = <K extends keyof OrderFormData>(key: K, value: OrderFormData[K]) => {
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            // Auto-calculate total
            if (["base_rate", "per_mile_rate", "distance_miles", "fuel_surcharge", "additional_charges", "pricing_method"].includes(key as string)) {
                if (next.pricing_method === "distance") {
                    next.total_cost = Math.round(((next.per_mile_rate * next.distance_miles) + next.fuel_surcharge + next.additional_charges) * 100) / 100;
                } else {
                    next.total_cost = Math.round((next.base_rate + next.fuel_surcharge + next.additional_charges) * 100) / 100;
                }
            }
            return next;
        });
    };

    const toggleSection = (key: keyof typeof expandedSections) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        if (!user) return;
        if (!form.client_name && !form.delivery_address) {
            toast({ title: "Missing info", description: "Client name or delivery address is required.", variant: "destructive" });
            return;
        }

        setSaving(true);
        const today = loadDate ?? new Date().toISOString().split("T")[0];

        const payload: Record<string, any> = {
            load_date: today,
            reference_number: form.reference_number || null,
            client_name: form.client_name || null,
            pickup_address: form.pickup_address || null,
            delivery_address: form.delivery_address || null,
            requested_by: form.requested_by || null,
            packages: form.packages || 1,
            weight_lbs: form.weight_lbs || null,
            service_type: form.service_type,
            description: form.description || null,
            comments: [
                form.comments,
                form.purchase_order ? `PO: ${form.purchase_order}` : "",
                form.dim_length > 0 ? `Dims: ${form.dim_length}L × ${form.dim_width}W × ${form.dim_height}H` : "",
                form.vehicle_type !== "car" ? `Vehicle: ${VEHICLE_TYPES.find(v => v.value === form.vehicle_type)?.label}` : "",
                form.package_type !== "box" ? `Pkg Type: ${PACKAGE_TYPES.find(p => p.value === form.package_type)?.label}` : "",
            ].filter(Boolean).join(" | ") || null,
            po_number: form.purchase_order || null,
            start_time: form.pickup_time_from || null,
            end_time: form.delivery_time_to || null,
            hub: form.hub,
            revenue: form.total_cost || 0,
            miles: form.distance_miles || 0,
            deadhead_miles: 0,
            wait_time_minutes: 0,
            driver_pay: 0,
            fuel_cost: 0,
            detention_eligible: false,
            detention_billed: 0,
            shift: "day",
            status: selectedDriverId ? "assigned" : "pending",
            driver_id: selectedDriverId || null,
            created_by: user.id,
            dispatcher_id: user.id,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from("daily_loads").insert(payload);

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            setLoadCount((c) => c + 1);
            toast({
                title: `📦 Order ${form.reference_number} created!`,
                description: batchMode ? "Ready for next order" : "Added to load board",
            });

            if (batchMode) {
                setForm({
                    ...EMPTY_FORM,
                    hub: form.hub,
                    service_type: form.service_type,
                    reference_number: generateReference(),
                    pickup_date: form.pickup_date,
                    delivery_date: form.delivery_date,
                });
                setSelectedDriverId("");
                setTimeout(() => firstFieldRef.current?.focus(), 100);
            }

            onLoadCreated?.();
        }
        setSaving(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            handleSave();
        }
    };

    // ─── Section Header Component ──────────────────────

    const SectionHeader = ({ label, icon: Icon, sectionKey, color }:
        { label: string; icon: typeof Package; sectionKey: keyof typeof expandedSections; color: string }) => (
        <button
            onClick={() => toggleSection(sectionKey)}
            className="flex items-center gap-2 w-full text-left py-1.5 group"
        >
            <div className={`h-5 w-5 rounded flex items-center justify-center ${color}`}>
                <Icon className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider flex-1">{label}</span>
            {expandedSections[sectionKey] ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
            ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
            )}
        </button>
    );

    // ─── Field helper ──────────────────────────────

    const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
        <div className={className}>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">{label}</Label>
            {children}
        </div>
    );

    return (
        <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0" onKeyDown={handleKeyDown}>
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent border-b flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Plus className="h-4 w-4 text-primary" />
                        New Order Entry
                    </h3>
                    <div className="flex items-center gap-2">
                        {loadCount > 0 && (
                            <Badge className="bg-green-500/15 text-green-600 border-0 text-[10px]">
                                ✓ {loadCount} created
                            </Badge>
                        )}
                        <Button
                            variant={batchMode ? "default" : "outline"}
                            size="sm" className="h-6 text-[10px] gap-1"
                            onClick={() => setBatchMode(!batchMode)}
                        >
                            <Layers className="h-3 w-3" /> Batch {batchMode ? "ON" : "OFF"}
                        </Button>
                    </div>
                </div>

                <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">

                    {/* ═══ 1. CUSTOMER ═══ */}
                    <SectionHeader label="Customer" icon={Building2} sectionKey="customer" color="bg-blue-500" />
                    {expandedSections.customer && (
                        <div className="pl-7 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="Customer / Account">
                                    <Input
                                        ref={firstFieldRef}
                                        value={form.client_name}
                                        onChange={(e) => updateField("client_name", e.target.value)}
                                        className="h-8 text-xs"
                                        placeholder="Search or type client name..."
                                        list="client-list"
                                        autoComplete="off"
                                    />
                                    <datalist id="client-list">
                                        {clientSuggestions.map((s, i) => <option key={i} value={s} />)}
                                    </datalist>
                                </Field>
                                <Field label="Requested By">
                                    <Input
                                        value={form.requested_by}
                                        onChange={(e) => updateField("requested_by", e.target.value)}
                                        className="h-8 text-xs"
                                        placeholder="Person who placed order"
                                    />
                                </Field>
                            </div>

                            {/* Client info card */}
                            {clientInfo && (
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-xs">
                                    <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
                                    <div className="flex-1 min-w-0 flex flex-wrap gap-x-4 gap-y-0.5">
                                        {clientInfo.email && (
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                <Mail className="h-3 w-3" /> {clientInfo.email}
                                            </span>
                                        )}
                                        {clientInfo.phone && (
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                <Phone className="h-3 w-3" /> {clientInfo.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <Separator className="opacity-30" />

                    {/* ═══ 2. COLLECTION LOCATION ═══ */}
                    <SectionHeader label="Collection (Pickup)" icon={MapPin} sectionKey="collection" color="bg-green-500" />
                    {expandedSections.collection && (
                        <div className="pl-7 space-y-2">
                            <Field label="Pickup Address">
                                <Input
                                    value={form.pickup_address}
                                    onChange={(e) => updateField("pickup_address", e.target.value)}
                                    className="h-8 text-xs"
                                    placeholder="123 Main St, Phoenix, AZ 85001"
                                    list="addr-list"
                                />
                            </Field>
                            <div className="grid grid-cols-4 gap-2">
                                <Field label="Zone / Area">
                                    <Input
                                        value={form.pickup_zone}
                                        onChange={(e) => updateField("pickup_zone", e.target.value)}
                                        className="h-8 text-xs"
                                        placeholder="Zone"
                                    />
                                </Field>
                                <Field label="Date">
                                    <Input
                                        type="date"
                                        value={form.pickup_date}
                                        onChange={(e) => updateField("pickup_date", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </Field>
                                <Field label="From Time">
                                    <Input
                                        type="time"
                                        value={form.pickup_time_from}
                                        onChange={(e) => updateField("pickup_time_from", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </Field>
                                <Field label="To Time">
                                    <Input
                                        type="time"
                                        value={form.pickup_time_to}
                                        onChange={(e) => updateField("pickup_time_to", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </Field>
                            </div>
                        </div>
                    )}

                    <Separator className="opacity-30" />

                    {/* ═══ 3. DELIVERY LOCATION ═══ */}
                    <SectionHeader label="Delivery (Drop-off)" icon={MapPin} sectionKey="delivery" color="bg-orange-500" />
                    {expandedSections.delivery && (
                        <div className="pl-7 space-y-2">
                            <Field label="Delivery Address">
                                <Input
                                    value={form.delivery_address}
                                    onChange={(e) => updateField("delivery_address", e.target.value)}
                                    className="h-8 text-xs"
                                    placeholder="456 Oak Ave, Scottsdale, AZ 85251"
                                    list="addr-list"
                                />
                            </Field>
                            <div className="grid grid-cols-4 gap-2">
                                <Field label="Zone / Area">
                                    <Input
                                        value={form.delivery_zone}
                                        onChange={(e) => updateField("delivery_zone", e.target.value)}
                                        className="h-8 text-xs"
                                        placeholder="Zone"
                                    />
                                </Field>
                                <Field label="Date">
                                    <Input
                                        type="date"
                                        value={form.delivery_date}
                                        onChange={(e) => updateField("delivery_date", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </Field>
                                <Field label="From Time">
                                    <Input
                                        type="time"
                                        value={form.delivery_time_from}
                                        onChange={(e) => updateField("delivery_time_from", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </Field>
                                <Field label="To Time">
                                    <Input
                                        type="time"
                                        value={form.delivery_time_to}
                                        onChange={(e) => updateField("delivery_time_to", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </Field>
                            </div>
                            {/* Recipient info */}
                            <div className="grid grid-cols-3 gap-2">
                                <Field label="Recipient Name">
                                    <Input
                                        value={form.customer_name}
                                        onChange={(e) => updateField("customer_name", e.target.value)}
                                        className="h-8 text-xs"
                                        placeholder="John Doe"
                                    />
                                </Field>
                                <Field label="Recipient Phone">
                                    <Input
                                        value={form.customer_phone}
                                        onChange={(e) => updateField("customer_phone", e.target.value)}
                                        className="h-8 text-xs"
                                        placeholder="602-555-1234"
                                    />
                                </Field>
                                <Field label="Recipient Email">
                                    <Input
                                        value={form.customer_email}
                                        onChange={(e) => updateField("customer_email", e.target.value)}
                                        className="h-8 text-xs"
                                        placeholder="john@example.com"
                                    />
                                </Field>
                            </div>
                        </div>
                    )}

                    <datalist id="addr-list">
                        {recentAddresses.map((a, i) => <option key={i} value={a} />)}
                    </datalist>

                    <Separator className="opacity-30" />

                    {/* ═══ 4. PACKAGE DETAILS ═══ */}
                    <SectionHeader label="Details" icon={Box} sectionKey="details" color="bg-violet-500" />
                    {expandedSections.details && (
                        <div className="pl-7 space-y-2">
                            <Field label="Description / Instructions">
                                <Textarea
                                    value={form.description}
                                    onChange={(e) => updateField("description", e.target.value)}
                                    className="text-xs min-h-[36px] h-9 resize-none"
                                    placeholder="Fragile electronics, keep upright..."
                                />
                            </Field>
                            <div className="grid grid-cols-3 gap-2">
                                <Field label="Quantity / Pieces">
                                    <Input
                                        type="number"
                                        value={form.packages}
                                        onChange={(e) => updateField("packages", Number(e.target.value) || 1)}
                                        className="h-8 text-xs"
                                        min={1}
                                    />
                                </Field>
                                <Field label="Weight (lbs)">
                                    <Input
                                        type="number"
                                        value={form.weight_lbs || ""}
                                        onChange={(e) => updateField("weight_lbs", Number(e.target.value) || 0)}
                                        className="h-8 text-xs"
                                        placeholder="0"
                                    />
                                </Field>
                                <Field label="Distance (miles)">
                                    <Input
                                        type="number"
                                        value={form.distance_miles || ""}
                                        onChange={(e) => updateField("distance_miles", Number(e.target.value) || 0)}
                                        className="h-8 text-xs"
                                        placeholder="0"
                                    />
                                </Field>
                            </div>

                            {/* Dimensions */}
                            <div className="grid grid-cols-5 gap-2 items-end">
                                <Field label="Length" className="col-span-1">
                                    <Input
                                        type="number"
                                        value={form.dim_length || ""}
                                        onChange={(e) => updateField("dim_length", Number(e.target.value) || 0)}
                                        className="h-8 text-xs"
                                        placeholder="L"
                                    />
                                </Field>
                                <span className="text-xs text-muted-foreground text-center pb-2">×</span>
                                <Field label="Width" className="col-span-1">
                                    <Input
                                        type="number"
                                        value={form.dim_width || ""}
                                        onChange={(e) => updateField("dim_width", Number(e.target.value) || 0)}
                                        className="h-8 text-xs"
                                        placeholder="W"
                                    />
                                </Field>
                                <span className="text-xs text-muted-foreground text-center pb-2">×</span>
                                <Field label="Height" className="col-span-1">
                                    <Input
                                        type="number"
                                        value={form.dim_height || ""}
                                        onChange={(e) => updateField("dim_height", Number(e.target.value) || 0)}
                                        className="h-8 text-xs"
                                        placeholder="H"
                                    />
                                </Field>
                            </div>
                            {form.dim_length > 0 && form.dim_width > 0 && form.dim_height > 0 && (
                                <p className="text-[10px] text-muted-foreground pl-1">
                                    Cubic: {(form.dim_length * form.dim_width * form.dim_height).toLocaleString()} in³
                                    {form.weight_lbs > 0 && (
                                        <> · Dim weight: {Math.ceil((form.dim_length * form.dim_width * form.dim_height) / 139)} lbs</>
                                    )}
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <Field label="Package Type">
                                    <select
                                        value={form.package_type}
                                        onChange={(e) => updateField("package_type", e.target.value)}
                                        className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                                    >
                                        {PACKAGE_TYPES.map((p) => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Vehicle Type">
                                    <select
                                        value={form.vehicle_type}
                                        onChange={(e) => updateField("vehicle_type", e.target.value)}
                                        className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                                    >
                                        {VEHICLE_TYPES.map((v) => (
                                            <option key={v.value} value={v.value}>{v.label}</option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                        </div>
                    )}

                    <Separator className="opacity-30" />

                    {/* ═══ 5. SERVICE & PRICING ═══ */}
                    <SectionHeader label="Service & Pricing" icon={DollarSign} sectionKey="service" color="bg-emerald-500" />
                    {expandedSections.service && (
                        <div className="pl-7 space-y-2">
                            {/* Service type cards */}
                            <div className="grid grid-cols-3 gap-1.5">
                                {SERVICE_TYPES.map((s) => (
                                    <button
                                        key={s.value}
                                        onClick={() => updateField("service_type", s.value)}
                                        className={`text-left p-2 rounded-lg border text-xs transition-all ${form.service_type === s.value
                                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                            : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                                            }`}
                                    >
                                        <span className="text-sm">{s.icon}</span>
                                        <p className="font-medium mt-0.5 text-[10px] leading-tight">{s.label}</p>
                                    </button>
                                ))}
                            </div>

                            {/* Pricing */}
                            <div className="grid grid-cols-3 gap-2">
                                <Field label="Pricing Method">
                                    <select
                                        value={form.pricing_method}
                                        onChange={(e) => updateField("pricing_method", e.target.value)}
                                        className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                                    >
                                        {PRICING_METHODS.map((p) => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </Field>
                                {form.pricing_method === "flat" || form.pricing_method === "cost_plus" ? (
                                    <Field label="Base Rate ($)">
                                        <Input
                                            type="number"
                                            value={form.base_rate || ""}
                                            onChange={(e) => updateField("base_rate", Number(e.target.value) || 0)}
                                            className="h-8 text-xs"
                                            step="0.01"
                                            placeholder="0.00"
                                        />
                                    </Field>
                                ) : (
                                    <Field label="Per Mile Rate ($)">
                                        <Input
                                            type="number"
                                            value={form.per_mile_rate || ""}
                                            onChange={(e) => updateField("per_mile_rate", Number(e.target.value) || 0)}
                                            className="h-8 text-xs"
                                            step="0.01"
                                            placeholder="0.00"
                                        />
                                    </Field>
                                )}
                                <Field label="Fuel Surcharge ($)">
                                    <Input
                                        type="number"
                                        value={form.fuel_surcharge || ""}
                                        onChange={(e) => updateField("fuel_surcharge", Number(e.target.value) || 0)}
                                        className="h-8 text-xs"
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Field label="Additional Charges ($)">
                                    <Input
                                        type="number"
                                        value={form.additional_charges || ""}
                                        onChange={(e) => updateField("additional_charges", Number(e.target.value) || 0)}
                                        className="h-8 text-xs"
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </Field>
                                <div className="flex items-end">
                                    <div className="flex-1 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Total Cost</p>
                                        <p className="text-lg font-bold text-emerald-600">
                                            ${form.total_cost.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <Separator className="opacity-30" />

                    {/* ═══ 6. ASSIGNMENT ═══ */}
                    <SectionHeader label="Assignment" icon={Truck} sectionKey="assignment" color="bg-cyan-500" />
                    {expandedSections.assignment && (
                        <div className="pl-7 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                {drivers && drivers.length > 0 && (
                                    <Field label="Assign Driver">
                                        <select
                                            value={selectedDriverId}
                                            onChange={(e) => setSelectedDriverId(e.target.value)}
                                            className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                                        >
                                            <option value="">— Unassigned (Pending) —</option>
                                            {drivers.map((d) => (
                                                <option key={d.id} value={d.id}>{d.full_name}</option>
                                            ))}
                                        </select>
                                    </Field>
                                )}
                                <Field label="Hub / Branch">
                                    <select
                                        value={form.hub}
                                        onChange={(e) => updateField("hub", e.target.value)}
                                        className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                                    >
                                        <option value="phoenix">Phoenix</option>
                                        <option value="tucson">Tucson</option>
                                        <option value="flagstaff">Flagstaff</option>
                                        <option value="mesa">Mesa</option>
                                        <option value="scottsdale">Scottsdale</option>
                                        <option value="tempe">Tempe</option>
                                        <option value="chandler">Chandler</option>
                                    </select>
                                </Field>
                            </div>
                        </div>
                    )}

                    <Separator className="opacity-30" />

                    {/* ═══ 7. REFERENCE & NOTES ═══ */}
                    <SectionHeader label="Reference & Notes" icon={FileText} sectionKey="notes" color="bg-slate-500" />
                    {expandedSections.notes && (
                        <div className="pl-7 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="Reference #">
                                    <div className="flex gap-1">
                                        <Input
                                            value={form.reference_number}
                                            onChange={(e) => updateField("reference_number", e.target.value)}
                                            className="h-8 text-xs font-mono flex-1"
                                            placeholder="ANK-YYMMDD-XXXX"
                                        />
                                        <Button
                                            variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0"
                                            onClick={() => updateField("reference_number", generateReference())}
                                            title="Generate new #"
                                        >
                                            <RotateCw className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </Field>
                                <Field label="Purchase Order">
                                    <Input
                                        value={form.purchase_order}
                                        onChange={(e) => updateField("purchase_order", e.target.value)}
                                        className="h-8 text-xs"
                                        placeholder="PO-12345"
                                    />
                                </Field>
                            </div>
                            <Field label="Additional Notes">
                                <Textarea
                                    value={form.comments}
                                    onChange={(e) => updateField("comments", e.target.value)}
                                    className="text-xs min-h-[48px] resize-none"
                                    placeholder="Special instructions, gate codes, etc..."
                                />
                            </Field>
                        </div>
                    )}
                </div>

                {/* ═══ SUBMIT BAR ═══ */}
                <div className="px-4 py-3 border-t bg-muted/10 flex items-center gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2 h-10"
                    >
                        {saving ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Plus className="h-4 w-4" />
                                {batchMode ? "Submit & Next" : "Create Order"}
                            </>
                        )}
                    </Button>
                    <kbd className="text-[9px] px-2 py-1 rounded bg-muted border text-muted-foreground font-mono shrink-0">
                        Ctrl+↵
                    </kbd>
                </div>
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════
// CLONE HELPER — Generate prefill data from an existing load
// ═══════════════════════════════════════════════════════════

export function cloneLoadData(existingLoad: Record<string, any>): Partial<OrderFormData> {
    return {
        client_name: existingLoad.client_name ?? "",
        pickup_address: existingLoad.pickup_address ?? "",
        delivery_address: existingLoad.delivery_address ?? "",
        customer_name: existingLoad.customer_name ?? "",
        customer_phone: existingLoad.customer_phone ?? "",
        packages: existingLoad.packages ?? 1,
        service_type: existingLoad.service_type ?? "standard",
        comments: existingLoad.comments ?? "",
        hub: existingLoad.hub ?? "phoenix",
        total_cost: existingLoad.revenue ?? 0,
        base_rate: existingLoad.revenue ?? 0,
        distance_miles: existingLoad.miles ?? 0,
        weight_lbs: existingLoad.weight_lbs ?? 0,
        reference_number: generateReference(),
    };
}
