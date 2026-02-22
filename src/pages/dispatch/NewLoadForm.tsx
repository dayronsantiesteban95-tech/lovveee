import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { todayISO } from "@/lib/formatters";
import { sendPushToDrivers } from "@/lib/sendPushNotification";
import { geocodeAddress } from "@/utils/geocodeAddress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent,
} from "@/components/ui/dialog";
import {
    Plus, X, ChevronLeft, ChevronRight, DollarSign, Upload, FileText,
    CheckCircle, MapPin, Clock, Zap, ChevronDown,
} from "lucide-react";
import DriverPickerModal from "@/components/DriverPickerModal";
import type {
    Driver, Company, RateCard, AddLoadForm, CompanyContact, AnikaModifiers, AnikaBreakdown,
} from "./types";

// --------------------Anika Rate Calculator ==============================
const ANIKA_RATES = {
    cargo_van: { base: 105, perMile: 2.0, deadheadPerMile: 2.0, weightThreshold: 100, weightRate: 0.10 },
    box_truck:  { base: 170, perMile: 2.5, deadheadPerMile: 2.5, weightThreshold: 600, weightRate: 0.15 },
} as const;

type AnikaVehicle = keyof typeof ANIKA_RATES;

function calculateRate(
    vehicleType: string,
    miles: number,
    weightLbs: number,
    modifiers: AnikaModifiers,
): AnikaBreakdown {
    const vt = (vehicleType === "box_truck" ? "box_truck" : "cargo_van") as AnikaVehicle;
    const rates = ANIKA_RATES[vt];

    const baseRate = rates.base;
    const mileageCharge = miles > 20 ? (miles - 20) * rates.perMile : 0;
    const fuelSurcharge = (baseRate + mileageCharge) * 0.25;
    const subtotal = baseRate + mileageCharge + fuelSurcharge;

    const weightOver = Math.max(0, weightLbs - rates.weightThreshold);
    const weightSurcharge = weightOver * rates.weightRate;

    let modifiersTotal = 0;
    if (modifiers.afterHours)    modifiersTotal += 25;
    if (modifiers.weekend)       modifiersTotal += 25;
    if (modifiers.holiday)       modifiersTotal += 50;
    if (modifiers.tenderingFee)  modifiersTotal += 15;
    if (modifiers.attemptCharge) modifiersTotal += baseRate;
    modifiersTotal += modifiers.additionalStops * 50;
    modifiersTotal += modifiers.extraPieces * 15;
    if (modifiers.specialHandling) modifiersTotal += 20;
    if (modifiers.documents)       modifiersTotal += 20;
    modifiersTotal += modifiers.holding * 50;
    modifiersTotal += modifiers.waitTime * 30;
    if (modifiers.secondPerson) modifiersTotal += 100;
    if (modifiers.whiteGlove)   modifiersTotal += 50;
    if (modifiers.hazmat)       modifiersTotal += 50;

    const finalQuote = subtotal + weightSurcharge + modifiersTotal;

    return { baseRate, mileageCharge, fuelSurcharge, subtotal, weightSurcharge, modifiersTotal, finalQuote };
}

// ---------- Tracking Token Generator ----------
function generateTrackingToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = 'ANK-';
    for (let i = 0; i < 6; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

const EMPTY_ADD_FORM: AddLoadForm = {
    reference_number: "",
    consol_number: "",
    client_name: "",
    client_id: "",
    service_type: "AOG",
    revenue: "",
    sla_deadline: "",
    po_number: "",
    vehicle_type: "cargo_van",
    distance_miles: "",
    pickup_company: "",
    pickup_address: "",
    pickup_open_hours: "",
    pickup_contact_name: "",
    pickup_contact_phone: "",
    pickup_time_from: "",
    pickup_time_to: "",
    delivery_company: "",
    delivery_address: "",
    delivery_contact_name: "",
    delivery_contact_phone: "",
    packages: "1",
    package_type: "BOX",
    weight_kg: "",
    dim_l: "",
    dim_w: "",
    dim_h: "",
    dimensions_text: "",
    description: "",
    driver_id: "",
    bol_url: "",
    cutoff_time: "",
};

const EMPTY_ANIKA_MODIFIERS: AnikaModifiers = {
    afterHours: false, weekend: false, holiday: false, tenderingFee: false, attemptCharge: false,
    additionalStops: 0, extraPieces: 0, specialHandling: false, documents: false,
    holding: 0, waitTime: 0, secondPerson: false, whiteGlove: false, hazmat: false,
};

const AOG_SERVICE_TYPES = [
    { value: "AOG",      label: "AOG",      hub_key: "hotshot" },
    { value: "Courier",  label: "? Courier",   hub_key: "courier" },
    { value: "Standard", label: "Standard",  hub_key: "last_mile" },
];
const PKG_TYPES = ["PLT", "CTN", "BOX", "OTHER"];
const VEHICLE_TYPES_DISPATCH = [
    { value: "car_suv",    label: "Sedan / SUV" },
    { value: "cargo_van",  label: "Cargo Van" },
    { value: "sprinter",   label: "Sprinter Van" },
    { value: "box_truck",  label: "Box Truck" },
];

interface NewLoadFormProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    drivers: Driver[];
    companies: Company[];
    rateCards: RateCard[];
    recentAddresses: string[];
}

export default function NewLoadForm({
    open,
    onClose,
    onSuccess,
    drivers,
    companies,
    rateCards,
    recentAddresses,
}: NewLoadFormProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [addStep, setAddStep] = useState(1);
    const [addForm, setAddForm] = useState<AddLoadForm>(EMPTY_ADD_FORM);
    const [bolFile, setBolFile] = useState<File | null>(null);
    const [bolUploading, setBolUploading] = useState(false);
    const [suggestedDriverId, setSuggestedDriverId] = useState<string | null>(null);
    const [driverPickerOpen, setDriverPickerOpen] = useState(false);
    const [selectedDriverName, setSelectedDriverName] = useState<string>("");
    const bolInputRef = useRef<HTMLInputElement>(null);

    const [companyContacts, setCompanyContacts] = useState<CompanyContact[]>([]);
    const [clientSearch, setClientSearch] = useState("");
    const [pickupSearch, setPickupSearch] = useState("");
    const [deliverySearch, setDeliverySearch] = useState("");
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [showPickupDropdown, setShowPickupDropdown] = useState(false);
    const [showDeliveryDropdown, setShowDeliveryDropdown] = useState(false);

    const [showNewClient, setShowNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [newClientPhone, setNewClientPhone] = useState("");
    const [newClientAddress, setNewClientAddress] = useState("");
    const [newClientCity, setNewClientCity] = useState("");
    const [newClientState, setNewClientState] = useState("");
    const [savingNewClient, setSavingNewClient] = useState(false);

    const [computedRevenue, setComputedRevenue] = useState<number | null>(null);
    const [anikaModifiers, setAnikaModifiers] = useState<AnikaModifiers>(EMPTY_ANIKA_MODIFIERS);

    // Reset when dialog opens
    useEffect(() => {
        if (open) {
            setAddForm(EMPTY_ADD_FORM);
            setAddStep(1);
            setBolFile(null);
            setSuggestedDriverId(null);
            setDriverPickerOpen(false);
            setSelectedDriverName("");
            setClientSearch("");
            setPickupSearch("");
            setDeliverySearch("");
            setShowNewClient(false);
            setComputedRevenue(null);
            setCompanyContacts([]);
            setAnikaModifiers(EMPTY_ANIKA_MODIFIERS);
        }
    }, [open]);

    // AI driver suggestion
    const suggestDriver = useCallback((pickupAddress: string, driverList: Driver[]) => {
        if (!pickupAddress || driverList.length === 0) return;
        const addr = pickupAddress.toLowerCase();
        const cityHubMap: Record<string, string> = {
            phoenix: "phx", phx: "phx",
            tucson: "phx", tus: "phx",
            scottsdale: "phx", tempe: "phx", mesa: "phx",
            chandler: "phx", gilbert: "phx", peoria: "phx",
            flagstaff: "phx",
            los: "lax", angeles: "lax", "los angeles": "lax",
            atlanta: "atl", atl: "atl",
        };
        const matchedHub = Object.entries(cityHubMap).find(([city]) => addr.includes(city))?.[1];
        if (!matchedHub) return;
        const match = driverList.find((d) => d.hub === matchedHub && d.status === "active");
        if (match) setSuggestedDriverId(match.id);
    }, []);

    useEffect(() => {
        if (addForm.pickup_address && drivers.length > 0) {
            suggestDriver(addForm.pickup_address, drivers);
        }
    }, [addForm.pickup_address, drivers, suggestDriver]);

    // Fetch contacts when client changes
    useEffect(() => {
        if (!addForm.client_id) { setCompanyContacts([]); return; }
        supabase
            .from("contacts")
            .select("id, first_name, last_name, phone, email, job_title, company_id")
            .eq("company_id", addForm.client_id)
            .then(({ data }) => { if (data) setCompanyContacts(data as CompanyContact[]); });
    }, [addForm.client_id]);

    // Auto-compute revenue from rate card
    useEffect(() => {
        if (!rateCards.length) return;
        const svcMap: Record<string, string> = { AOG: "aog", Courier: "courier", Standard: "standard" };
        const rateKey = svcMap[addForm.service_type] ?? "standard";
        const dbHub = "PHX";
        const card = rateCards.find(
            (r) => r.hub === dbHub && r.service_type === rateKey && r.vehicle_type === addForm.vehicle_type,
        );
        if (!card) { setComputedRevenue(null); return; }
        const miles = parseFloat(addForm.distance_miles) || 0;
        const wKg = parseFloat(addForm.weight_kg) || 0;
        const wLbs = wKg * 2.205;
        const base = card.base_rate + miles * card.per_mile_rate + wLbs * card.per_lb_rate;
        const withFuel = base * (1 + card.fuel_surcharge_pct / 100);
        setComputedRevenue(Math.max(withFuel, card.min_charge));
    }, [addForm.service_type, addForm.vehicle_type, addForm.distance_miles, addForm.weight_kg, rateCards]);

    // Auto-update dimensions text
    useEffect(() => {
        const { dim_l, dim_w, dim_h } = addForm;
        if (dim_l && dim_w && dim_h) {
            setAddForm((f) => ({ ...f, dimensions_text: `${dim_l} x ${dim_w} x ${dim_h} CM` }));
        }
    }, [addForm.dim_l, addForm.dim_w, addForm.dim_h]);

    const setAf = (patch: Partial<AddLoadForm>) => setAddForm((f) => ({ ...f, ...patch }));

    const saveNewClient = async () => {
        if (!newClientName.trim() || !user) return;
        setSavingNewClient(true);
        const { data, error } = await supabase
            .from("companies")
            .insert({
                name: newClientName.trim(),
                phone: newClientPhone || null,
                address: newClientAddress || null,
                city: newClientCity || null,
                state: newClientState || null,
                created_by: user.id,
            })
            .select("id, name, address, city, state, phone")
            .single();
        setSavingNewClient(false);
        if (error) {
            toast({ title: "Failed to save client", description: error.message, variant: "destructive" });
        } else if (data) {
            queryClient.invalidateQueries({ queryKey: ["dispatch-companies"] });
            setAddForm((f) => ({ ...f, client_id: data.id, client_name: data.name }));
            setClientSearch(data.name);
            setShowNewClient(false);
            setNewClientName(""); setNewClientPhone(""); setNewClientAddress(""); setNewClientCity(""); setNewClientState("");
            toast({ title: "? Client saved", description: `${data.name} added to company database` });
        }
    };

    const uploadBol = async (file: File): Promise<string | null> => {
        setBolUploading(true);
        try {
            const ext = file.name.split(".").pop();
            const path = `bol/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
            if (error) throw error;
            const { data } = supabase.storage.from("documents").getPublicUrl(path);
            return data.publicUrl;
        } catch (err: any) {
            toast({ title: "BOL upload failed", description: err.message, variant: "destructive" });
            return null;
        } finally {
            setBolUploading(false);
        }
    };

    const handleAddLoad = async () => {
        if (!user) return;

        if (!addForm.reference_number.trim()) {
            toast({ title: "Reference number required", variant: "destructive" }); return;
        }
        if (!addForm.client_name.trim()) {
            toast({ title: "Client name required", variant: "destructive" }); return;
        }
        if (!addForm.driver_id) {
            toast({ title: "Driver assignment required", variant: "destructive" }); return;
        }
        if (!addForm.pickup_address.trim()) {
            toast({ title: "Pickup address required", variant: "destructive" }); return;
        }
        if (!addForm.delivery_address.trim()) {
            toast({ title: "Delivery address required", variant: "destructive" }); return;
        }
        if (addForm.cutoff_time && addForm.sla_deadline && addForm.cutoff_time > addForm.sla_deadline) {
            toast({ title: "Cutoff time cannot be after SLA deadline", variant: "destructive" }); return;
        }

        let bolUrl = addForm.bol_url || null;
        if (bolFile) {
            bolUrl = await uploadBol(bolFile);
        }

        const finalRevenue = addForm.revenue
            ? parseFloat(addForm.revenue)
            : (computedRevenue ?? 0);

        const trackingToken = generateTrackingToken();

        // Geocode addresses in parallel for geofence enforcement
        const [pickupCoords, deliveryCoords] = await Promise.all([
            addForm.pickup_address ? geocodeAddress(addForm.pickup_address) : null,
            addForm.delivery_address ? geocodeAddress(addForm.delivery_address) : null,
        ]);

        const payload: Record<string, any> = {
            load_date: todayISO(),
            reference_number: addForm.reference_number || null,
            tracking_token: trackingToken,
            consol_number: addForm.consol_number || null,
            client_name: addForm.client_name || null,
            service_type: addForm.service_type || "AOG",
            revenue: finalRevenue,
            sla_deadline: addForm.sla_deadline || null,
            cutoff_time: addForm.cutoff_time || null,
            po_number: addForm.po_number || null,
            vehicle_required: addForm.vehicle_type || null,
            pickup_company: addForm.pickup_company || null,
            pickup_address: addForm.pickup_address || null,
            pickup_lat: pickupCoords?.lat ?? null,
            pickup_lng: pickupCoords?.lng ?? null,
            pickup_open_hours: addForm.pickup_open_hours || null,
            pickup_contact_name: addForm.pickup_contact_name || null,
            pickup_contact_phone: addForm.pickup_contact_phone || null,
            collection_time: addForm.pickup_time_from || null,
            delivery_company: addForm.delivery_company || null,
            delivery_address: addForm.delivery_address || null,
            delivery_lat: deliveryCoords?.lat ?? null,
            delivery_lng: deliveryCoords?.lng ?? null,
            delivery_contact_name: addForm.delivery_contact_name || null,
            delivery_contact_phone: addForm.delivery_contact_phone || null,
            packages: parseInt(addForm.packages) || 1,
            package_type: addForm.package_type || "BOX",
            weight_kg: parseFloat(addForm.weight_kg) || null,
            dimensions_text: addForm.dimensions_text || null,
            description: addForm.description || null,
            driver_id: addForm.driver_id || null,
            miles: parseFloat(addForm.distance_miles) || 0,
            bol_url: bolUrl,
            status: "assigned",
            shift: "day",
            hub: "PHX",
            deadhead_miles: 0,
            wait_time_minutes: 0,
            driver_pay: 0,
            fuel_cost: 0,
            detention_eligible: false,
            detention_billed: 0,
            dispatcher_id: user.id,
            created_by: user.id,
            updated_at: new Date().toISOString(),
        };

        const { data: insertedLoad, error } = await supabase
            .from("daily_loads")
            .insert(payload)
            .select("id")
            .single();

        if (error) {
            toast({ title: "Failed to create load", description: error.message, variant: "destructive" });
        } else {
            // Log initial creation event in load_status_events
            if (insertedLoad?.id) {
                try {
                    await supabase.from("load_status_events").insert({
                        load_id: insertedLoad.id,
                        previous_status: null,
                        new_status: "assigned",
                        changed_by: user.id,
                        created_at: new Date().toISOString(),
                    });
                } catch (evtErr) {
                    console.warn("[NewLoadForm] Failed to log initial status event:", evtErr);
                    // Non-fatal: load was created successfully
                }
            }

            // Notify the assigned driver via push + in-app notification
            if (insertedLoad?.id && addForm.driver_id) {
                try {
                    await sendPushToDrivers(
                        [addForm.driver_id],
                        'New Load Assigned',
                        `${addForm.reference_number ?? 'Load'} - ${addForm.client_name ?? 'Unknown'} | ${addForm.pickup_address ?? ''} -> ${addForm.delivery_address ?? ''}`,
                        { load_id: insertedLoad.id, type: 'load_assigned' }
                    );
                } catch (pushErr) {
                    console.warn("[NewLoadForm] Push notification to driver failed:", pushErr);
                }
            }

            toast({ title: "? Load created!", description: `${addForm.reference_number} added to the board` });
            onClose();
            onSuccess();
        }
    };

    const af = addForm;

    // Filtered company list for client search
    const filteredCompanies = clientSearch.length >= 1
        ? companies.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8)
        : companies.slice(0, 6);

    // Address suggestions
    const companyAddresses = companies
        .filter((c) => c.address)
        .map((c) => ({ label: c.name, addr: [c.address, c.city, c.state].filter(Boolean).join(", "), id: c.id }));

    const pickupSuggestions = pickupSearch.length >= 1
        ? companyAddresses.filter((ca) =>
            ca.label.toLowerCase().includes(pickupSearch.toLowerCase()) ||
            ca.addr.toLowerCase().includes(pickupSearch.toLowerCase())
        ).slice(0, 6)
        : companyAddresses.slice(0, 3);

    const deliverySuggestions = deliverySearch.length >= 1
        ? companyAddresses.filter((ca) =>
            ca.label.toLowerCase().includes(deliverySearch.toLowerCase()) ||
            ca.addr.toLowerCase().includes(deliverySearch.toLowerCase())
        ).slice(0, 6)
        : companyAddresses.slice(0, 3);

    // Cubic volume
    const l = parseFloat(af.dim_l) || 0;
    const w = parseFloat(af.dim_w) || 0;
    const h = parseFloat(af.dim_h) || 0;
    const cubic = l * w * h;

    // Step progress
    const STEPS = ["Load Info", "Pickup & Delivery", "Cargo & Driver"];
    const canGoNext1 = af.reference_number.trim() && af.client_name.trim();
    const canGoNext2 = af.pickup_address.trim() && af.delivery_address.trim();
    const canSubmit = canGoNext1 && canGoNext2 && af.driver_id;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0">
                    <div>
                        <h2 className="text-lg font-bold tracking-tight">New Load</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">AOG / Courier Dispatch</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-0 px-6 py-3 border-b shrink-0 bg-muted/20">
                    {STEPS.map((label, i) => {
                        const step = i + 1;
                        const active = addStep === step;
                        const done = addStep > step;
                        return (
                            <div key={step} className="flex items-center gap-0 flex-1">
                                <button
                                    className="flex items-center gap-2 group"
                                    onClick={() => { if (done || (step === 2 && canGoNext1) || (step === 3 && canGoNext1 && canGoNext2)) setAddStep(step); }}
                                >
                                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                        done ? "bg-green-500 text-white" :
                                        active ? "bg-primary text-primary-foreground" :
                                        "bg-muted text-muted-foreground"
                                    }`}>
                                        {done ? "v" : step}
                                    </div>
                                    <span className={`text-xs font-medium hidden sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                                </button>
                                {i < STEPS.length - 1 && (
                                    <div className={`h-px flex-1 mx-3 ${done ? "bg-green-500" : "bg-border"}`} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Form body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* --- STEP 1: LOAD INFO --- */}
                    {addStep === 1 && (
                        <div className="space-y-5">
                            {/* Reference & Consol */}
                            <div>
                                <p className="form-section-label">?? Load Reference</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs">Reference Number <span className="text-red-500">*</span></Label>
                                        <Input value={af.reference_number} onChange={(e) => setAf({ reference_number: e.target.value })} placeholder="S01480980" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Consol / Manifest #</Label>
                                        <Input value={af.consol_number} onChange={(e) => setAf({ consol_number: e.target.value })} placeholder="Optional" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Purchase Order #</Label>
                                        <Input value={af.po_number} onChange={(e) => setAf({ po_number: e.target.value })} placeholder="PO-12345" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label className="text-xs">SLA Deadline <span className="text-red-500">*</span></Label>
                                        <Input type="datetime-local" value={af.sla_deadline} onChange={(e) => setAf({ sla_deadline: e.target.value })} className="mt-1" />
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="text-xs">Cutoff Time (optional)</Label>
                                        <Input type="datetime-local" value={af.cutoff_time} onChange={(e) => setAf({ cutoff_time: e.target.value })} className="mt-1" />
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Airline cutoff -- maximum delivery time before flight is missed</p>
                                    </div>
                                </div>
                            </div>

                            {/* Client */}
                            <div>
                                <p className="form-section-label">?? Client</p>
                                <div className="relative">
                                    <Label className="text-xs">Client / Account <span className="text-red-500">*</span></Label>
                                    <div className="relative mt-1">
                                        <Input
                                            value={clientSearch}
                                            onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); setAf({ client_name: e.target.value, client_id: "" }); }}
                                            onFocus={() => setShowClientDropdown(true)}
                                            placeholder="Search companies..."
                                            className="pr-8"
                                        />
                                        {clientSearch && (
                                            <button className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                                                onClick={() => { setClientSearch(""); setAf({ client_name: "", client_id: "" }); setShowClientDropdown(false); }}>
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {showClientDropdown && (
                                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
                                            <div className="max-h-52 overflow-y-auto">
                                                {filteredCompanies.map((c) => (
                                                    <button key={c.id} className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-start gap-3 border-b border-border/50 last:border-0"
                                                        onClick={() => {
                                                            setAf({ client_id: c.id, client_name: c.name });
                                                            setClientSearch(c.name);
                                                            setShowClientDropdown(false);
                                                        }}>
                                                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                                            <span className="text-xs font-bold text-primary">{c.name[0]}</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate">{c.name}</p>
                                                            {(c.city || c.address) && (
                                                                <p className="text-xs text-muted-foreground truncate">{[c.city, c.state].filter(Boolean).join(", ") || c.address}</p>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                            {/* + New Client */}
                                            <button className="w-full text-left px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/5 flex items-center gap-2 border-t"
                                                onClick={() => { setShowNewClient(true); setShowClientDropdown(false); }}>
                                                <Plus className="h-3.5 w-3.5" /> New Client
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Selected client chip */}
                                {af.client_id && (
                                    <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                        <span className="text-sm font-medium flex-1">{af.client_name}</span>
                                        {companyContacts.length > 0 && (
                                            <Badge variant="secondary" className="text-[10px]">{companyContacts.length} contact{companyContacts.length > 1 ? "s" : ""}</Badge>
                                        )}
                                    </div>
                                )}

                                {/* New client inline form */}
                                {showNewClient && (
                                    <div className="mt-3 p-4 border rounded-xl bg-muted/20 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Client</p>
                                            <button onClick={() => setShowNewClient(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="col-span-2">
                                                <Label className="text-xs">Company Name *</Label>
                                                <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="UNICAL AVIATION" className="mt-1 h-8 text-sm" />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Phone</Label>
                                                <Input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="602-555-0100" className="mt-1 h-8 text-sm" />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Address</Label>
                                                <Input value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} placeholder="123 Airport Blvd" className="mt-1 h-8 text-sm" />
                                            </div>
                                            <div>
                                                <Label className="text-xs">City</Label>
                                                <Input value={newClientCity} onChange={(e) => setNewClientCity(e.target.value)} placeholder="Phoenix" className="mt-1 h-8 text-sm" />
                                            </div>
                                            <div>
                                                <Label className="text-xs">State</Label>
                                                <Input value={newClientState} onChange={(e) => setNewClientState(e.target.value)} placeholder="AZ" className="mt-1 h-8 text-sm" />
                                            </div>
                                        </div>
                                        <Button size="sm" className="w-full" onClick={saveNewClient} disabled={savingNewClient || !newClientName.trim()}>
                                            {savingNewClient ? "Saving..." : "Save Client"}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Service type */}
                            <div>
                                <p className="form-section-label">? Service</p>
                                <div className="grid grid-cols-3 gap-2 mt-1">
                                    {AOG_SERVICE_TYPES.map((s) => (
                                        <button key={s.value} type="button"
                                            onClick={() => setAf({ service_type: s.value })}
                                            className={`p-3 rounded-xl border text-left transition-all ${af.service_type === s.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"}`}>
                                            <p className="text-sm font-semibold">{s.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Vehicle & Distance */}
                            <div>
                                <p className="form-section-label">?? Vehicle & Distance</p>
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    <div>
                                        <Label className="text-xs">Vehicle Type</Label>
                                        <Select value={af.vehicle_type} onValueChange={(v) => setAf({ vehicle_type: v })}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>{VEHICLE_TYPES_DISPATCH.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Distance (miles)</Label>
                                        <Input type="number" step="0.1" value={af.distance_miles} onChange={(e) => setAf({ distance_miles: e.target.value })} placeholder="31" className="mt-1" />
                                    </div>
                                </div>
                            </div>

                            {/* == Anika Live Rate Card == */}
                            {(() => {
                                const miles = parseFloat(af.distance_miles) || 0;
                                const wKg = parseFloat(af.weight_kg) || 0;
                                const wLbs = wKg * 2.205;
                                const vt = af.vehicle_type;
                                const showCard = vt === "cargo_van" || vt === "box_truck";
                                if (!showCard) return null;
                                const bd = calculateRate(vt, miles, wLbs, anikaModifiers);
                                return (
                                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                                <DollarSign className="h-3.5 w-3.5" /> Live Rate Estimate
                                            </p>
                                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0 text-[10px]">Anika Rate Sheet</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex justify-between items-center py-1.5 px-2 rounded-lg bg-background/60">
                                                <span className="text-muted-foreground">Base Rate</span>
                                                <span className="font-mono font-semibold">${bd.baseRate.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-1.5 px-2 rounded-lg bg-background/60">
                                                <span className="text-muted-foreground">Mileage Charge</span>
                                                <span className="font-mono font-semibold">${bd.mileageCharge.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-1.5 px-2 rounded-lg bg-background/60">
                                                <span className="text-muted-foreground">Fuel Surcharge (25%)</span>
                                                <span className="font-mono font-semibold">${bd.fuelSurcharge.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-1.5 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Subtotal</span>
                                                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">${bd.subtotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        {miles === 0 && (
                                            <p className="text-[10px] text-muted-foreground text-center">Enter distance above to see mileage charge</p>
                                        )}
                                        <Button size="sm" className="w-full h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={() => setAf({ revenue: bd.subtotal.toFixed(2) })}>
                                            <DollarSign className="h-3.5 w-3.5" /> Use this rate: ${bd.subtotal.toFixed(2)}
                                        </Button>
                                    </div>
                                );
                            })()}

                            {/* Revenue */}
                            <div>
                                <p className="form-section-label">?? Revenue</p>
                                <div className="mt-1">
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                                        <Input type="number" step="0.01" value={af.revenue}
                                            onChange={(e) => setAf({ revenue: e.target.value })}
                                            placeholder={computedRevenue ? computedRevenue.toFixed(2) : "0.00"}
                                            className="pl-7" />
                                    </div>
                                    {computedRevenue !== null && !af.revenue && (
                                        <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                                    Rate card estimate: <strong>${computedRevenue.toFixed(2)}</strong>
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">{af.service_type} ? {VEHICLE_TYPES_DISPATCH.find(v => v.value === af.vehicle_type)?.label} ? {af.distance_miles || 0} mi</p>
                                            </div>
                                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                                                onClick={() => setAf({ revenue: computedRevenue.toFixed(2) })}>
                                                Use
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- STEP 2: PICKUP & DELIVERY --- */}
                    {addStep === 2 && (
                        <div className="space-y-5">
                            {/* PICKUP */}
                            <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5">
                                <p className="form-section-label text-green-700 dark:text-green-400">?? Pickup Location</p>

                                <div className="relative mt-2">
                                    <Label className="text-xs">Company / Facility *</Label>
                                    <div className="relative mt-1">
                                        <Input value={pickupSearch}
                                            onChange={(e) => { setPickupSearch(e.target.value); setShowPickupDropdown(true); setAf({ pickup_company: e.target.value }); }}
                                            onFocus={() => setShowPickupDropdown(true)}
                                            placeholder="Search or enter company name..."
                                        />
                                    </div>
                                    {showPickupDropdown && (pickupSuggestions.length > 0 || recentAddresses.length > 0) && (
                                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
                                            <div className="max-h-44 overflow-y-auto">
                                                {recentAddresses.slice(0, 3).map((addr, i) => (
                                                    <button key={`r${i}`} className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 text-xs border-b border-border/40"
                                                        onClick={() => { setPickupSearch(addr); setAf({ pickup_address: addr }); setShowPickupDropdown(false); }}>
                                                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                                        <span className="truncate text-muted-foreground">{addr}</span>
                                                    </button>
                                                ))}
                                                {pickupSuggestions.map((s) => (
                                                    <button key={s.id} className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-start gap-2 border-b border-border/40 last:border-0"
                                                        onClick={() => {
                                                            setPickupSearch(s.label);
                                                            setAf({
                                                                pickup_company: s.label,
                                                                pickup_address: s.addr,
                                                                pickup_contact_name: companyContacts.find(c => c.company_id === s.id) ? `${companyContacts.find(c => c.company_id === s.id)!.first_name} ${companyContacts.find(c => c.company_id === s.id)!.last_name}` : af.pickup_contact_name,
                                                                pickup_contact_phone: companyContacts.find(c => c.company_id === s.id)?.phone ?? af.pickup_contact_phone,
                                                            });
                                                            setShowPickupDropdown(false);
                                                        }}>
                                                        <MapPin className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-medium">{s.label}</p>
                                                            <p className="text-xs text-muted-foreground">{s.addr}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-3 mt-3">
                                    <div>
                                        <Label className="text-xs">Street Address *</Label>
                                        <Input value={af.pickup_address} onChange={(e) => setAf({ pickup_address: e.target.value })} placeholder="123 Airport Cargo Rd, Phoenix, AZ 85034" className="mt-1" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs">Open Hours</Label>
                                            <Input value={af.pickup_open_hours} onChange={(e) => setAf({ pickup_open_hours: e.target.value })} placeholder="09:00--17:00 Mon--Fri" className="mt-1" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <Label className="text-xs">Arrival From</Label>
                                                <Input type="time" value={af.pickup_time_from} onChange={(e) => setAf({ pickup_time_from: e.target.value })} className="mt-1" />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Arrival To</Label>
                                                <Input type="time" value={af.pickup_time_to} onChange={(e) => setAf({ pickup_time_to: e.target.value })} className="mt-1" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs">Contact Name</Label>
                                            <Input value={af.pickup_contact_name} onChange={(e) => setAf({ pickup_contact_name: e.target.value })} placeholder="Jane Smith" className="mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Contact Phone</Label>
                                            <Input value={af.pickup_contact_phone} onChange={(e) => setAf({ pickup_contact_phone: e.target.value })} placeholder="602-555-0100" className="mt-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* DELIVERY */}
                            <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5">
                                <p className="form-section-label text-orange-700 dark:text-orange-400">?? Delivery Location</p>

                                <div className="relative mt-2">
                                    <Label className="text-xs">Company / Facility *</Label>
                                    <div className="relative mt-1">
                                        <Input value={deliverySearch}
                                            onChange={(e) => { setDeliverySearch(e.target.value); setShowDeliveryDropdown(true); setAf({ delivery_company: e.target.value }); }}
                                            onFocus={() => setShowDeliveryDropdown(true)}
                                            placeholder="Search or enter company name..."
                                        />
                                    </div>
                                    {showDeliveryDropdown && (deliverySuggestions.length > 0 || recentAddresses.length > 0) && (
                                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
                                            <div className="max-h-44 overflow-y-auto">
                                                {recentAddresses.slice(0, 3).map((addr, i) => (
                                                    <button key={`r${i}`} className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 text-xs border-b border-border/40"
                                                        onClick={() => { setDeliverySearch(addr); setAf({ delivery_address: addr }); setShowDeliveryDropdown(false); }}>
                                                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                                        <span className="truncate text-muted-foreground">{addr}</span>
                                                    </button>
                                                ))}
                                                {deliverySuggestions.map((s) => (
                                                    <button key={s.id} className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-start gap-2 border-b border-border/40 last:border-0"
                                                        onClick={() => {
                                                            setDeliverySearch(s.label);
                                                            setAf({
                                                                delivery_company: s.label,
                                                                delivery_address: s.addr,
                                                                delivery_contact_name: companyContacts.find(c => c.company_id === s.id) ? `${companyContacts.find(c => c.company_id === s.id)!.first_name} ${companyContacts.find(c => c.company_id === s.id)!.last_name}` : af.delivery_contact_name,
                                                                delivery_contact_phone: companyContacts.find(c => c.company_id === s.id)?.phone ?? af.delivery_contact_phone,
                                                            });
                                                            setShowDeliveryDropdown(false);
                                                        }}>
                                                        <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-medium">{s.label}</p>
                                                            <p className="text-xs text-muted-foreground">{s.addr}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-3 mt-3">
                                    <div>
                                        <Label className="text-xs">Street Address *</Label>
                                        <Input value={af.delivery_address} onChange={(e) => setAf({ delivery_address: e.target.value })} placeholder="456 Cargo Way, Scottsdale, AZ 85257" className="mt-1" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs">Contact Name</Label>
                                            <Input value={af.delivery_contact_name} onChange={(e) => setAf({ delivery_contact_name: e.target.value })} placeholder="John Doe" className="mt-1" />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Contact Phone</Label>
                                            <Input value={af.delivery_contact_phone} onChange={(e) => setAf({ delivery_contact_phone: e.target.value })} placeholder="480-555-0200" className="mt-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- STEP 3: CARGO & DRIVER --- */}
                    {addStep === 3 && (
                        <div className="space-y-5">
                            {/* Cargo */}
                            <div>
                                <p className="form-section-label">?? Cargo Details</p>
                                <div className="grid grid-cols-3 gap-3 mt-1">
                                    <div>
                                        <Label className="text-xs">Packages *</Label>
                                        <Input type="number" min="1" value={af.packages} onChange={(e) => setAf({ packages: e.target.value })} className="mt-1" />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Package Type</Label>
                                        <Select value={af.package_type} onValueChange={(v) => setAf({ package_type: v })}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>{PKG_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Weight (kg) *</Label>
                                        <Input type="number" step="0.1" value={af.weight_kg} onChange={(e) => setAf({ weight_kg: e.target.value })} placeholder="0.0" className="mt-1" />
                                    </div>
                                </div>

                                {/* Dimensions */}
                                <div className="mt-3">
                                    <Label className="text-xs">Dimensions (CM)</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Input type="number" value={af.dim_l} onChange={(e) => setAf({ dim_l: e.target.value })} placeholder="L" className="text-center" />
                                        <span className="text-muted-foreground text-sm font-medium shrink-0">-</span>
                                        <Input type="number" value={af.dim_w} onChange={(e) => setAf({ dim_w: e.target.value })} placeholder="W" className="text-center" />
                                        <span className="text-muted-foreground text-sm font-medium shrink-0">-</span>
                                        <Input type="number" value={af.dim_h} onChange={(e) => setAf({ dim_h: e.target.value })} placeholder="H" className="text-center" />
                                    </div>
                                    {cubic > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1.5">
                                            Cubic: <strong>{cubic.toLocaleString()} cm?</strong>
                                            {af.weight_kg && <> ? Dim wt: <strong>{(cubic / 5000).toFixed(1)} kg</strong></>}
                                            {af.dimensions_text && <> ? <span className="font-mono">{af.dimensions_text}</span></>}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-3">
                                    <Label className="text-xs">Cargo Description</Label>
                                    <Input value={af.description} onChange={(e) => setAf({ description: e.target.value })} placeholder="e.g. CIVIL AIRCRAFT PART -- LH ENGINE SEAL" className="mt-1" />
                                </div>
                            </div>

                            {/* == Anika Price Modifiers == */}
                            {(af.vehicle_type === "cargo_van" || af.vehicle_type === "box_truck") && (() => {
                                const miles = parseFloat(af.distance_miles) || 0;
                                const wKg = parseFloat(af.weight_kg) || 0;
                                const wLbs = wKg * 2.205;
                                const bd = calculateRate(af.vehicle_type, miles, wLbs, anikaModifiers);
                                const setMod = (patch: Partial<AnikaModifiers>) =>
                                    setAnikaModifiers((m) => ({ ...m, ...patch }));
                                return (
                                    <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-4">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                                            <DollarSign className="h-3.5 w-3.5" /> Price Modifiers
                                        </p>

                                        {/* Time & Access */}
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">? Time &amp; Access</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {[
                                                    { key: "afterHours" as const, label: "After Hours (20:00--07:59)", price: 25 },
                                                    { key: "weekend" as const, label: "Weekend (Sat & Sun)", price: 25 },
                                                    { key: "holiday" as const, label: "Holiday", price: 50 },
                                                    { key: "tenderingFee" as const, label: "Tendering Fee (airport)", price: 15 },
                                                    { key: "attemptCharge" as const, label: "Attempt Charge", price: bd.baseRate },
                                                ].map(({ key, label, price }) => (
                                                    <div key={key} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/60">
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox id={`mod-${key}`} checked={anikaModifiers[key] as boolean}
                                                                onCheckedChange={(v) => setMod({ [key]: !!v })} />
                                                            <Label htmlFor={`mod-${key}`} className="text-xs cursor-pointer leading-tight">{label}</Label>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px] shrink-0">+${price.toFixed(2)}</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Additional Stops counter */}
                                            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/60">
                                                <Label className="text-xs">Additional Stops (+$50 each)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Button type="button" variant="outline" size="icon" className="h-6 w-6"
                                                        onClick={() => setMod({ additionalStops: Math.max(0, anikaModifiers.additionalStops - 1) })}>?</Button>
                                                    <span className="text-sm font-mono w-5 text-center">{anikaModifiers.additionalStops}</span>
                                                    <Button type="button" variant="outline" size="icon" className="h-6 w-6"
                                                        onClick={() => setMod({ additionalStops: anikaModifiers.additionalStops + 1 })}>+</Button>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Accessorial Services */}
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">?? Accessorial Services</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {[
                                                    { key: "specialHandling" as const, label: "Special Handling", price: 20 },
                                                    { key: "documents" as const, label: "Documents", price: 20 },
                                                    { key: "secondPerson" as const, label: "2nd Person Ride Along", price: 100 },
                                                    { key: "whiteGlove" as const, label: "White Glove Service", price: 50 },
                                                    { key: "hazmat" as const, label: "Dangerous Goods / Hazmat", price: 50 },
                                                ].map(({ key, label, price }) => (
                                                    <div key={key} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/60">
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox id={`mod-${key}`} checked={anikaModifiers[key] as boolean}
                                                                onCheckedChange={(v) => setMod({ [key]: !!v })} />
                                                            <Label htmlFor={`mod-${key}`} className="text-xs cursor-pointer leading-tight">{label}</Label>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px] shrink-0">+${price}</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Counter modifiers */}
                                            {[
                                                { key: "extraPieces" as const, label: "Extra Pieces (+$15 each)", unit: 15 },
                                                { key: "holding" as const, label: "Holding per day (+$50 each)", unit: 50 },
                                                { key: "waitTime" as const, label: "Wait Time per 15 min (+$30 each, first free)", unit: 30 },
                                            ].map(({ key, label }) => (
                                                <div key={key} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/60">
                                                    <Label className="text-xs">{label}</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button type="button" variant="outline" size="icon" className="h-6 w-6"
                                                            onClick={() => setMod({ [key]: Math.max(0, (anikaModifiers[key] as number) - 1) })}>?</Button>
                                                        <span className="text-sm font-mono w-5 text-center">{anikaModifiers[key] as number}</span>
                                                        <Button type="button" variant="outline" size="icon" className="h-6 w-6"
                                                            onClick={() => setMod({ [key]: (anikaModifiers[key] as number) + 1 })}>+</Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <Separator />

                                        {/* Final Quote display */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Base Quote (subtotal)</span>
                                                <span className="font-mono">${bd.subtotal.toFixed(2)}</span>
                                            </div>
                                            {bd.weightSurcharge > 0 && (
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Weight Surcharge</span>
                                                    <span className="font-mono">+${bd.weightSurcharge.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {bd.modifiersTotal > 0 && (
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Modifiers</span>
                                                    <span className="font-mono">+${bd.modifiersTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mt-2">
                                                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Final Quote</span>
                                                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">${bd.finalQuote.toFixed(2)}</span>
                                            </div>
                                            <Button size="sm" className="w-full h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white mt-1"
                                                onClick={() => setAf({ revenue: bd.finalQuote.toFixed(2) })}>
                                                <DollarSign className="h-3.5 w-3.5" /> Apply to Revenue: ${bd.finalQuote.toFixed(2)}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Driver Assignment */}
                            <div>
                                <p className="form-section-label">?? Driver Assignment <span className="text-red-500">*</span></p>
                                <div className="space-y-2 mt-1">
                                    {drivers.length === 0 && (
                                        <p className="text-sm text-muted-foreground">No active drivers found.</p>
                                    )}
                                    {drivers.map((d) => {
                                        const isSelected = af.driver_id === d.id;
                                        const isSuggested = suggestedDriverId === d.id;
                                        return (
                                            <button key={d.id} type="button"
                                                onClick={() => setAf({ driver_id: d.id })}
                                                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                                                    isSelected
                                                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                                        : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                                                }`}>
                                                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                                    {d.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium">{d.full_name}</p>
                                                        {isSuggested && (
                                                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 text-[10px] gap-1 px-1.5">
                                                                <Zap className="h-2.5 w-2.5" /> AI Suggested
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground capitalize">{d.hub} hub ? {d.status}</p>
                                                </div>
                                                {isSelected && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                                {suggestedDriverId && !af.driver_id && (
                                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                        <Zap className="h-3 w-3" /> AI matched a driver based on pickup location. Review and confirm above.
                                    </p>
                                )}
                            </div>

                            {/* BOL Upload */}
                            <div>
                                <p className="form-section-label">?? BOL Document</p>
                                <div className="mt-1">
                                    <input ref={bolInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setBolFile(f); }} />
                                    {!bolFile ? (
                                        <button type="button" onClick={() => bolInputRef.current?.click()}
                                            className="w-full p-4 border-2 border-dashed border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center gap-2 text-muted-foreground">
                                            <Upload className="h-5 w-5" />
                                            <p className="text-sm">Click to upload BOL (PDF / image)</p>
                                            <p className="text-xs">Optional -- can be added later</p>
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20">
                                            <FileText className="h-5 w-5 text-primary shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{bolFile.name}</p>
                                                <p className="text-xs text-muted-foreground">{(bolFile.size / 1024).toFixed(0)} KB</p>
                                            </div>
                                            {bolUploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>}
                                            <button onClick={() => { setBolFile(null); setAf({ bol_url: "" }); }}>
                                                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="p-4 rounded-xl bg-muted/30 border space-y-2 text-sm">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Summary</p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                                    <span className="text-muted-foreground">Ref #</span><span className="font-mono font-medium">{af.reference_number || "--"}</span>
                                    <span className="text-muted-foreground">Client</span><span className="font-medium truncate">{af.client_name || "--"}</span>
                                    <span className="text-muted-foreground">Service</span><span>{af.service_type}</span>
                                    <span className="text-muted-foreground">Revenue</span>
                                    <span className="font-semibold text-green-600">
                                        ${af.revenue ? parseFloat(af.revenue).toFixed(2) : computedRevenue ? computedRevenue.toFixed(2) : "0.00"}
                                    </span>
                                    <span className="text-muted-foreground">Pickup</span><span className="truncate">{af.pickup_company || af.pickup_address || "--"}</span>
                                    <span className="text-muted-foreground">Delivery</span><span className="truncate">{af.delivery_company || af.delivery_address || "--"}</span>
                                    <span className="text-muted-foreground">Driver</span><span>{drivers.find(d => d.id === af.driver_id)?.full_name || <span className="text-red-500">Not assigned</span>}</span>
                                    <span className="text-muted-foreground">BOL</span><span>{bolFile ? bolFile.name : "--"}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer nav */}
                <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5"
                        onClick={() => addStep > 1 ? setAddStep(addStep - 1) : onClose()}>
                        <ChevronLeft className="h-4 w-4" />
                        {addStep > 1 ? "Back" : "Cancel"}
                    </Button>

                    <div className="flex items-center gap-2">
                        {addStep < 3 ? (
                            <Button className="btn-gradient gap-1.5"
                                disabled={addStep === 1 ? !canGoNext1 : !canGoNext2}
                                onClick={() => setAddStep(addStep + 1)}>
                                Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button className="btn-gradient gap-1.5" disabled={!canSubmit || bolUploading} onClick={handleAddLoad}>
                                {bolUploading ? "Uploading..." : <><Plus className="h-4 w-4" /> Create Load</>}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
