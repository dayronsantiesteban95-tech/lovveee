// ═══════════════════════════════════════════════════════════
// DISPATCH TRACKER — Daily Load Tracking & Analytics
// Tab 1: Load Board   — CRUD (full OnTime 360 parity)
// Tab 2: Live Ops     — Real-time GPS feed
// Tab 3: Wait Time    — Analytics & detention tracking
// Tab 4: Daily Report — Operations summary / export
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { fmtMoney, fmtWait, todayISO, daysAgoISO } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { sendPushToDrivers } from "@/lib/sendPushNotification";
import { CITY_HUBS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessageCounts } from "@/hooks/useMessages";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Truck, Clock, DollarSign, Plus, Pencil, Trash2, MapPin,
    AlertTriangle, CheckCircle, BarChart3, FileText, Copy, Timer, Package,
    Navigation, Download, History, Zap, PanelRightClose, PanelRightOpen, Layers, Radio,
    ChevronRight, Gauge, Shield, Upload, X, ChevronLeft,
    MoreHorizontal, PlayCircle, PackageCheck, RotateCcw, RefreshCw, ReceiptText,
} from "lucide-react";
import { generateInvoice } from "@/lib/generateInvoice";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLoadStatusActions } from "@/hooks/useLoadStatusActions";
import type { LoadStatus } from "@/hooks/useLoadStatusActions";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import LiveDriverMap from "@/components/LiveDriverMap";
import IntegrationSyncPanel from "@/components/IntegrationSyncPanel";
import RouteOptimizerPanel from "@/components/RouteOptimizerPanel";
import CSVImportPanel, { exportToCSV } from "@/components/CSVImportPanel";
import QuickLoadEntry, { cloneLoadData } from "@/components/QuickLoadEntry";
import AutoDispatchPanel from "@/components/AutoDispatchPanel";
import DispatchBlastPanel from "@/components/DispatchBlast";
import BlastLoadDialog from "@/components/BlastLoadDialog";
import CustomerOrderHistory from "@/components/CustomerOrderHistory";
import ActivityLog from "@/components/ActivityLog";
import { useRealtimeDriverMap } from "@/hooks/useRealtimeDriverMap";
const LoadDetailPanel = lazy(() => import("@/components/LoadDetailPanel"));
import type { LoadDetail } from "@/components/LoadDetailPanel";
import ETABadge from "@/components/ETABadge";
import LoadSearchFilters, {
    EMPTY_LOAD_FILTERS,
    type LoadFilters,
} from "@/components/LoadSearchFilters";

// ─── Types ──────────────────────────────────────────
type Driver = { id: string; full_name: string; hub: string; status: string };
type Vehicle = { id: string; vehicle_name: string; vehicle_type: string; hub: string; status: string };
type Load = {
    id: string; load_date: string; reference_number: string | null;
    dispatcher_id: string | null; driver_id: string | null; vehicle_id: string | null;
    shift: string; hub: string; client_name: string | null;
    pickup_address: string | null; delivery_address: string | null;
    miles: number; deadhead_miles: number;
    start_time: string | null; end_time: string | null; wait_time_minutes: number;
    revenue: number; driver_pay: number; fuel_cost: number;
    status: string; detention_eligible: boolean; detention_billed: number;
    service_type: string; packages: number; weight_lbs: number | null;
    comments: string | null; pod_confirmed: boolean;
    created_at: string; updated_at: string;
    // OnTime-parity fields
    shipper_name?: string | null;
    requested_by?: string | null;
    pickup_company?: string | null;
    delivery_company?: string | null;
    collection_time?: string | null;
    delivery_time?: string | null;
    description?: string | null;
    dimensions_text?: string | null;
    vehicle_required?: string | null;
    po_number?: string | null;
    inbound_tracking?: string | null;
    outbound_tracking?: string | null;
    estimated_pickup?: string | null;
    estimated_delivery?: string | null;
    actual_pickup?: string | null;
    actual_delivery?: string | null;
    current_eta?: string | null;
    eta_status?: string | null;
    sla_deadline?: string | null;
    route_distance_meters?: number | null;
    route_duration_seconds?: number | null;
    cutoff_time?: string | null;
};
type Profile = { user_id: string; full_name: string };

// ─── Add Load Form Type ─────────────────────────────
type AddLoadForm = {
    // Step 1: Load Info
    reference_number: string;
    consol_number: string;
    client_name: string;
    client_id: string;
    service_type: string;
    revenue: string;
    sla_deadline: string;
    po_number: string;
    vehicle_type: string;
    distance_miles: string;
    // Step 2: Pickup
    pickup_company: string;
    pickup_address: string;
    pickup_open_hours: string;
    pickup_contact_name: string;
    pickup_contact_phone: string;
    pickup_time_from: string;
    pickup_time_to: string;
    // Step 2: Delivery
    delivery_company: string;
    delivery_address: string;
    delivery_contact_name: string;
    delivery_contact_phone: string;
    // Step 3: Cargo
    packages: string;
    package_type: string;
    weight_kg: string;
    dim_l: string;
    dim_w: string;
    dim_h: string;
    dimensions_text: string;
    description: string;
    // Step 3: Driver
    driver_id: string;
    // BOL
    bol_url: string;
    // Airline cutoff
    cutoff_time: string;
};

type Company = {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
};

type CompanyContact = {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    job_title: string | null;
    company_id: string | null;
};

type RateCard = {
    hub: string;
    service_type: string;
    vehicle_type: string;
    base_rate: number;
    per_mile_rate: number;
    per_lb_rate: number;
    min_charge: number;
    fuel_surcharge_pct: number;
};

// ─── Anika Rate Calculator ──────────────────────────────
// Hardcoded Anika rate sheet — do NOT pull from DB
const ANIKA_RATES = {
    cargo_van: { base: 105, perMile: 2.0, deadheadPerMile: 2.0, weightThreshold: 100, weightRate: 0.10 },
    box_truck:  { base: 170, perMile: 2.5, deadheadPerMile: 2.5, weightThreshold: 600, weightRate: 0.15 },
} as const;

type AnikaVehicle = keyof typeof ANIKA_RATES;
type AnikaModifiers = {
    afterHours: boolean;
    weekend: boolean;
    holiday: boolean;
    tenderingFee: boolean;
    attemptCharge: boolean;
    additionalStops: number;
    extraPieces: number;
    specialHandling: boolean;
    documents: boolean;
    holding: number;
    waitTime: number;
    secondPerson: boolean;
    whiteGlove: boolean;
    hazmat: boolean;
};

const EMPTY_ANIKA_MODIFIERS: AnikaModifiers = {
    afterHours: false, weekend: false, holiday: false, tenderingFee: false, attemptCharge: false,
    additionalStops: 0, extraPieces: 0, specialHandling: false, documents: false,
    holding: 0, waitTime: 0, secondPerson: false, whiteGlove: false, hazmat: false,
};

type AnikaBreakdown = {
    baseRate: number;
    mileageCharge: number;
    fuelSurcharge: number;
    subtotal: number;
    weightSurcharge: number;
    modifiersTotal: number;
    finalQuote: number;
};

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

const AOG_SERVICE_TYPES = [
    { value: "AOG",      label: "✈️ AOG",      hub_key: "hotshot" },
    { value: "Courier",  label: "⚡ Courier",   hub_key: "courier" },
    { value: "Standard", label: "📦 Standard",  hub_key: "last_mile" },
];
const PKG_TYPES = ["PLT", "CTN", "BOX", "OTHER"];
const VEHICLE_TYPES_DISPATCH = [
    { value: "car_suv",    label: "Sedan / SUV" },
    { value: "cargo_van",  label: "Cargo Van" },
    { value: "sprinter",   label: "Sprinter Van" },
    { value: "box_truck",  label: "Box Truck" },
];

// ─── Constants ──────────────────────────────────────
const SHIFTS = [{ value: "day", label: "Día" }, { value: "night", label: "Noche" }];
const STATUSES = [
    { value: "pending", label: "Pending", color: "bg-gray-500" },
    { value: "assigned", label: "Assigned", color: "bg-blue-500" },
    { value: "blasted", label: "Blasted", color: "bg-violet-500" },
    { value: "in_progress", label: "In Transit", color: "bg-yellow-500" },
    { value: "arrived_pickup", label: "At Pickup 📍", color: "bg-blue-400" },
    { value: "in_transit", label: "In Transit", color: "bg-yellow-500" },
    { value: "arrived_delivery", label: "At Delivery 📍", color: "bg-purple-400" },
    { value: "delivered", label: "Delivered", color: "bg-green-500" },
    { value: "completed", label: "Completed", color: "bg-green-600" },
    { value: "cancelled", label: "Cancelled", color: "bg-gray-500" },
    { value: "failed", label: "Failed", color: "bg-red-500" },
];
const HUBS = CITY_HUBS;
const WAIT_COLORS = [
    { max: 15, label: "Good", class: "bg-green-500/15 text-green-700 dark:text-green-400" },
    { max: 30, label: "Caution", class: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    { max: 60, label: "High", class: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    { max: Infinity, label: "Critical", class: "bg-red-500/15 text-red-700 dark:text-red-400" },
];
const DETENTION_THRESHOLD = 30; // minutes — industry standard

function waitBadgeClass(mins: number) {
    return (WAIT_COLORS.find((w) => mins <= w.max) ?? WAIT_COLORS[3]).class;
}

// ═══════════════════════════════════════════════════════════
export default function DispatchTracker() {
    const { user } = useAuth();
    const { unreadMap } = useUnreadMessageCounts(user?.id ?? null);
    const { toast } = useToast();

    // ── Data ─────────────────────────────────
    const [loads, setLoads] = useState<Load[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Live GPS (own tracking — replaces Onfleet/OT360) ──
    const { drivers: liveDrivers, loading: liveDriversLoading, connected: liveDriversConnected, refresh: refreshLiveDrivers } = useRealtimeDriverMap();

    // ── Filters ──────────────────────────────
    const [selectedDate, setSelectedDate] = useState(todayISO());
    const [dateRangeStart, setDateRangeStart] = useState(daysAgoISO(7));
    const [dateRangeEnd, setDateRangeEnd] = useState(todayISO());

    // ── Load Board Search + Filters ───────────
    const [loadFilters, setLoadFilters] = useState<LoadFilters>(EMPTY_LOAD_FILTERS);

    // ── Dialog ───────────────────────────────
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editLoad, setEditLoad] = useState<Load | null>(null);

    // ── Add Load multi-step form state ───────
    const [addStep, setAddStep] = useState(1); // 1=Load Info, 2=Pickup/Delivery, 3=Cargo+Driver
    const [addForm, setAddForm] = useState<AddLoadForm>(EMPTY_ADD_FORM);
    const [bolFile, setBolFile] = useState<File | null>(null);
    const [bolUploading, setBolUploading] = useState(false);
    const [suggestedDriverId, setSuggestedDriverId] = useState<string | null>(null);
    const bolInputRef = useRef<HTMLInputElement>(null);

    // ── CRM & rate card data ─────────────────
    const [companies, setCompanies] = useState<Company[]>([]);
    const [companyContacts, setCompanyContacts] = useState<CompanyContact[]>([]);
    const [rateCards, setRateCards] = useState<RateCard[]>([]);
    const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
    const [clientSearch, setClientSearch] = useState("");
    const [pickupSearch, setPickupSearch] = useState("");
    const [deliverySearch, setDeliverySearch] = useState("");
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [showPickupDropdown, setShowPickupDropdown] = useState(false);
    const [showDeliveryDropdown, setShowDeliveryDropdown] = useState(false);

    // ── New-client inline form ───────────────
    const [showNewClient, setShowNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [newClientPhone, setNewClientPhone] = useState("");
    const [newClientAddress, setNewClientAddress] = useState("");
    const [newClientCity, setNewClientCity] = useState("");
    const [newClientState, setNewClientState] = useState("");
    const [savingNewClient, setSavingNewClient] = useState(false);

    // ── Computed revenue from rate card ──────
    const [computedRevenue, setComputedRevenue] = useState<number | null>(null);
    // ── Anika rate calculator state ──────────
    const [anikaModifiers, setAnikaModifiers] = useState<AnikaModifiers>(EMPTY_ANIKA_MODIFIERS);
    // ── Tools sidebar ───────────────────────
    const [toolsOpen, setToolsOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<"quick" | "import" | "history" | "log" | "blast" | null>("quick");
    const [autoDispatchLoadId, setAutoDispatchLoadId] = useState<string | null>(null);
    const [blastDialogLoad, setBlastDialogLoad] = useState<Load | null>(null);
    const [clonePrefill, setClonePrefill] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    // ── Detail panel ─────────────────────────
    const [selectedLoadDetail, setSelectedLoadDetail] = useState<Load | null>(null);

    // ── Auto-refresh ──────────────────────────
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const [secondsAgo, setSecondsAgo] = useState(0);

    // ── Status action hook ────────────────────
    const { updateStatus } = useLoadStatusActions();

    // ── Fetch helpers ────────────────────────
    const db = supabase;

    const fetchLoads = useCallback(async () => {
        const { data } = await db.from("daily_loads")
            .select("*")
            .gte("load_date", dateRangeStart)
            .lte("load_date", dateRangeEnd)
            .order("load_date", { ascending: false });
        if (data) {
            setLoads(data);
            setLastRefreshed(new Date());
            setSecondsAgo(0);
        }
    }, [dateRangeStart, dateRangeEnd]);

    const fetchDrivers = useCallback(async () => {
        const { data } = await db.from("drivers").select("id, full_name, hub, status").eq("status", "active");
        if (data) setDrivers(data);
    }, []);

    const fetchVehicles = useCallback(async () => {
        const { data } = await db.from("vehicles").select("id, vehicle_name, vehicle_type, hub, status").eq("status", "active");
        if (data) setVehicles(data);
    }, []);

    const fetchProfiles = useCallback(async () => {
        const { data } = await supabase.from("profiles").select("user_id, full_name");
        if (data) setProfiles(data as Profile[]);
    }, []);

    const fetchCompanies = useCallback(async () => {
        const { data } = await supabase
            .from("companies")
            .select("id, name, address, city, state, phone")
            .order("name");
        if (data) setCompanies(data as Company[]);
    }, []);

    const fetchRateCards = useCallback(async () => {
        const { data } = await supabase.from("rate_cards").select("*");
        if (data) setRateCards(data as RateCard[]);
    }, []);

    const fetchRecentAddresses = useCallback(async () => {
        const { data } = await supabase
            .from("daily_loads")
            .select("pickup_address, delivery_address, pickup_company, delivery_company")
            .not("pickup_address", "is", null)
            .order("created_at", { ascending: false })
            .limit(60);
        if (data) {
            const addrs = [...new Set([
                ...data.map((d: any) => d.pickup_address),
                ...data.map((d: any) => d.delivery_address),
            ].filter(Boolean))].slice(0, 20);
            setRecentAddresses(addrs);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        Promise.all([fetchLoads(), fetchDrivers(), fetchVehicles(), fetchProfiles(), fetchCompanies(), fetchRateCards(), fetchRecentAddresses()])
            .finally(() => setLoading(false));

        // Auto-refresh loads every 60 s so dispatchers always see current status
        const loadRefreshTimer = setInterval(() => fetchLoads(), 60_000);
        return () => clearInterval(loadRefreshTimer);
    }, [user, fetchLoads, fetchDrivers, fetchVehicles, fetchProfiles, fetchCompanies, fetchRateCards, fetchRecentAddresses]);

    // ── Realtime: geofence arrival toasts ────────────────────────
    useEffect(() => {
        if (!user) return;

        // Subscribe to load_status_events for arrived_* transitions
        const geofenceChannel = supabase
            .channel("geofence-arrivals")
            .on(
                "postgres_changes" as any,
                {
                    event: "INSERT",
                    schema: "public",
                    table: "load_status_events",
                } as any,
                async (payload: any) => {
                    const evt = payload.new as {
                        load_id: string;
                        new_status: string;
                        previous_status: string;
                    };
                    if (
                        evt.new_status !== "arrived_pickup" &&
                        evt.new_status !== "arrived_delivery"
                    ) return;

                    // Fetch load details for the toast
                    const { data: loadData } = await supabase
                        .from("daily_loads")
                        .select("reference_number, driver_id, client_name")
                        .eq("id", evt.load_id)
                        .single();

                    const refNumber = loadData?.reference_number ?? "—";
                    const driverRecord = drivers.find(d => d.id === loadData?.driver_id);
                    const driverName = driverRecord?.full_name ?? "Driver";
                    const eventLabel = evt.new_status === "arrived_pickup" ? "pickup" : "delivery";

                    toast({
                        title: "📍 Driver Arrived",
                        description: `${driverName} arrived at ${eventLabel} — Ref #${refNumber}`,
                    });

                    // Send push confirmation to the driver
                    if (loadData?.driver_id) {
                        sendPushToDrivers(
                            [loadData.driver_id],
                            '📍 Arrival Confirmed',
                            `Dispatch has been notified of your arrival at ${eventLabel} — Ref #${refNumber}`,
                            { load_id: evt.load_id, type: 'arrival_confirmation', event: evt.new_status }
                        ).catch((err: unknown) => {
                            console.warn('[DispatchTracker] Arrival push failed:', err);
                        });
                    }

                    // Refresh load list so card status updates immediately
                    fetchLoads();
                }
            )
            .subscribe();

        // Also subscribe to daily_loads realtime for instant card updates
        const loadsChannel = supabase
            .channel("dispatch-loads-realtime")
            .on(
                "postgres_changes" as any,
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "daily_loads",
                } as any,
                () => { fetchLoads(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(geofenceChannel);
            supabase.removeChannel(loadsChannel);
        };
    }, [user, drivers, fetchLoads, toast]);

    // ── "X seconds ago" ticker — updates every 5 s ───────────────
    useEffect(() => {
        const ticker = setInterval(() => {
            setSecondsAgo(Math.floor((Date.now() - lastRefreshed.getTime()) / 1000));
        }, 5_000);
        return () => clearInterval(ticker);
    }, [lastRefreshed]);

    // ── AI driver suggestion: pick driver whose hub matches pickup city ──
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

    // ── When pickup address changes, run AI suggestion ──────
    useEffect(() => {
        if (addForm.pickup_address && drivers.length > 0) {
            suggestDriver(addForm.pickup_address, drivers);
        }
    }, [addForm.pickup_address, drivers, suggestDriver]);

    // ── Fetch contacts when client company changes ───────────
    useEffect(() => {
        if (!addForm.client_id) { setCompanyContacts([]); return; }
        supabase
            .from("contacts")
            .select("id, first_name, last_name, phone, email, job_title, company_id")
            .eq("company_id", addForm.client_id)
            .then(({ data }) => { if (data) setCompanyContacts(data as CompanyContact[]); });
    }, [addForm.client_id]);

    // ── Auto-compute revenue from rate card ──────────────────
    useEffect(() => {
        if (!rateCards.length) return;
        const svcMap: Record<string, string> = { AOG: "aog", Courier: "courier", Standard: "standard" };
        const rateKey = svcMap[addForm.service_type] ?? "standard";
        // Map UI hub values to DB hub codes (rate_cards uses PHX/LAX/ATL)
        const dbHub = "PHX"; // All current clients are PHX-based
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

    // ── Auto-update dimensions_text when L/W/H change ───────
    useEffect(() => {
        const { dim_l, dim_w, dim_h } = addForm;
        if (dim_l && dim_w && dim_h) {
            setAddForm((f) => ({ ...f, dimensions_text: `${dim_l} x ${dim_w} x ${dim_h} CM` }));
        }
    }, [addForm.dim_l, addForm.dim_w, addForm.dim_h]);

    // ── Save new client company inline ──────────────────────
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
            setCompanies((prev) => [...prev, data as Company].sort((a, b) => a.name.localeCompare(b.name)));
            setAddForm((f) => ({ ...f, client_id: data.id, client_name: data.name }));
            setClientSearch(data.name);
            setShowNewClient(false);
            setNewClientName(""); setNewClientPhone(""); setNewClientAddress(""); setNewClientCity(""); setNewClientState("");
            toast({ title: "✅ Client saved", description: `${data.name} added to company database` });
        }
    };

    // ── Upload BOL to Supabase Storage ─────────────────────
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

    // ── Submit new Add Load form ────────────────────────────
    const handleAddLoad = async () => {
        if (!user) return;

        // Validate required fields
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

        // Upload BOL if provided
        let bolUrl = addForm.bol_url || null;
        if (bolFile) {
            bolUrl = await uploadBol(bolFile);
        }

        // Revenue: use manual if entered, else computed from rate card
        const finalRevenue = addForm.revenue
            ? parseFloat(addForm.revenue)
            : (computedRevenue ?? 0);

        const payload: Record<string, any> = {
            load_date: todayISO(),
            reference_number: addForm.reference_number || null,
            consol_number: addForm.consol_number || null,
            client_name: addForm.client_name || null,
            service_type: addForm.service_type || "AOG",
            revenue: finalRevenue,
            sla_deadline: addForm.sla_deadline || null,
            cutoff_time: addForm.cutoff_time || null,
            po_number: addForm.po_number || null,
            vehicle_required: addForm.vehicle_type || null,
            // Pickup
            pickup_company: addForm.pickup_company || null,
            pickup_address: addForm.pickup_address || null,
            pickup_open_hours: addForm.pickup_open_hours || null,
            pickup_contact_name: addForm.pickup_contact_name || null,
            pickup_contact_phone: addForm.pickup_contact_phone || null,
            collection_time: addForm.pickup_time_from || null,
            // Delivery
            delivery_company: addForm.delivery_company || null,
            delivery_address: addForm.delivery_address || null,
            delivery_contact_name: addForm.delivery_contact_name || null,
            delivery_contact_phone: addForm.delivery_contact_phone || null,
            // Cargo
            packages: parseInt(addForm.packages) || 1,
            package_type: addForm.package_type || "BOX",
            weight_kg: parseFloat(addForm.weight_kg) || null,
            dimensions_text: addForm.dimensions_text || null,
            description: addForm.description || null,
            // Driver & distance
            driver_id: addForm.driver_id || null,
            miles: parseFloat(addForm.distance_miles) || 0,
            // BOL
            bol_url: bolUrl,
            // Defaults
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

        const { error } = await supabase.from("daily_loads").insert(payload);

        if (error) {
            toast({ title: "Failed to create load", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "✅ Load created!", description: `${addForm.reference_number} added to the board` });
            setDialogOpen(false);
            setAddForm(EMPTY_ADD_FORM);
            setAddStep(1);
            setBolFile(null);
            setSuggestedDriverId(null);
            setClientSearch("");
            setPickupSearch("");
            setDeliverySearch("");
            setComputedRevenue(null);
            setCompanyContacts([]);
            setAnikaModifiers(EMPTY_ANIKA_MODIFIERS);
            fetchLoads();
        }
    };

    // ── Reset add form when dialog closes ──────────────────
    const openAddDialog = useCallback(() => {
        setEditLoad(null);
        setAddForm(EMPTY_ADD_FORM);
        setAddStep(1);
        setBolFile(null);
        setSuggestedDriverId(null);
        setClientSearch("");
        setPickupSearch("");
        setDeliverySearch("");
        setShowNewClient(false);
        setComputedRevenue(null);
        setCompanyContacts([]);
        setAnikaModifiers(EMPTY_ANIKA_MODIFIERS);
        setDialogOpen(true);
    }, []);

    // ── CRUD ─────────────────────────────────
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const waitMins = Number(fd.get("wait_time_minutes")) || 0;
        const payload = {
            load_date: fd.get("load_date") as string || todayISO(),
            reference_number: fd.get("reference_number") as string || null,
            shift: fd.get("shift") as string || "day",
            hub: fd.get("hub") as string || "PHX",
            driver_id: fd.get("driver_id") as string || null,
            vehicle_id: (fd.get("vehicle_id") as string) || null,
            client_name: fd.get("client_name") as string || null,
            pickup_address: fd.get("pickup_address") as string || null,
            delivery_address: fd.get("delivery_address") as string || null,
            miles: Number(fd.get("miles")) || 0,
            deadhead_miles: Number(fd.get("deadhead_miles")) || 0,
            start_time: fd.get("start_time") as string || null,
            end_time: fd.get("end_time") as string || null,
            wait_time_minutes: waitMins,
            revenue: Number(fd.get("revenue")) || 0,
            driver_pay: Number(fd.get("driver_pay")) || 0,
            fuel_cost: Number(fd.get("fuel_cost")) || 0,
            status: fd.get("status") as string || "assigned",
            service_type: fd.get("service_type") as string || "last_mile",
            packages: Number(fd.get("packages")) || 1,
            comments: fd.get("comments") as string || null,
            detention_eligible: waitMins >= DETENTION_THRESHOLD,
            detention_billed: Number(fd.get("detention_billed")) || 0,
            // OnTime-parity fields
            shipper_name: fd.get("shipper_name") as string || null,
            requested_by: fd.get("requested_by") as string || null,
            pickup_company: fd.get("pickup_company") as string || null,
            delivery_company: fd.get("delivery_company") as string || null,
            description: fd.get("description") as string || null,
            dimensions_text: fd.get("dimensions_text") as string || null,
            vehicle_required: fd.get("vehicle_required") as string || null,
            po_number: fd.get("po_number") as string || null,
            inbound_tracking: fd.get("inbound_tracking") as string || null,
            outbound_tracking: fd.get("outbound_tracking") as string || null,
            dispatcher_id: user!.id,
            ...(editLoad ? {} : { created_by: user!.id }),
            updated_at: new Date().toISOString(),
        };

        const { error } = editLoad
            ? await db.from("daily_loads").update(payload).eq("id", editLoad.id)
            : await db.from("daily_loads").insert(payload);

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({ title: editLoad ? "Load updated" : "Load added" });
            setDialogOpen(false);
            setEditLoad(null);
            fetchLoads();
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const { error } = await db.from("daily_loads").delete().eq("id", deleteId);
        setDeleteId(null);
        if (error) {
            toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Load deleted" });
            fetchLoads();
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        const currentLoad = loads.find((l) => l.id === id);
        await updateStatus({
            loadId: id,
            previousStatus: currentLoad?.status ?? "pending",
            newStatus: newStatus as LoadStatus,
            onSuccess: () => fetchLoads(),
        });
    };

    // ── Lookups ──────────────────────────────
    const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.full_name ?? "—";
    const vehicleName = (id: string | null) => vehicles.find((v) => v.id === id)?.vehicle_name ?? "—";
    const dispatcherName = (id: string | null) => profiles.find((p) => p.user_id === id)?.full_name ?? "—";
    const statusInfo = (s: string) => STATUSES.find((st) => st.value === s) ?? STATUSES[0];

    // ── Computed / Analytics ──────────────────
    const todayLoads = useMemo(() => loads.filter((l) => l.load_date === todayISO()), [loads]);
    const todayStats = useMemo(() => ({
        count: todayLoads.length,
        miles: todayLoads.reduce((s, l) => s + Number(l.miles), 0),
        revenue: todayLoads.reduce((s, l) => s + Number(l.revenue), 0),
        avgWait: todayLoads.length ? Math.round(todayLoads.reduce((s, l) => s + Number(l.wait_time_minutes), 0) / todayLoads.length) : 0,
    }), [todayLoads]);

    // All loads for the selected board date (before search/filter)
    const rawBoardLoads = useMemo(
        () => loads.filter((l) => l.load_date === selectedDate),
        [loads, selectedDate],
    );

    // ── Helper: date range from loadFilters.dateRange ──────
    const filterDateMatches = useCallback((loadDate: string, dateRange: LoadFilters["dateRange"]) => {
        if (!dateRange) return true;
        const today = todayISO();
        const yesterday = daysAgoISO(1);
        const weekAgo = daysAgoISO(6);
        if (dateRange === "today") return loadDate === today;
        if (dateRange === "yesterday") return loadDate === yesterday;
        if (dateRange === "this_week") return loadDate >= weekAgo && loadDate <= today;
        return true;
    }, []);

    // ── Filtered + sorted board loads ─────────────────────
    const boardLoads = useMemo(() => {
        let result = rawBoardLoads;
        const { search, status, driverId, serviceType, dateRange, sort } = loadFilters;

        // Text search (reference_number, client_name, pickup_address, delivery_address)
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            result = result.filter((l) => {
                return (
                    (l.reference_number?.toLowerCase().includes(q) ?? false) ||
                    (l.client_name?.toLowerCase().includes(q) ?? false) ||
                    (l.pickup_address?.toLowerCase().includes(q) ?? false) ||
                    (l.delivery_address?.toLowerCase().includes(q) ?? false) ||
                    (l.pickup_company?.toLowerCase().includes(q) ?? false) ||
                    (l.delivery_company?.toLowerCase().includes(q) ?? false)
                );
            });
        }

        // Status filter
        if (status) {
            result = result.filter((l) => l.status === status);
        }

        // Driver filter
        if (driverId) {
            result = result.filter((l) => l.driver_id === driverId);
        }

        // Service type filter
        if (serviceType) {
            result = result.filter((l) => l.service_type === serviceType);
        }

        // Date range filter (applies on top of selectedDate — narrows further)
        if (dateRange) {
            result = result.filter((l) => filterDateMatches(l.load_date, dateRange));
        }

        // Sort
        result = [...result].sort((a, b) => {
            if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
            if (sort === "revenue_desc") return Number(b.revenue) - Number(a.revenue);
            if (sort === "status") return a.status.localeCompare(b.status);
            // default: newest
            return b.created_at.localeCompare(a.created_at);
        });

        return result;
    }, [rawBoardLoads, loadFilters, filterDateMatches]);

    // Wait time analytics
    const waitAnalytics = useMemo(() => {
        const all = loads.filter((l) => l.wait_time_minutes > 0);
        const avgAll = all.length ? Math.round(all.reduce((s, l) => s + l.wait_time_minutes, 0) / all.length) : 0;
        const detentionEligible = loads.filter((l) => l.wait_time_minutes >= DETENTION_THRESHOLD);
        const detentionBilled = loads.reduce((s, l) => s + Number(l.detention_billed), 0);

        // By client
        const byClient: Record<string, { total: number; count: number }> = {};
        loads.forEach((l) => {
            const c = l.client_name || "Unknown";
            if (!byClient[c]) byClient[c] = { total: 0, count: 0 };
            byClient[c].total += l.wait_time_minutes;
            byClient[c].count += 1;
        });
        const clientWait = Object.entries(byClient)
            .map(([name, v]) => ({ name, avg: Math.round(v.total / v.count), loads: v.count }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 10);

        // By driver
        const byDriver: Record<string, { total: number; count: number }> = {};
        loads.forEach((l) => {
            const d = driverName(l.driver_id);
            if (!byDriver[d]) byDriver[d] = { total: 0, count: 0 };
            byDriver[d].total += l.wait_time_minutes;
            byDriver[d].count += 1;
        });
        const driverWait = Object.entries(byDriver)
            .map(([name, v]) => ({ name, avg: Math.round(v.total / v.count), loads: v.count }))
            .sort((a, b) => b.avg - a.avg);

        return { avgAll, detentionEligible, detentionBilled, clientWait, driverWait };
    }, [loads, drivers]);

    // Daily report
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
        const text = `📋 DAILY OPS REPORT — ${selectedDate}\n${"═".repeat(40)}\n` +
            `Loads: ${r.total} (${r.delivered} delivered)\nMiles: ${r.totalMiles}\n` +
            `Revenue: ${fmtMoney(r.totalRevenue)}\nCosts: ${fmtMoney(r.totalCosts)}\n` +
            `Profit: ${fmtMoney(r.profit)} (${r.margin.toFixed(1)}%)\n\n` +
            `DRIVER BREAKDOWN:\n${r.driverRows.map((d) => `  ${d.name}: ${d.loads} loads, ${d.miles} mi, ${fmtMoney(d.revenue)}, wait avg ${fmtWait(d.avgWait)}`).join("\n")}\n\n` +
            `SHIFTS:\n${r.shifts.map((s) => `  ${s.label}: ${s.loads} loads, ${s.miles} mi, ${fmtMoney(s.revenue)}`).join("\n")}`;
        navigator.clipboard.writeText(text);
        toast({ title: "Report copied to clipboard" });
    };

    // ── Skeleton ─────────────────────────────
    if (loading) return (
        <div className="space-y-4 animate-in">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
            <Skeleton className="h-96 rounded-2xl" />
        </div>
    );

    // ═══════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════
    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight gradient-text">Dispatch Tracker</h1>
                    <p className="text-muted-foreground text-sm mt-1">Daily load tracking, wait time analytics & operations reports</p>
                </div>
                <Button className="btn-gradient gap-2" onClick={openAddDialog}>
                    <Plus className="h-4 w-4" /> New Load
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Loads Today", value: todayStats.count, icon: Truck, color: "text-accent" },
                    { label: "Miles Today", value: todayStats.miles.toFixed(0), icon: MapPin, color: "text-blue-500" },
                    { label: "Revenue Today", value: fmtMoney(todayStats.revenue), icon: DollarSign, color: "text-green-500" },
                    { label: "Avg Wait Today", value: fmtWait(todayStats.avgWait), icon: Clock, color: todayStats.avgWait > 30 ? "text-red-500" : "text-yellow-500" },
                ].map((s) => (
                    <Card key={s.label} className="glass-card rounded-2xl relative accent-bar">
                        <CardContent className="pt-5 pb-4 px-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                                    <s.icon className={`h-5 w-5 ${s.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-3 flex-wrap">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" className="w-40 h-9" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} />
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" className="w-40 h-9" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} />
                <Button variant="outline" size="sm" onClick={() => { setDateRangeStart(todayISO()); setDateRangeEnd(todayISO()); setSelectedDate(todayISO()); }}>Today</Button>
                <Button variant="outline" size="sm" onClick={() => { setDateRangeStart(daysAgoISO(7)); setDateRangeEnd(todayISO()); }}>This Week</Button>
                <Button variant="outline" size="sm" onClick={fetchLoads}>Refresh</Button>
            </div>

            {/* ═══ TABS ═══ */}
            <Tabs defaultValue="board" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="board" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Load Board</TabsTrigger>
                    <TabsTrigger value="live" className="gap-1.5"><Navigation className="h-3.5 w-3.5" /> Live Ops</TabsTrigger>
                    <TabsTrigger value="wait" className="gap-1.5"><Timer className="h-3.5 w-3.5" /> Wait Time Intelligence</TabsTrigger>
                    <TabsTrigger value="report" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Daily Report</TabsTrigger>
                </TabsList>

                {/* ──────── TAB: LIVE OPS ──────── */}
                <TabsContent value="live">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                            <LiveDriverMap
                                drivers={liveDrivers.map(d => ({
                                    id: d.driverId,
                                    name: d.name,
                                    lat: d.lat,
                                    lng: d.lng,
                                    status: d.isMoving ? "active" as const : d.shiftStatus === "on_duty" ? "idle" as const : "offline" as const,
                                    speed: d.speed ?? undefined,
                                    heading: d.heading ?? undefined,
                                    battery: d.battery ?? undefined,
                                    lastSeen: d.lastSeen,
                                    activeLoadId: d.activeLoadId ?? undefined,
                                    source: "own" as const,
                                }))
                                }
                                loading={liveDriversLoading}
                                pollActive={liveDriversConnected}
                                onRefresh={refreshLiveDrivers}
                            />
                        </div>
                        <div className="space-y-4">
                            <IntegrationSyncPanel
                                onfleetConnected={false}
                                ontime360Connected={false}
                                onOpenSettings={() => toast({ title: "Coming soon", description: "Integration settings will be in Team Management → Integrations." })}
                            />
                            <RouteOptimizerPanel
                                loads={boardLoads.map(l => ({
                                    id: l.id,
                                    client_name: l.client_name,
                                    delivery_address: l.delivery_address,
                                    pickup_address: l.pickup_address,
                                    delivery_lat: (l as any).delivery_lat ?? null,
                                    delivery_lng: (l as any).delivery_lng ?? null,
                                    status: l.status,
                                    packages: l.packages,
                                    tracking_token: (l as any).tracking_token ?? null,
                                }))}
                                onRouteApplied={() => fetchLoads()}
                            />
                            {/* Quick Stats */}
                            <Card className="border-0 shadow-sm">
                                <CardContent className="pt-4 pb-3">
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-primary" />
                                        Today's Sync Status
                                    </h3>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                            <span className="text-muted-foreground">Board loads</span>
                                            <Badge variant="secondary">{boardLoads.length}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                            <span className="text-muted-foreground">Active drivers</span>
                                            <Badge variant="secondary">{drivers.filter(d => d.status === "active").length}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                            <span className="text-muted-foreground">Delivered today</span>
                                            <Badge className="bg-green-500/15 text-green-600 border-0">{boardLoads.filter(l => l.status === "delivered").length}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                            <span className="text-muted-foreground">In transit</span>
                                            <Badge className="bg-yellow-500/15 text-yellow-600 border-0">{boardLoads.filter(l => l.status === "in_progress").length}</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="board">
                    <div className="flex items-center gap-3 mb-3">
                        <Label className="text-xs text-muted-foreground">Board Date</Label>
                        <Input type="date" className="w-40 h-9" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                        <Badge variant="secondary">{rawBoardLoads.length} loads</Badge>
                        {/* Last updated indicator */}
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70 select-none">
                            <RefreshCw className="h-2.5 w-2.5" />
                            {secondsAgo < 10
                                ? "Just updated"
                                : secondsAgo < 60
                                ? `Updated ${secondsAgo}s ago`
                                : `Updated ${Math.floor(secondsAgo / 60)}m ago`}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                                onClick={() => exportToCSV(boardLoads.map(l => ({
                                    reference: l.reference_number ?? "",
                                    client: l.client_name ?? "",
                                    driver: driverName(l.driver_id),
                                    pickup: l.pickup_address ?? "",
                                    delivery: l.delivery_address ?? "",
                                    status: l.status,
                                    miles: l.miles,
                                    revenue: l.revenue,
                                    packages: l.packages,
                                    wait_min: l.wait_time_minutes,
                                    start_time: l.start_time ?? "",
                                    end_time: l.end_time ?? "",
                                    pod: l.pod_confirmed ? "Yes" : "No",
                                })), `loads_${selectedDate}.csv`)}
                            >
                                <Download className="h-3.5 w-3.5" /> Export CSV
                            </Button>
                            <Button
                                variant={toolsOpen ? "default" : "outline"}
                                size="sm" className="h-8 gap-1.5 text-xs"
                                onClick={() => setToolsOpen(!toolsOpen)}
                            >
                                {toolsOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                                Tools
                            </Button>
                        </div>
                    </div>

                    {/* ── Search + Filter Bar ── */}
                    <LoadSearchFilters
                        filters={loadFilters}
                        onFiltersChange={setLoadFilters}
                        totalCount={rawBoardLoads.length}
                        filteredCount={boardLoads.length}
                        drivers={drivers.filter((d) => d.status === "active").map((d) => ({ id: d.id, full_name: d.full_name }))}
                    />

                    <div className={`grid gap-4 ${toolsOpen ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
                        {/* Load Table */}
                        <div className={toolsOpen ? "lg:col-span-2" : ""}>
                            <Card className="glass-card rounded-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-24">Ref #</TableHead>
                                            <TableHead>Shift</TableHead>
                                            <TableHead>Driver</TableHead>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Miles</TableHead>
                                            <TableHead className="text-right">Revenue</TableHead>
                                            <TableHead>Wait</TableHead>
                                            <TableHead>ETA</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead className="w-20">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {boardLoads.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={12}>
                                                    {rawBoardLoads.length > 0 ? (
                                                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                                                            <Layers className="h-10 w-10 opacity-30" />
                                                            <p className="text-sm font-medium">No loads match your filters</p>
                                                            <p className="text-xs opacity-60">Try adjusting your search or clear all filters.</p>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setLoadFilters(EMPTY_LOAD_FILTERS)}
                                                                className="gap-1.5 mt-1"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                                Clear filters
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                                                            <Package className="h-10 w-10 opacity-30" />
                                                            <p className="text-sm font-medium">No loads for {selectedDate}</p>
                                                            <p className="text-xs opacity-60">Click &quot;New Load&quot; to add the first load for this date.</p>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {boardLoads.map((load) => {
                                            const si = statusInfo(load.status);
                                            return (
                                                <TableRow key={load.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedLoadDetail(load)}>
                                                    <TableCell className="font-mono text-xs">
                                                        <div className="flex items-center gap-1.5">
                                                            {load.reference_number || "—"}
                                                            {unreadMap[load.id] > 0 && (
                                                                <span className="inline-flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] px-0.5">
                                                                    {unreadMap[load.id] > 99 ? '99+' : unreadMap[load.id]}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell><Badge variant="outline" className="text-[10px]">{load.shift === "day" ? "☀️ Día" : "🌙 Noche"}</Badge></TableCell>
                                                    <TableCell className="font-medium text-sm">{driverName(load.driver_id)}</TableCell>
                                                    <TableCell className="text-sm">{load.client_name || "—"}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{load.description || "—"}</TableCell>
                                                    <TableCell className="text-right font-mono text-sm">{Number(load.miles).toFixed(0)}</TableCell>
                                                    <TableCell className="text-right font-mono text-sm">{Number(load.revenue) > 0 ? fmtMoney(Number(load.revenue)) : "—"}</TableCell>
                                                    <TableCell>
                                                        {load.wait_time_minutes > 0 ? (
                                                            <Badge className={`${waitBadgeClass(load.wait_time_minutes)} text-[10px]`}>
                                                                {fmtWait(load.wait_time_minutes)}
                                                                {load.wait_time_minutes >= DETENTION_THRESHOLD && " ⚠️"}
                                                            </Badge>
                                                        ) : <span className="text-muted-foreground text-xs">—</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <ETABadge
                                                            pickupAddress={load.pickup_address}
                                                            deliveryAddress={load.delivery_address}
                                                            slaDeadline={load.sla_deadline}
                                                            enabled={load.status === "in_progress"}
                                                            compact
                                                        />
                                                        {load.status !== "in_progress" && load.eta_status && load.eta_status !== "unknown" && (
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${load.eta_status === "on_time" ? "status-on-time" :
                                                                load.eta_status === "at_risk" ? "status-at-risk" :
                                                                    load.eta_status === "late" ? "status-late" : "status-idle"
                                                                }`}>
                                                                {load.eta_status?.replace("_", " ")}
                                                            </span>
                                                        )}
                                                        {load.status !== "in_progress" && (!load.eta_status || load.eta_status === "unknown") && (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        )}
                                                    </TableCell>
                                                    {/* ── Status cell: badge + next-action button ── */}
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {/* Status badge */}
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`h-2 w-2 rounded-full ${si.color}`} />
                                                                <span className="text-[10px] font-medium">{si.label}</span>
                                                            </div>
                                                            {/* Next-action button */}
                                                            {load.status === "pending" && (
                                                                <Button size="sm" variant="outline"
                                                                    className="h-6 text-[10px] px-2 gap-1 border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
                                                                    onClick={() => handleStatusChange(load.id, "assigned")}>
                                                                    <PlayCircle className="h-3 w-3" /> Assign
                                                                </Button>
                                                            )}
                                                            {load.status === "assigned" && (
                                                                <Button size="sm" variant="outline"
                                                                    className="h-6 text-[10px] px-2 gap-1 border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10"
                                                                    onClick={() => handleStatusChange(load.id, "in_progress")}>
                                                                    <Truck className="h-3 w-3" /> Picked Up
                                                                </Button>
                                                            )}
                                                            {load.status === "blasted" && (
                                                                <Button size="sm" variant="outline"
                                                                    className="h-6 text-[10px] px-2 gap-1 border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10"
                                                                    onClick={() => handleStatusChange(load.id, "in_progress")}>
                                                                    <Truck className="h-3 w-3" /> Picked Up
                                                                </Button>
                                                            )}
                                                            {load.status === "in_progress" && (
                                                                <Button size="sm" variant="outline"
                                                                    className="h-6 text-[10px] px-2 gap-1 border-green-500/40 text-green-600 hover:bg-green-500/10"
                                                                    onClick={() => handleStatusChange(load.id, "delivered")}>
                                                                    <PackageCheck className="h-3 w-3" /> Delivered
                                                                </Button>
                                                            )}
                                                            {load.status === "arrived_pickup" && (
                                                                <Badge className="bg-blue-500/15 text-blue-500 border-0 text-[9px] h-5 px-1.5">
                                                                    <MapPin className="h-2.5 w-2.5 mr-0.5" /> At Pickup
                                                                </Badge>
                                                            )}
                                                            {load.status === "arrived_delivery" && (
                                                                <Badge className="bg-purple-500/15 text-purple-500 border-0 text-[9px] h-5 px-1.5">
                                                                    <MapPin className="h-2.5 w-2.5 mr-0.5" /> At Delivery
                                                                </Badge>
                                                            )}
                                                            {(load.status === "delivered" || load.status === "completed") && (
                                                                <Badge className="bg-green-500/15 text-green-600 border-0 text-[9px] h-5 px-1.5">
                                                                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Done
                                                                </Badge>
                                                            )}
                                                            {(load.status === "failed" || load.status === "cancelled") && (
                                                                <Button size="sm" variant="outline"
                                                                    className="h-6 text-[10px] px-2 gap-1 border-gray-400/40 text-gray-500 hover:bg-gray-500/10"
                                                                    onClick={() => handleStatusChange(load.id, "pending")}>
                                                                    <RotateCcw className="h-3 w-3" /> Reopen
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {load.start_time && load.end_time ? `${load.start_time}–${load.end_time}` : load.start_time || "—"}
                                                    </TableCell>
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditLoad(load); setDialogOpen(true); }}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Clone load"
                                                                onClick={(e) => { e.stopPropagation(); setClonePrefill(cloneLoadData(load)); setActiveTool("quick"); setToolsOpen(true); toast({ title: "📋 Load cloned", description: "Edit and save the cloned load" }); }}>
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                            {!load.driver_id && (
                                                                <>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" title="Auto-assign"
                                                                        onClick={(e) => { e.stopPropagation(); setAutoDispatchLoadId(load.id); setToolsOpen(true); setActiveTool(null); }}>
                                                                        <Zap className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Blast to drivers"
                                                                        onClick={(e) => { e.stopPropagation(); setBlastDialogLoad(load); }}>
                                                                        <Radio className="h-3 w-3" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {/* (...) Quick status dropdown */}
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Change status">
                                                                        <MoreHorizontal className="h-3 w-3" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-44">
                                                                    {(load.status === "completed" || load.status === "delivered") && (
                                                                        <>
                                                                            <DropdownMenuItem
                                                                                className="text-xs gap-2 text-emerald-600 font-semibold"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    generateInvoice(
                                                                                        {
                                                                                            id: load.id,
                                                                                            reference_number: load.reference_number,
                                                                                            client_name: load.client_name,
                                                                                            pickup_address: load.pickup_address,
                                                                                            delivery_address: load.delivery_address,
                                                                                            pickup_company: load.pickup_company ?? null,
                                                                                            delivery_company: load.delivery_company ?? null,
                                                                                            revenue: Number(load.revenue),
                                                                                            packages: load.packages,
                                                                                            weight_kg: (load as any).weight_kg ?? null,
                                                                                            weight_lbs: load.weight_lbs ?? null,
                                                                                            package_type: (load as any).package_type ?? null,
                                                                                            service_type: load.service_type,
                                                                                            actual_pickup: load.actual_pickup ?? null,
                                                                                            actual_delivery: load.actual_delivery ?? null,
                                                                                            load_date: load.load_date,
                                                                                            miles: Number(load.miles),
                                                                                            hub: load.hub,
                                                                                        },
                                                                                        driverName(load.driver_id),
                                                                                    );
                                                                                    toast({ title: "📄 Invoice generated", description: `ANIKA-INV-${load.reference_number || load.id.slice(0, 8)} downloaded` });
                                                                                }}
                                                                            >
                                                                                <ReceiptText className="h-3.5 w-3.5" />
                                                                                Generate Invoice
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                        </>
                                                                    )}
                                                                    <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                                                        Change Status
                                                                    </div>
                                                                    <DropdownMenuSeparator />
                                                                    {STATUSES.map((s) => (
                                                                        <DropdownMenuItem
                                                                            key={s.value}
                                                                            className={`text-xs gap-2 ${load.status === s.value ? "bg-muted/50 font-semibold" : ""}`}
                                                                            onClick={() => handleStatusChange(load.id, s.value)}
                                                                        >
                                                                            <span className={`h-2 w-2 rounded-full shrink-0 ${s.color}`} />
                                                                            {s.label}
                                                                            {load.status === s.value && <span className="ml-auto text-[9px] text-muted-foreground">current</span>}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(load.id); }}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={(e) => { e.stopPropagation(); setSelectedLoadDetail(load); }}>
                                                                <ChevronRight className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                                </div>
                            </Card>
                        </div>

                        {/* Tools Sidebar */}
                        {toolsOpen && (
                            <div className="space-y-4">
                                {/* Tool Tabs */}
                                <div className="flex gap-1 flex-wrap">
                                    {([
                                        { key: "quick" as const, label: "New", icon: Plus },
                                        { key: "blast" as const, label: "Blast", icon: Radio },
                                        { key: "import" as const, label: "Import", icon: Layers },
                                        { key: "history" as const, label: "History", icon: History },
                                        { key: "log" as const, label: "Log", icon: FileText },
                                    ] as const).map((tool) => (
                                        <Button
                                            key={tool.key}
                                            variant={activeTool === tool.key ? "default" : "outline"}
                                            size="sm" className="h-7 text-[10px] gap-1"
                                            onClick={() => setActiveTool(tool.key)}
                                        >
                                            <tool.icon className="h-3 w-3" /> {tool.label}
                                        </Button>
                                    ))}
                                </div>

                                {/* Auto-dispatch (shows when triggered from a load row) */}
                                {autoDispatchLoadId && (
                                    <AutoDispatchPanel
                                        loadId={autoDispatchLoadId}
                                        loadPickupAddress={boardLoads.find(l => l.id === autoDispatchLoadId)?.pickup_address}
                                        loadHub={boardLoads.find(l => l.id === autoDispatchLoadId)?.hub}
                                        onAssigned={() => { fetchLoads(); setAutoDispatchLoadId(null); }}
                                        onClose={() => setAutoDispatchLoadId(null)}
                                    />
                                )}

                                {activeTool === "quick" && (
                                    <QuickLoadEntry
                                        loadDate={selectedDate}
                                        hub={boardLoads[0]?.hub}
                                        drivers={drivers.filter(d => d.status === "active").map(d => ({ id: d.id, full_name: d.full_name }))}
                                        onLoadCreated={fetchLoads}
                                        prefill={clonePrefill ?? undefined}
                                    />
                                )}

                                {activeTool === "import" && (
                                    <CSVImportPanel
                                        loadDate={selectedDate}
                                        hub={boardLoads[0]?.hub}
                                        onImportComplete={() => fetchLoads()}
                                    />
                                )}

                                {activeTool === "history" && (
                                    <CustomerOrderHistory
                                        onClone={(load) => {
                                            setClonePrefill(cloneLoadData(load));
                                            setActiveTool("quick");
                                        }}
                                    />
                                )}

                                {activeTool === "blast" && (
                                    <DispatchBlastPanel
                                        loads={boardLoads.map(l => ({
                                            id: l.id,
                                            reference_number: l.reference_number,
                                            client_name: l.client_name,
                                            pickup_address: l.pickup_address,
                                            delivery_address: l.delivery_address,
                                            miles: Number(l.miles),
                                            revenue: Number(l.revenue),
                                            packages: l.packages,
                                            status: l.status,
                                            hub: l.hub,
                                            service_type: l.service_type,
                                        }))}
                                        drivers={drivers.map(d => ({
                                            id: d.id,
                                            full_name: d.full_name,
                                            hub: d.hub,
                                            status: d.status,
                                        }))}
                                        onLoadAssigned={() => fetchLoads()}
                                    />
                                )}

                                {activeTool === "log" && (
                                    <ActivityLog compact />
                                )}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ──────── TAB: WAIT TIME INTELLIGENCE ──────── */}
                <TabsContent value="wait" className="space-y-6">
                    {/* Wait Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Avg Wait (Period)", value: fmtWait(waitAnalytics.avgAll), icon: Clock, color: waitAnalytics.avgAll > 30 ? "text-red-500" : "text-green-500" },
                            { label: "Detention Eligible", value: waitAnalytics.detentionEligible.length, icon: AlertTriangle, color: "text-orange-500" },
                            { label: "Detention Billed", value: fmtMoney(waitAnalytics.detentionBilled), icon: DollarSign, color: "text-green-500" },
                            { label: "Recovery Rate", value: waitAnalytics.detentionEligible.length > 0 ? `${Math.round(waitAnalytics.detentionEligible.filter((l) => l.detention_billed > 0).length / waitAnalytics.detentionEligible.length * 100)}%` : "N/A", icon: BarChart3, color: "text-blue-500" },
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
                                {waitAnalytics.clientWait.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No wait time data yet</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={waitAnalytics.clientWait} layout="vertical">
                                            <XAxis type="number" tick={{ fontSize: 11 }} unit="m" />
                                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                                            <Tooltip formatter={(v: number) => [`${v} min`, "Avg Wait"]} />
                                            <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                                                {waitAnalytics.clientWait.map((_, i) => (
                                                    <Cell key={i} fill={waitAnalytics.clientWait[i].avg >= 30 ? "hsl(0,70%,55%)" : waitAnalytics.clientWait[i].avg >= 15 ? "hsl(40,90%,50%)" : "hsl(140,60%,45%)"} />
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
                                {waitAnalytics.driverWait.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No wait time data yet</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={waitAnalytics.driverWait} layout="vertical">
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
                                <AlertTriangle className="h-4 w-4 text-orange-500" /> Detention-Eligible Loads (≥{DETENTION_THRESHOLD}min)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {waitAnalytics.detentionEligible.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">No detention-eligible loads in this period 🎉</p>
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
                                        {waitAnalytics.detentionEligible.map((l) => (
                                            <TableRow key={l.id}>
                                                <TableCell className="text-sm">{l.load_date}</TableCell>
                                                <TableCell className="font-mono text-xs">{l.reference_number || "—"}</TableCell>
                                                <TableCell className="text-sm">{l.client_name || "—"}</TableCell>
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
                </TabsContent>

                {/* ──────── TAB: DAILY REPORT ──────── */}
                <TabsContent value="report" className="space-y-6">
                    <div className="flex items-center gap-3">
                        <Label className="text-xs text-muted-foreground">Report Date</Label>
                        <Input type="date" className="w-40 h-9" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
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
                            { label: "Profit", value: fmtMoney(dailyReport.profit), sub: dailyReport.profit >= 0 ? "▲" : "▼" },
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
                                                <TableCell className="text-right font-mono text-xs">{d.miles > 0 ? fmtMoney(d.revenue / d.miles) : "—"}</TableCell>
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
                                        <span className="text-lg">{s.label === "Day" ? "☀️" : "🌙"}</span>
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
                </TabsContent>
            </Tabs>

            {/* ═══ ADD / EDIT LOAD DIALOG ═══ */}
            <Dialog open={dialogOpen} onOpenChange={(o) => {
                setDialogOpen(o);
                if (!o) { setEditLoad(null); setAddStep(1); }
            }}>
                <DialogContent className={editLoad ? "max-w-2xl max-h-[90vh] overflow-y-auto" : "max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0"}>

                    {/* ── EDIT MODE: existing compact form ── */}
                    {editLoad && (
                        <>
                            <DialogHeader className="px-6 pt-6">
                                <DialogTitle>Edit Load</DialogTitle>
                                <DialogDescription>Update load details below.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6 overflow-y-auto">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Logistics</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div><Label>Date *</Label><Input name="load_date" type="date" defaultValue={editLoad.load_date ?? selectedDate} /></div>
                                        <div><Label>Shift</Label><Select name="shift" defaultValue={editLoad.shift ?? "day"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SHIFTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                                        <div><Label>Hub</Label><Select name="hub" defaultValue={editLoad.hub ?? "PHX"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{HUBS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent></Select></div>
                                        <div><Label>Reference #</Label><Input name="reference_number" defaultValue={editLoad.reference_number ?? ""} /></div>
                                        <div><Label>Driver</Label><Select name="driver_id" defaultValue={editLoad.driver_id ?? ""}><SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger><SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent></Select></div>
                                        <div><Label>Vehicle</Label><Select name="vehicle_id" defaultValue={editLoad.vehicle_id ?? ""}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicle_name}</SelectItem>)}</SelectContent></Select></div>
                                        <div><Label>Client Name</Label><Input name="client_name" defaultValue={editLoad.client_name ?? ""} /></div>
                                        <div><Label>Service Type</Label><Select name="service_type" defaultValue={editLoad.service_type ?? "standard"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AOG">AOG</SelectItem><SelectItem value="Courier">Courier</SelectItem><SelectItem value="Standard">Standard</SelectItem><SelectItem value="standard">Standard (legacy)</SelectItem><SelectItem value="same_day">Same Day</SelectItem><SelectItem value="rush">Rush</SelectItem></SelectContent></Select></div>
                                        <div><Label>Status</Label><Select name="status" defaultValue={editLoad.status ?? "assigned"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div><Label>Pickup Address</Label><Input name="pickup_address" defaultValue={editLoad.pickup_address ?? ""} /></div>
                                    <div><Label>Delivery Address</Label><Input name="delivery_address" defaultValue={editLoad.delivery_address ?? ""} /></div>
                                    <div><Label>Pickup Company</Label><Input name="pickup_company" defaultValue={editLoad.pickup_company ?? ""} /></div>
                                    <div><Label>Delivery Company</Label><Input name="delivery_company" defaultValue={editLoad.delivery_company ?? ""} /></div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div><Label>Miles</Label><Input name="miles" type="number" step="0.1" defaultValue={editLoad.miles ?? ""} /></div>
                                    <div><Label>Packages</Label><Input name="packages" type="number" defaultValue={editLoad.packages ?? 1} /></div>
                                    <div><Label>Revenue ($)</Label><Input name="revenue" type="number" step="0.01" defaultValue={editLoad.revenue ?? ""} /></div>
                                    <div><Label>Driver Pay ($)</Label><Input name="driver_pay" type="number" step="0.01" defaultValue={editLoad.driver_pay ?? ""} /></div>
                                    <div><Label>Fuel Cost ($)</Label><Input name="fuel_cost" type="number" step="0.01" defaultValue={editLoad.fuel_cost ?? ""} /></div>
                                    <div><Label>Wait (min)</Label><Input name="wait_time_minutes" type="number" defaultValue={editLoad.wait_time_minutes ?? ""} /></div>
                                    <div><Label>Start Time</Label><Input name="start_time" type="time" defaultValue={editLoad.start_time ?? ""} /></div>
                                    <div><Label>End Time</Label><Input name="end_time" type="time" defaultValue={editLoad.end_time ?? ""} /></div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div><Label>PO Number</Label><Input name="po_number" defaultValue={editLoad.po_number ?? ""} /></div>
                                    <div><Label>Description</Label><Input name="description" defaultValue={editLoad.description ?? ""} /></div>
                                    <div><Label>Dimensions</Label><Input name="dimensions_text" defaultValue={editLoad.dimensions_text ?? ""} /></div>
                                    <div><Label>SLA Deadline</Label><Input name="sla_deadline" type="datetime-local" defaultValue={editLoad.sla_deadline?.slice(0, 16) ?? ""} /></div>
                                    <div><Label>Inbound Tracking</Label><Input name="inbound_tracking" defaultValue={editLoad.inbound_tracking ?? ""} /></div>
                                    <div><Label>Outbound Tracking</Label><Input name="outbound_tracking" defaultValue={editLoad.outbound_tracking ?? ""} /></div>
                                </div>
                                <div><Label>Comments</Label><Textarea name="comments" defaultValue={editLoad.comments ?? ""} rows={2} /></div>
                                {/* hidden fields needed by handleSubmit */}
                                <input type="hidden" name="deadhead_miles" value={editLoad.deadhead_miles ?? 0} />
                                <input type="hidden" name="detention_billed" value={editLoad.detention_billed ?? 0} />
                                <input type="hidden" name="shipper_name" value={editLoad.shipper_name ?? ""} />
                                <input type="hidden" name="requested_by" value={editLoad.requested_by ?? ""} />
                                <input type="hidden" name="vehicle_required" value={editLoad.vehicle_required ?? ""} />
                                <input type="hidden" name="inbound_tracking" value={editLoad.inbound_tracking ?? ""} />
                                <input type="hidden" name="outbound_tracking" value={editLoad.outbound_tracking ?? ""} />
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditLoad(null); }}>Cancel</Button>
                                    <Button type="submit" className="btn-gradient">Save Changes</Button>
                                </DialogFooter>
                            </form>
                        </>
                    )}

                    {/* ── ADD MODE: full multi-step form ── */}
                    {!editLoad && (() => {
                        // ── helpers scoped to render ──
                        const af = addForm;
                        const setAf = (patch: Partial<AddLoadForm>) => setAddForm((f) => ({ ...f, ...patch }));

                        // Filtered company list for client search
                        const filteredCompanies = clientSearch.length >= 1
                            ? companies.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8)
                            : companies.slice(0, 6);

                        // Address suggestions: companies + recent addresses
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
                            <>
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0">
                                    <div>
                                        <h2 className="text-lg font-bold tracking-tight">New Load</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">AOG / Courier Dispatch</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setDialogOpen(false)}><X className="h-4 w-4" /></Button>
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
                                                        {done ? "✓" : step}
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

                                    {/* ═══ STEP 1: LOAD INFO ═══ */}
                                    {addStep === 1 && (
                                        <div className="space-y-5">
                                            {/* Reference & Consol */}
                                            <div>
                                                <p className="form-section-label">📋 Load Reference</p>
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
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">Airline cutoff — maximum delivery time before flight is missed</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Client */}
                                            <div>
                                                <p className="form-section-label">🏢 Client</p>
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
                                                <p className="form-section-label">⚡ Service</p>
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
                                                <p className="form-section-label">🚐 Vehicle & Distance</p>
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

                                            {/* ── Anika Live Rate Card ── */}
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
                                                <p className="form-section-label">💵 Revenue</p>
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
                                                                <p className="text-[10px] text-muted-foreground">{af.service_type} · {VEHICLE_TYPES_DISPATCH.find(v => v.value === af.vehicle_type)?.label} · {af.distance_miles || 0} mi</p>
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

                                    {/* ═══ STEP 2: PICKUP & DELIVERY ═══ */}
                                    {addStep === 2 && (
                                        <div className="space-y-5">
                                            {/* PICKUP */}
                                            <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5">
                                                <p className="form-section-label text-green-700 dark:text-green-400">📍 Pickup Location</p>

                                                {/* Address search */}
                                                <div className="relative mt-2">
                                                    <Label className="text-xs">Company / Facility *</Label>
                                                    <div className="relative mt-1">
                                                        <Input value={pickupSearch}
                                                            onChange={(e) => { setPickupSearch(e.target.value); setShowPickupDropdown(true); setAf({ pickup_company: e.target.value }); }}
                                                            onFocus={() => setShowPickupDropdown(true)}
                                                            placeholder="Search or enter company name…"
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
                                                                            const co = companies.find(c => c.id === s.id);
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
                                                            <Input value={af.pickup_open_hours} onChange={(e) => setAf({ pickup_open_hours: e.target.value })} placeholder="09:00–17:00 Mon–Fri" className="mt-1" />
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
                                                <p className="form-section-label text-orange-700 dark:text-orange-400">🏁 Delivery Location</p>

                                                <div className="relative mt-2">
                                                    <Label className="text-xs">Company / Facility *</Label>
                                                    <div className="relative mt-1">
                                                        <Input value={deliverySearch}
                                                            onChange={(e) => { setDeliverySearch(e.target.value); setShowDeliveryDropdown(true); setAf({ delivery_company: e.target.value }); }}
                                                            onFocus={() => setShowDeliveryDropdown(true)}
                                                            placeholder="Search or enter company name…"
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

                                    {/* ═══ STEP 3: CARGO & DRIVER ═══ */}
                                    {addStep === 3 && (
                                        <div className="space-y-5">
                                            {/* Cargo */}
                                            <div>
                                                <p className="form-section-label">📦 Cargo Details</p>
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
                                                        <span className="text-muted-foreground text-sm font-medium shrink-0">×</span>
                                                        <Input type="number" value={af.dim_w} onChange={(e) => setAf({ dim_w: e.target.value })} placeholder="W" className="text-center" />
                                                        <span className="text-muted-foreground text-sm font-medium shrink-0">×</span>
                                                        <Input type="number" value={af.dim_h} onChange={(e) => setAf({ dim_h: e.target.value })} placeholder="H" className="text-center" />
                                                    </div>
                                                    {cubic > 0 && (
                                                        <p className="text-xs text-muted-foreground mt-1.5">
                                                            Cubic: <strong>{cubic.toLocaleString()} cm³</strong>
                                                            {af.weight_kg && <> · Dim wt: <strong>{(cubic / 5000).toFixed(1)} kg</strong></>}
                                                            {af.dimensions_text && <> · <span className="font-mono">{af.dimensions_text}</span></>}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="mt-3">
                                                    <Label className="text-xs">Cargo Description</Label>
                                                    <Input value={af.description} onChange={(e) => setAf({ description: e.target.value })} placeholder="e.g. CIVIL AIRCRAFT PART — LH ENGINE SEAL" className="mt-1" />
                                                </div>
                                            </div>

                                            {/* ── Anika Price Modifiers ── */}
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
                                                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">⏰ Time &amp; Access</p>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {[
                                                                    { key: "afterHours" as const, label: "After Hours (20:00–07:59)", price: 25 },
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
                                                                        onClick={() => setMod({ additionalStops: Math.max(0, anikaModifiers.additionalStops - 1) })}>−</Button>
                                                                    <span className="text-sm font-mono w-5 text-center">{anikaModifiers.additionalStops}</span>
                                                                    <Button type="button" variant="outline" size="icon" className="h-6 w-6"
                                                                        onClick={() => setMod({ additionalStops: anikaModifiers.additionalStops + 1 })}>+</Button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <Separator />

                                                        {/* Accessorial Services */}
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">📋 Accessorial Services</p>
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
                                                                            onClick={() => setMod({ [key]: Math.max(0, (anikaModifiers[key] as number) - 1) })}>−</Button>
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
                                                <p className="form-section-label">🚗 Driver Assignment <span className="text-red-500">*</span></p>
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
                                                                    <p className="text-xs text-muted-foreground capitalize">{d.hub} hub · {d.status}</p>
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
                                                <p className="form-section-label">📄 BOL Document</p>
                                                <div className="mt-1">
                                                    <input ref={bolInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setBolFile(f); }} />
                                                    {!bolFile ? (
                                                        <button type="button" onClick={() => bolInputRef.current?.click()}
                                                            className="w-full p-4 border-2 border-dashed border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center gap-2 text-muted-foreground">
                                                            <Upload className="h-5 w-5" />
                                                            <p className="text-sm">Click to upload BOL (PDF / image)</p>
                                                            <p className="text-xs">Optional — can be added later</p>
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20">
                                                            <FileText className="h-5 w-5 text-primary shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">{bolFile.name}</p>
                                                                <p className="text-xs text-muted-foreground">{(bolFile.size / 1024).toFixed(0)} KB</p>
                                                            </div>
                                                            {bolUploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>}
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
                                                    <span className="text-muted-foreground">Ref #</span><span className="font-mono font-medium">{af.reference_number || "—"}</span>
                                                    <span className="text-muted-foreground">Client</span><span className="font-medium truncate">{af.client_name || "—"}</span>
                                                    <span className="text-muted-foreground">Service</span><span>{af.service_type}</span>
                                                    <span className="text-muted-foreground">Revenue</span>
                                                    <span className="font-semibold text-green-600">
                                                        ${af.revenue ? parseFloat(af.revenue).toFixed(2) : computedRevenue ? computedRevenue.toFixed(2) : "0.00"}
                                                    </span>
                                                    <span className="text-muted-foreground">Pickup</span><span className="truncate">{af.pickup_company || af.pickup_address || "—"}</span>
                                                    <span className="text-muted-foreground">Delivery</span><span className="truncate">{af.delivery_company || af.delivery_address || "—"}</span>
                                                    <span className="text-muted-foreground">Driver</span><span>{drivers.find(d => d.id === af.driver_id)?.full_name || <span className="text-red-500">Not assigned</span>}</span>
                                                    <span className="text-muted-foreground">BOL</span><span>{bolFile ? bolFile.name : "—"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Footer nav */}
                                <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10 shrink-0">
                                    <Button variant="outline" size="sm" className="gap-1.5"
                                        onClick={() => addStep > 1 ? setAddStep(addStep - 1) : setDialogOpen(false)}>
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
                                                {bolUploading ? "Uploading…" : <><Plus className="h-4 w-4" /> Create Load</>}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Blast Load Dialog */}
            <BlastLoadDialog
                open={!!blastDialogLoad}
                onOpenChange={(open) => { if (!open) setBlastDialogLoad(null); }}
                load={blastDialogLoad ? {
                    id: blastDialogLoad.id,
                    reference_number: blastDialogLoad.reference_number ?? null,
                    client_name: blastDialogLoad.client_name ?? null,
                    pickup_address: blastDialogLoad.pickup_address ?? null,
                    delivery_address: blastDialogLoad.delivery_address ?? null,
                    miles: Number(blastDialogLoad.miles),
                    revenue: Number(blastDialogLoad.revenue),
                    packages: blastDialogLoad.packages ?? 0,
                    status: blastDialogLoad.status,
                    hub: blastDialogLoad.hub ?? "",
                    service_type: blastDialogLoad.service_type ?? "",
                } : null}
                onBlastSent={(_blastId, driverCount) => {
                    toast({ title: `📡 Blast sent to ${driverCount} driver${driverCount !== 1 ? "s" : ""}` });
                    fetchLoads();
                    setBlastDialogLoad(null);
                }}
            />

            {/* Delete Confirmation */}
            {
                deleteId && (
                    <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Delete Load?</DialogTitle>
                                <DialogDescription>This action cannot be undone.</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                                <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )
            }

            {/* Load Detail Slide-Over */}
            {selectedLoadDetail && (
                <Suspense fallback={<div className="fixed inset-y-0 right-0 w-[520px] bg-background border-l border-border/50 flex items-center justify-center"><span className="text-muted-foreground text-sm animate-pulse">Loading…</span></div>}>
                    <LoadDetailPanel
                        load={selectedLoadDetail as LoadDetail}
                        driverName={driverName(selectedLoadDetail.driver_id)}
                        vehicleName={vehicleName(selectedLoadDetail.vehicle_id)}
                        dispatcherName={dispatcherName(selectedLoadDetail.dispatcher_id)}
                        onClose={() => setSelectedLoadDetail(null)}
                        onStatusChange={(id, status) => { handleStatusChange(id, status); setSelectedLoadDetail(null); }}
                        onEdit={(load) => { setEditLoad(load as Load); setDialogOpen(true); setSelectedLoadDetail(null); }}
                        onRefresh={() => { fetchLoads(); setSelectedLoadDetail(null); }}
                    />
                </Suspense>
            )}
        </div>
    );
}
