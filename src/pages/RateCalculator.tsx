import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CITY_HUBS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Calculator, Truck, MapPin, Copy, Save, Loader2, ClipboardCheck,
    Navigation, ArrowRight, Mail, Package, Send, Percent,
    CheckCircle2, XCircle, AlertTriangle, Car, Ruler, Clock,
} from "lucide-react";
import MarketComparison from "@/components/MarketComparison";

// ─── Types ─────────────────────────────────────────
type RateCard = {
    id: string; hub: string; service_type: string; vehicle_type: string;
    base_rate: number; per_mile_rate: number; per_lb_rate: number;
    min_charge: number; fuel_surcharge_pct: number;
    included_miles: number; weight_threshold_lbs: number;
};

type SavedQuote = {
    id: string; hub: string; service_type: string; vehicle_type: string;
    distance_miles: number; weight_lbs: number; stops: number;
    total_quote: number; margin_pct: number; notes: string | null;
    created_at: string; lead_id: string | null;
};

// Vehicle options — only Cargo Van and Box Truck per rate sheet
const VEHICLES = [
    { value: "cargo_van", label: "Cargo Van" },
    { value: "box_truck", label: "Box Truck" },
] as const;

// ─── FLEET SPECS: exact cargo dimensions per hub ──────────
// Used by the Vehicle Fit Checker to determine which vehicles can carry the cargo
type FleetVehicle = {
    name: string;
    make: string;
    type: "car" | "cargo_van" | "box_truck";
    cargoL: number; // interior cargo length (inches)
    cargoW: number; // interior cargo width at narrowest usable point (inches)
    cargoH: number; // interior cargo height (inches)
    doorW: number;  // rear door opening width (inches)
    doorH: number;  // rear door opening height (inches)
    maxPayload: number; // max payload in lbs
};

const FLEET_SPECS: Record<string, FleetVehicle[]> = {
    phoenix: [
        {
            name: "Kia Optima 2017",
            make: "Kia",
            type: "car",
            cargoL: 38, cargoW: 45, cargoH: 18,
            doorW: 45, doorH: 18,
            maxPayload: 900,
        },
        {
            name: "Chevy Express 2500",
            make: "Chevrolet",
            type: "cargo_van",
            // From the dimension diagram: Regular 135" WB
            cargoL: 112, cargoW: 52, cargoH: 48,
            doorW: 50, doorH: 44,
            maxPayload: 3280,
        },
    ],
    la: [
        {
            name: "Toyota Corolla 2025",
            make: "Toyota",
            type: "car",
            cargoL: 37, cargoW: 42, cargoH: 18,
            doorW: 42, doorH: 18,
            maxPayload: 850,
        },
        {
            name: "Ram ProMaster 2500 HR",
            make: "Ram",
            type: "cargo_van",
            // High Roof, Regular 136" WB
            cargoL: 123, cargoW: 56, cargoH: 76,
            doorW: 61, doorH: 65,
            maxPayload: 4000,
        },
    ],
};

// ─── OFFICIAL ANIKA RATE SHEET (hardcoded fallback) ─────────
// These are the EXACT rates from the PHX & LAX Local Rate Sheet
// Effective: 01/26 – 12/26
// Used as fallback if database hasn't been updated yet
const RATE_SHEET: Record<string, Omit<RateCard, "id" | "hub" | "service_type" | "vehicle_type">> = {
    cargo_van: {
        base_rate: 105,           // $105.00 — first 20 miles pickup to destination
        per_mile_rate: 2.00,      // $2.00/mile — additional miles AND deadhead miles
        per_lb_rate: 0.10,        // $0.10 per lb over 100 lbs
        min_charge: 105,
        fuel_surcharge_pct: 25,   // 25%
        included_miles: 20,       // first 20 miles included
        weight_threshold_lbs: 100, // over 100 lbs
    },
    box_truck: {
        base_rate: 170,           // $170.00 — first 20 miles pickup to destination
        per_mile_rate: 2.50,      // $2.50/mile — additional miles AND deadhead miles
        per_lb_rate: 0.15,        // $0.15 per lb over 600 lbs
        min_charge: 170,
        fuel_surcharge_pct: 25,   // 25%
        included_miles: 20,       // first 20 miles included
        weight_threshold_lbs: 600, // over 600 lbs
    },
};

// Accessorial surcharges from Anika rate sheet (exact amounts from document)
const ACCESSORIALS = [
    { key: "airport", label: "Tendering Fee (airport only)", amount: 15, description: "Airport delivery or pickup" },
    { key: "after_hours", label: "After Hours (20:00–07:59)", amount: 25, description: "Delivery outside business hours" },
    { key: "weekend", label: "Weekend (Saturday & Sunday)", amount: 25, description: "Saturday or Sunday delivery" },
    { key: "holiday", label: "Holiday Surcharge", amount: 50, description: "Recognized holiday delivery" },
    { key: "attempt", label: "Attempt Charge", amount: 0, description: "Failed delivery — charges Base Rate" },
    { key: "extra_stop", label: "Additional Stop", amount: 50, description: "Each additional stop beyond one" },
    { key: "extra_piece", label: "Extra Piece (per piece)", amount: 15, description: "Additional pieces beyond first" },
    { key: "special_handling", label: "Special Handling", amount: 20, description: "Fragile or special care items" },
    { key: "documents", label: "Documents", amount: 20, description: "BOL, POD, or other documentation" },
    { key: "second_person", label: "2nd Person Ride-Along (flat)", amount: 100, description: "Additional helper on the truck" },
    { key: "white_glove", label: "White Glove Service", amount: 50, description: "Inside delivery, unpack, setup" },
    { key: "hazmat", label: "Dangerous Goods / Hazmat", amount: 50, description: "Per shipment" },
    { key: "holding", label: "Holding (per day, per unit)", amount: 50, description: "Storage per day" },
] as const;

// ─── Component ─────────────────────────────────────
export default function RateCalculator() {
    const { user } = useAuth();
    const { toast } = useToast();

    // Rate cards
    const [rateCards, setRateCards] = useState<RateCard[]>([]);
    const [loadingCards, setLoadingCards] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Quote builder inputs
    const [hub, setHub] = useState("phoenix");
    const [vehicleType, setVehicleType] = useState("cargo_van");
    const [distance, setDistance] = useState<number>(32);
    const [weight, setWeight] = useState<number>(750);

    // Addresses
    const [pickupAddress, setPickupAddress] = useState("");
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [calcDistanceLoading, setCalcDistanceLoading] = useState(false);

    // Cargo details
    const [cargoPieces, setCargoPieces] = useState("1 skid");
    const [cargoL, setCargoL] = useState(0); // inches
    const [cargoW, setCargoW] = useState(0); // inches
    const [cargoH, setCargoH] = useState(0); // inches
    const [cargoNotes, setCargoNotes] = useState("");

    // Accessorial toggles
    const [enabledAccessorials, setEnabledAccessorials] = useState<Record<string, boolean>>({});
    const [extraStopCount, setExtraStopCount] = useState(1);
    const [extraPieceCount, setExtraPieceCount] = useState(1);
    const [holdingDays, setHoldingDays] = useState(1);
    const [waitTimeBlocks, setWaitTimeBlocks] = useState(0);
    const [deadheadMiles, setDeadheadMiles] = useState(0);

    // Pickup datetime (for after-hours / weekend auto-detection)
    const [pickupDatetime, setPickupDatetime] = useState("");

    // Quote history
    const [history, setHistory] = useState<SavedQuote[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // UI state
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailTo, setEmailTo] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);

    // Win Client mode
    const [winClientMode, setWinClientMode] = useState(false);
    const [discountPct, setDiscountPct] = useState(20);

    // ─── Toggle accessorial ──────────────────────────
    const toggleAccessorial = (key: string) => {
        setEnabledAccessorials((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // ─── Auto-detect after-hours / weekend from pickup datetime ──────────
    const handlePickupDatetimeChange = (value: string) => {
        setPickupDatetime(value);
        if (!value) return;
        const dt = new Date(value);
        const hours = dt.getHours(); // local hours
        const day = dt.getDay();     // 0=Sun, 6=Sat
        // After hours: 20:00–07:59
        const isAfterHours = hours >= 20 || hours < 8;
        // Weekend: Saturday (6) or Sunday (0)
        const isWeekend = day === 0 || day === 6;
        setEnabledAccessorials((prev) => ({
            ...prev,
            after_hours: isAfterHours,
            weekend: isWeekend,
        }));
    };

    // ─── Fetch ─────────────────────────────────────
    const fetchRateCards = useCallback(async () => {
        try {
            const { data, error } = await supabase.from("rate_cards").select("*").order("hub");
            if (error) {
                setFetchError(`rate_cards: ${error.message}. Run the migration SQL.`);
            } else {
                const parsed = (data ?? []).map((c: any) => ({
                    ...c,
                    base_rate: Number(c.base_rate) || 0,
                    per_mile_rate: Number(c.per_mile_rate) || 0,
                    per_lb_rate: Number(c.per_lb_rate) || 0,
                    min_charge: Number(c.min_charge) || 0,
                    fuel_surcharge_pct: Number(c.fuel_surcharge_pct) || 0,
                    included_miles: Number(c.included_miles) || 0,
                    weight_threshold_lbs: Number(c.weight_threshold_lbs) || 0,
                })) as RateCard[];
                setRateCards(parsed);
                setFetchError(parsed.length === 0 ? "rate_cards table is empty — run the migration SQL." : null);
            }
        } catch (err: any) {
            setFetchError(err.message);
        }
        setLoadingCards(false);
    }, []);

    const fetchHistory = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("saved_quotes").select("*")
                .order("created_at", { ascending: false }).limit(15);
            if (!error && data) {
                setHistory(data.map((q: any) => ({
                    ...q,
                    distance_miles: Number(q.distance_miles) || 0,
                    weight_lbs: Number(q.weight_lbs) || 0,
                    stops: Number(q.stops) || 1,
                    total_quote: Number(q.total_quote) || 0,
                    margin_pct: Number(q.margin_pct) || 0,
                })) as SavedQuote[]);
            }
        } catch { /* Silently handle history load error */ }
        setLoadingHistory(false);
    }, []);

    useEffect(() => { fetchRateCards(); fetchHistory(); }, [fetchRateCards, fetchHistory]);

    // ─── Address Distance Calc ─────────────────────
    const calculateDistance = async () => {
        if (!pickupAddress.trim() || !deliveryAddress.trim()) {
            toast({ title: "Enter both addresses", variant: "destructive" });
            return;
        }
        setCalcDistanceLoading(true);
        try {
            const geocode = async (addr: string) => {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`,
                    { headers: { "User-Agent": "AnikalogisticsCRM/1.0" } }
                );
                const data = await res.json();
                if (!data.length) throw new Error(`Address not found: ${addr}`);
                return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            };
            const [p, d] = await Promise.all([geocode(pickupAddress), geocode(deliveryAddress)]);
            const routeRes = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${p.lon},${p.lat};${d.lon},${d.lat}?overview=false`
            );
            const routeData = await routeRes.json();
            if (routeData.code === "Ok" && routeData.routes?.length) {
                const miles = Math.round(routeData.routes[0].distance / 1609.344);
                setDistance(miles);
                toast({ title: `📍 ${miles} miles driving distance` });
            } else {
                const R = 3959;
                const dLat = (d.lat - p.lat) * Math.PI / 180;
                const dLon = (d.lon - p.lon) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * Math.PI / 180) * Math.cos(d.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                const est = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3);
                setDistance(est);
                toast({ title: `📍 ~${est} miles (estimated)` });
            }
        } catch (err: any) {
            toast({ title: "Distance lookup failed", description: err.message, variant: "destructive" });
        }
        setCalcDistanceLoading(false);
    };

    // ─── Pricing Calc ──────────────────────────────
    // For PHX and LAX, ALWAYS use the official rate sheet values (hardcoded).
    // The database may have old/wrong values if migration hasn't been applied.
    // For Atlanta (or future hubs), fall back to database.
    const activeCard = useMemo(() => {
        const isPhxOrLax = hub === "phoenix" || hub === "la";
        const fallback = RATE_SHEET[vehicleType];

        if (isPhxOrLax && fallback) {
            // Use hardcoded rate sheet — always correct
            const dbCard = rateCards.find((c) => c.hub === hub && c.service_type === "last_mile" && c.vehicle_type === vehicleType);
            return {
                id: dbCard?.id ?? "rate-sheet-fallback",
                hub,
                service_type: "last_mile",
                vehicle_type: vehicleType,
                ...fallback,
            } as RateCard;
        }

        // For other hubs, use database values
        return rateCards.find((c) => c.hub === hub && c.service_type === "last_mile" && c.vehicle_type === vehicleType) ?? null;
    }, [rateCards, hub, vehicleType]);

    const quote = useMemo(() => {
        if (!activeCard) return null;

        // Transportation charges (subject to fuel surcharge)
        const billableMiles = Math.max(0, distance - activeCard.included_miles);
        const excessMileage = billableMiles * activeCard.per_mile_rate;
        const deadheadCharge = deadheadMiles * activeCard.per_mile_rate; // base to pickup
        const billableWeight = Math.max(0, weight - activeCard.weight_threshold_lbs);
        const weightSurcharge = billableWeight * activeCard.per_lb_rate;
        const transportation = activeCard.base_rate + excessMileage + deadheadCharge + weightSurcharge;

        // Fuel surcharge — 25% of TRANSPORTATION only (not accessorials)
        const fuelSurcharge = transportation * (activeCard.fuel_surcharge_pct / 100);

        // Accessorial charges (NOT subject to fuel surcharge)
        let accessorialTotal = 0;
        const accessorialItems: { label: string; detail: string; amount: number }[] = [];

        ACCESSORIALS.forEach((acc) => {
            if (!enabledAccessorials[acc.key]) return;
            let amt = acc.amount as number;
            let detail: string = acc.description;
            if (acc.key === "attempt") {
                amt = activeCard.base_rate; // Attempt Charge = Base Rate
                detail = `Failed delivery — Base Rate`;
            }
            if (acc.key === "extra_stop") {
                amt = 50 * extraStopCount;
                detail = `${extraStopCount} × $50`;
            }
            if (acc.key === "extra_piece") {
                amt = 15 * extraPieceCount;
                detail = `${extraPieceCount} piece(s) × $15`;
            }
            if (acc.key === "holding") {
                amt = 50 * holdingDays;
                detail = `${holdingDays} day(s) × $50`;
            }
            accessorialTotal += amt;
            accessorialItems.push({ label: acc.label, detail, amount: amt });
        });
        if (waitTimeBlocks > 0) {
            const wtAmt = waitTimeBlocks * 30;
            accessorialTotal += wtAmt;
            accessorialItems.push({ label: "Wait Time", detail: `${waitTimeBlocks} × 15 min @ $30 (first 15 free)`, amount: wtAmt });
        }

        const total = transportation + fuelSurcharge + accessorialTotal;

        return {
            baseRate: activeCard.base_rate,
            includedMiles: activeCard.included_miles,
            billableMiles,
            excessMileage: +excessMileage.toFixed(2),
            deadheadMiles: deadheadMiles,
            deadheadCharge: +deadheadCharge.toFixed(2),
            weightThreshold: activeCard.weight_threshold_lbs,
            billableWeight,
            weightSurcharge: +weightSurcharge.toFixed(2),
            transportation: +transportation.toFixed(2),
            fuelPct: activeCard.fuel_surcharge_pct,
            fuelSurcharge: +fuelSurcharge.toFixed(2),
            accessorialItems,
            accessorialTotal: +accessorialTotal.toFixed(2),
            total: +total.toFixed(2),
        };
    }, [activeCard, distance, weight, deadheadMiles, enabledAccessorials, extraStopCount, extraPieceCount, holdingDays, waitTimeBlocks]);

    // ─── Format quote text (for copy/email) ────────
    const vehicleLabel = VEHICLES.find((v) => v.value === vehicleType)?.label ?? vehicleType;
    const hubLabel = CITY_HUBS.find((h) => h.value === hub)?.label ?? hub;

    const buildQuoteText = (html: boolean) => {
        if (!quote || !activeCard) return "";
        const br = html ? "<br/>" : "\n";
        const bold = (s: string) => html ? `<strong>${s}</strong>` : s;
        const line = html ? "<hr style='border:1px solid #e5e7eb;margin:8px 0'/>" : "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
        const fmt = (n: number) => `$${n.toFixed(2)}`;

        const lines = [
            bold("ANIKA LOGISTICS — RATE QUOTE"),
            `Hub: ${hubLabel}`,
            line,
            "",
            bold("PICK UP:"),
            pickupAddress || "(Not specified)",
            "",
            bold("DELIVERY:"),
            deliveryAddress || "(Not specified)",
            "",
            bold("CARGO DETAILS:"),
            `${cargoPieces}${weight ? ` @ ${weight} lbs` : ""}${(cargoL && cargoW && cargoH) ? ` ${cargoL}×${cargoW}×${cargoH} in` : ""}`,
            cargoNotes ? cargoNotes : "",
            "",
            line,
            "",
            html ? "<table style='width:100%;border-collapse:collapse;font-family:monospace;font-size:14px'>" : "",
            html
                ? "<tr style='border-bottom:2px solid #333'><th style='text-align:left;padding:4px 8px'>Line Item</th><th style='text-align:left;padding:4px 8px'>Source Logic</th><th style='text-align:right;padding:4px 8px'>Cost</th></tr>"
                : `Line Item                Source Logic                     Cost`,
            html ? "" : "─────────────────────────────────────────────────────────────",
        ];

        const addRow = (item: string, logic: string, cost: string) => {
            if (html) {
                lines.push(`<tr><td style='padding:4px 8px'>${item}</td><td style='padding:4px 8px'>${logic}</td><td style='text-align:right;padding:4px 8px'>${cost}</td></tr>`);
            } else {
                lines.push(`${item.padEnd(25)} ${logic.padEnd(35)} ${cost}`);
            }
        };

        addRow(`Base Rate (${vehicleLabel})`, `First ${quote.includedMiles} miles`, fmt(quote.baseRate));
        if (quote.billableMiles > 0) {
            addRow("Excess Mileage", `${quote.billableMiles} mi × ${fmt(activeCard.per_mile_rate)}/mi`, fmt(quote.excessMileage));
        }
        if (quote.deadheadMiles > 0) {
            addRow("Deadhead Miles", `${quote.deadheadMiles} mi × ${fmt(activeCard.per_mile_rate)}/mi`, fmt(quote.deadheadCharge));
        }
        if (quote.billableWeight > 0) {
            addRow("Weight Surcharge", `${weight} lbs - ${quote.weightThreshold} lbs = ${quote.billableWeight} lbs @ ${fmt(activeCard.per_lb_rate)}/lb`, fmt(quote.weightSurcharge));
        }
        quote.accessorialItems.forEach((a) => {
            addRow(a.label, a.detail, fmt(a.amount));
        });
        addRow("Fuel Surcharge", `${quote.fuelPct}% of Transportation (${fmt(quote.transportation)})`, fmt(quote.fuelSurcharge));

        if (html) {
            lines.push(`<tr style='border-top:2px solid #333;font-weight:bold'><td style='padding:8px' colspan='2'>TOTAL QUOTE</td><td style='text-align:right;padding:8px;font-size:18px${winClientMode ? ';text-decoration:line-through;color:#888;font-size:14px' : ''}'>${fmt(quote.total)}</td></tr>`);
            if (winClientMode) {
                const discountAmt = quote.total * discountPct / 100;
                const discountedTotal = quote.total - discountAmt;
                lines.push(`<tr style='color:#22c55e'><td style='padding:4px 8px'>Win Client Discount</td><td style='padding:4px 8px'>${discountPct}% off</td><td style='text-align:right;padding:4px 8px'>-${fmt(discountAmt)}</td></tr>`);
                lines.push(`<tr style='border-top:2px solid #22c55e;font-weight:bold;color:#22c55e'><td style='padding:8px' colspan='2'>DISCOUNTED TOTAL</td><td style='text-align:right;padding:8px;font-size:18px'>${fmt(discountedTotal)}</td></tr>`);
            }
            lines.push("</table>");
        } else {
            lines.push("─────────────────────────────────────────────────────────────");
            lines.push(`TOTAL QUOTE                                          ${fmt(quote.total)}`);
            if (winClientMode) {
                const discountAmt = quote.total * discountPct / 100;
                const discountedTotal = quote.total - discountAmt;
                lines.push(`Win Client Discount      ${discountPct}% off                            -${fmt(discountAmt)}`);
                lines.push("─────────────────────────────────────────────────────────────");
                lines.push(`DISCOUNTED TOTAL                                     ${fmt(discountedTotal)}`);
            }
        }

        return lines.filter((l) => l !== undefined).join(br);
    };

    // ─── Copy ──────────────────────────────────────
    const handleCopy = () => {
        navigator.clipboard.writeText(buildQuoteText(false));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Copied!", description: "Quote copied to clipboard" });
    };

    // ─── Save ──────────────────────────────────────
    const handleSave = async () => {
        if (!quote || !user) return;
        setSaving(true);
        const finalTotal = winClientMode ? quote.total * (1 - discountPct / 100) : quote.total;
        const noteParts = [`${vehicleLabel}`, `${pickupAddress} → ${deliveryAddress}`, cargoPieces];
        if (winClientMode) noteParts.push(`Win Client ${discountPct}% off`);
        const { error } = await supabase.from("saved_quotes").insert({
            hub, service_type: "last_mile", vehicle_type: vehicleType,
            distance_miles: distance, weight_lbs: weight, stops: 1,
            base_rate: quote.baseRate, mileage_charge: quote.excessMileage,
            weight_charge: quote.weightSurcharge, fuel_surcharge: quote.fuelSurcharge,
            stop_fee: 0, total_quote: finalTotal, margin_pct: winClientMode ? discountPct : 0,
            notes: noteParts.join(" | "),
            lead_id: null, created_by: user.id,
        });
        if (error) {
            toast({ title: "Save failed", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "💰 Quote Saved!", description: `$${finalTotal.toFixed(2)}` });
            fetchHistory();
        }
        setSaving(false);
    };

    // ─── Email Quote ───────────────────────────────
    const handleSendEmail = async () => {
        if (!emailTo.trim() || !quote) return;
        setSendingEmail(true);
        try {
            const htmlBody = `
                <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:650px;margin:0 auto;padding:20px;background:#f9fafb;border-radius:12px">
                    <div style="background:#1a1a2e;color:white;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center">
                        <h2 style="margin:0;font-size:20px">ANIKA LOGISTICS</h2>
                        <p style="margin:4px 0 0;font-size:12px;opacity:0.8">Rate Quote — ${hubLabel}</p>
                    </div>
                    <div style="background:white;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
                        ${buildQuoteText(true)}
                        <p style="margin-top:20px;font-size:11px;color:#888">
                            Generated on ${new Date().toLocaleDateString()} • Rates effective 01/26–12/26 • All rates USD • Fuel surcharge subject to change
                        </p>
                    </div>
                </div>`;

            const { data: { session } } = await supabase.auth.getSession();
            const emailTotal = winClientMode ? quote.total * (1 - discountPct / 100) : quote.total;
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || "https://vdsknsypobnutnqcafre.supabase.co"}/functions/v1/send-outreach-email`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                    to: emailTo,
                    subject: `Anika Logistics Quote — ${vehicleLabel} ${hubLabel} — $${emailTotal.toFixed(2)}`,
                    body: htmlBody,
                    from: "Anika Logistics <quotes@leads.anikalogistics.com>",
                }),
            });
            const result = await res.json();
            if (result.success) {
                toast({ title: "📧 Quote Sent!", description: `Sent to ${emailTo}` });
                setEmailDialogOpen(false);
                setEmailTo("");
            } else {
                toast({ title: "Email failed", description: result.error, variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: "Email failed", description: err.message, variant: "destructive" });
        }
        setSendingEmail(false);
    };

    const fmt = (n: number) => `$${n.toFixed(2)}`;

    // ─── Loading / Error ───────────────────────────
    if (loadingCards) {
        return (
            <div className="space-y-4 animate-in">
                <Skeleton className="h-8 w-48 shimmer" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-[500px] shimmer rounded-xl" />
                    <Skeleton className="h-[500px] shimmer rounded-xl" />
                </div>
            </div>
        );
    }

    // fetchError only blocks non-PHX/LAX hubs (PHX & LAX use hardcoded rate sheet as fallback)
    const isHardcodedHub = hub === "phoenix" || hub === "la";
    if (fetchError && !isHardcodedHub) {
        return (
            <div className="space-y-4 animate-in">
                <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
                    <Calculator className="h-6 w-6" /> Rate Calculator
                </h1>
                <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="py-6 text-center space-y-3">
                        <p className="text-red-500 font-semibold">⚠️ {fetchError}</p>
                        <p className="text-xs text-muted-foreground">
                            Paste <code className="text-accent">supabase/migrations/20260212220000_update_rate_sheet.sql</code> in your Supabase SQL Editor
                        </p>
                        <Button variant="outline" size="sm" onClick={() => { setLoadingCards(true); setFetchError(null); fetchRateCards(); }}>
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight gradient-text flex items-center gap-2">
                    <Calculator className="h-6 w-6" /> Rate Calculator
                </h1>
                <p className="text-muted-foreground text-sm mt-1">PHX & LAX Courier Rates — Cargo Van & Box Truck</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* ─── LEFT: Quote Builder (3 cols) ─────── */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Hub + Vehicle */}
                    <Card className="glass-card">
                        <CardContent className="pt-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> City Hub
                                    </Label>
                                    <Select value={hub} onValueChange={setHub}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {CITY_HUBS.map((h) => (
                                                <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Truck className="h-3 w-3" /> Vehicle Type
                                    </Label>
                                    <Select value={vehicleType} onValueChange={setVehicleType}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {VEHICLES.map((v) => (
                                                <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Addresses */}
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-2 items-end">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Pickup Address</Label>
                                    <Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)}
                                        placeholder="e.g. 4189 Temple City Blvd, El Monte CA" />
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block mb-2" />
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Delivery Address</Label>
                                    <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                                        placeholder="e.g. EK Airline in LAX" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" size="sm" onClick={calculateDistance} disabled={calcDistanceLoading} className="gap-2">
                                    {calcDistanceLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
                                    Calculate Distance
                                </Button>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground">or manual:</Label>
                                    <Input type="number" min={0} value={distance} onChange={(e) => setDistance(Math.max(0, +e.target.value))}
                                        className="w-24 text-center" />
                                    <span className="text-xs text-muted-foreground">miles</span>
                                </div>
                            </div>
                            {/* Deadhead Miles */}
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Deadhead Miles (base to pickup):</Label>
                                <Input type="number" min={0} value={deadheadMiles} onChange={(e) => setDeadheadMiles(Math.max(0, +e.target.value))}
                                    className="w-24 text-center" />
                                <span className="text-xs text-muted-foreground">miles</span>
                                {deadheadMiles > 0 && activeCard && <span className="text-xs text-accent font-mono">+${(deadheadMiles * activeCard.per_mile_rate).toFixed(2)}</span>}
                            </div>

                            {/* Pickup Date & Time */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Pickup Date & Time
                                    <span className="text-[10px] opacity-70">(auto-detects after hours & weekend)</span>
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="datetime-local"
                                        value={pickupDatetime}
                                        onChange={(e) => handlePickupDatetimeChange(e.target.value)}
                                        className="flex-1"
                                    />
                                    {pickupDatetime && (
                                        <div className="flex gap-1">
                                            {enabledAccessorials["after_hours"] && (
                                                <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/50">After Hours</Badge>
                                            )}
                                            {enabledAccessorials["weekend"] && (
                                                <Badge variant="outline" className="text-[10px] text-orange-500 border-orange-500/50">Weekend</Badge>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Cargo Details */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Package className="h-3 w-3" /> Cargo Details
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Pieces / Type</Label>
                                        <Input value={cargoPieces} onChange={(e) => setCargoPieces(e.target.value)} placeholder="e.g. 2 skids" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Weight (lbs)</Label>
                                        <Input type="number" min={0} value={weight} onChange={(e) => setWeight(Math.max(0, +e.target.value))} placeholder="0" />
                                    </div>
                                </div>
                                <Label className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                                    <Ruler className="h-3 w-3" /> Cargo Dimensions (inches)
                                </Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Length</Label>
                                        <Input type="number" min={0} value={cargoL || ""} onChange={(e) => setCargoL(Math.max(0, +e.target.value))} placeholder="L" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Width</Label>
                                        <Input type="number" min={0} value={cargoW || ""} onChange={(e) => setCargoW(Math.max(0, +e.target.value))} placeholder="W" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Height</Label>
                                        <Input type="number" min={0} value={cargoH || ""} onChange={(e) => setCargoH(Math.max(0, +e.target.value))} placeholder="H" />
                                    </div>
                                </div>
                            </div>

                            {/* Vehicle Fit Checker */}
                            {(() => {
                                const fleet = FLEET_SPECS[hub] ?? [];
                                const hasDims = cargoL > 0 || cargoW > 0 || cargoH > 0 || weight > 0;
                                if (!hasDims || fleet.length === 0) return null;

                                return (
                                    <div className="space-y-1.5 pt-1">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Truck className="h-3 w-3" /> Vehicle Fit Check — {CITY_HUBS.find(h => h.value === hub)?.label}
                                        </Label>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {fleet.map((v) => {
                                                const issues: string[] = [];
                                                let status = "fits" as "fits" | "tight" | "no_fit";
                                                const fail = (msg: string) => { issues.push(msg); status = "no_fit"; };
                                                const warn = (msg: string) => { issues.push(msg); if (status === "fits") status = "tight"; };

                                                // Dimension checks
                                                if (cargoL > 0) {
                                                    if (cargoL > v.cargoL) fail(`Too long (${cargoL}" > ${v.cargoL}")`);
                                                    else if (cargoL > v.cargoL * 0.9) warn(`Length tight (${cargoL}" / ${v.cargoL}")`);
                                                }
                                                if (cargoW > 0) {
                                                    if (cargoW > v.cargoW) fail(`Too wide (${cargoW}" > ${v.cargoW}")`);
                                                    else if (cargoW > v.doorW) fail(`Won't fit through door (${cargoW}" > ${v.doorW}" opening)`);
                                                    else if (cargoW > v.cargoW * 0.9) warn(`Width tight (${cargoW}" / ${v.cargoW}")`);
                                                }
                                                if (cargoH > 0) {
                                                    if (cargoH > v.cargoH) fail(`Too tall (${cargoH}" > ${v.cargoH}")`);
                                                    else if (cargoH > v.doorH) fail(`Won't fit through door (${cargoH}" > ${v.doorH}" opening)`);
                                                    else if (cargoH > v.cargoH * 0.9) warn(`Height tight (${cargoH}" / ${v.cargoH}")`);
                                                }
                                                // Weight check
                                                if (weight > 0 && weight > v.maxPayload) {
                                                    fail(`Over payload (${weight} lbs > ${v.maxPayload} lbs)`);
                                                } else if (weight > 0 && weight > v.maxPayload * 0.9) {
                                                    warn(`Near max payload (${weight} / ${v.maxPayload} lbs)`);
                                                }

                                                const colors = {
                                                    fits: "border-green-500/40 bg-green-500/10",
                                                    tight: "border-yellow-500/40 bg-yellow-500/10",
                                                    no_fit: "border-red-500/40 bg-red-500/10 opacity-75",
                                                };
                                                const icons = {
                                                    fits: <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />,
                                                    tight: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />,
                                                    no_fit: <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
                                                };
                                                const labels = { fits: "FITS", tight: "TIGHT FIT", no_fit: "WON'T FIT" };
                                                const VIcon = v.type === "car" ? Car : Truck;

                                                return (
                                                    <div key={v.name} className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-200 ${colors[status]}`}>
                                                        {icons[status]}
                                                        <VIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold truncate">{v.name}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {v.cargoL}"L × {v.cargoW}"W × {v.cargoH}"H · Door {v.doorW}"×{v.doorH}" · {v.maxPayload.toLocaleString()} lbs
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${status === "fits" ? "text-green-500 border-green-500/50" :
                                                            status === "tight" ? "text-yellow-500 border-yellow-500/50" :
                                                                "text-red-500 border-red-500/50"
                                                            }`}>
                                                            {labels[status]}
                                                        </Badge>
                                                        {issues.length > 0 && (
                                                            <div className="hidden sm:block">
                                                                {issues.map((issue, i) => (
                                                                    <p key={i} className="text-[9px] text-muted-foreground">{issue}</p>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>

                    {/* Accessorial Surcharges */}
                    <Card className="glass-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Accessorial & Special Services</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {ACCESSORIALS.map((acc) => (
                                    <div key={acc.key}
                                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${enabledAccessorials[acc.key] ? "bg-accent/10 border-accent/30" : "bg-card/50 hover:bg-muted/30"}`}
                                    >
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleAccessorial(acc.key)}>
                                            <p className="text-xs font-medium truncate">{acc.label}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{acc.description}</p>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                                            {acc.key === "attempt" ? "Base Rate" : `$${acc.amount}`}
                                        </Badge>
                                        <Switch checked={!!enabledAccessorials[acc.key]} onCheckedChange={() => toggleAccessorial(acc.key)} />
                                    </div>
                                ))}
                            </div>
                            {/* Extra stop count */}
                            {enabledAccessorials["extra_stop"] && (
                                <div className="flex items-center gap-2 pl-3">
                                    <Label className="text-xs">How many extra stops?</Label>
                                    <Input type="number" min={1} value={extraStopCount} onChange={(e) => setExtraStopCount(Math.max(1, +e.target.value))} className="w-16 text-center" />
                                </div>
                            )}
                            {enabledAccessorials["extra_piece"] && (
                                <div className="flex items-center gap-2 pl-3">
                                    <Label className="text-xs">How many extra pieces?</Label>
                                    <Input type="number" min={1} value={extraPieceCount} onChange={(e) => setExtraPieceCount(Math.max(1, +e.target.value))} className="w-16 text-center" />
                                </div>
                            )}
                            {enabledAccessorials["holding"] && (
                                <div className="flex items-center gap-2 pl-3">
                                    <Label className="text-xs">How many days?</Label>
                                    <Input type="number" min={1} value={holdingDays} onChange={(e) => setHoldingDays(Math.max(1, +e.target.value))} className="w-16 text-center" />
                                </div>
                            )}
                            {/* Wait time */}
                            <div className="flex items-center gap-2 pl-3">
                                <Label className="text-xs text-muted-foreground">Wait Time (15-min blocks after free 15):</Label>
                                <Input type="number" min={0} value={waitTimeBlocks} onChange={(e) => setWaitTimeBlocks(Math.max(0, +e.target.value))} className="w-16 text-center" />
                                {waitTimeBlocks > 0 && <span className="text-xs text-accent font-mono">${(waitTimeBlocks * 30).toFixed(2)}</span>}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ─── RIGHT: Live Quote Preview (2 cols) ─ */}
                <div className="lg:col-span-2 space-y-4">
                    <Card className="glass-card relative overflow-hidden border-accent/20">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-blue-500 to-purple-500" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calculator className="h-5 w-5 text-accent" /> Quote Preview
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {!activeCard ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No rate card found for {hubLabel} / {vehicleLabel}.<br />Run the migration SQL first.
                                </div>
                            ) : quote ? (
                                <>
                                    {/* Addresses */}
                                    {(pickupAddress || deliveryAddress) && (
                                        <div className="text-xs space-y-1 pb-2 border-b">
                                            {pickupAddress && <p><span className="text-muted-foreground">PICK UP:</span> {pickupAddress}</p>}
                                            {deliveryAddress && <p><span className="text-muted-foreground">DELIVERY:</span> {deliveryAddress}</p>}
                                            <p className="text-muted-foreground">CARGO: {cargoPieces} @ {weight} lbs{(cargoL && cargoW && cargoH) ? ` ${cargoL}×${cargoW}×${cargoH} in` : ""}</p>
                                        </div>
                                    )}

                                    {/* Line items table */}
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs">Line Item</TableHead>
                                                <TableHead className="text-xs">Source Logic</TableHead>
                                                <TableHead className="text-right text-xs">Cost</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell className="text-xs font-medium">Base Rate ({vehicleLabel})</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">First {quote.includedMiles} miles</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{fmt(quote.baseRate)}</TableCell>
                                            </TableRow>
                                            {quote.billableMiles > 0 && (
                                                <TableRow>
                                                    <TableCell className="text-xs font-medium">Excess Mileage</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{quote.billableMiles} mi × {fmt(activeCard.per_mile_rate)}/mi</TableCell>
                                                    <TableCell className="text-right font-mono text-xs">{fmt(quote.excessMileage)}</TableCell>
                                                </TableRow>
                                            )}
                                            {quote.deadheadMiles > 0 && (
                                                <TableRow>
                                                    <TableCell className="text-xs font-medium">Deadhead Miles</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{quote.deadheadMiles} mi × {fmt(activeCard.per_mile_rate)}/mi (base to pickup)</TableCell>
                                                    <TableCell className="text-right font-mono text-xs">{fmt(quote.deadheadCharge)}</TableCell>
                                                </TableRow>
                                            )}
                                            {quote.billableWeight > 0 && (
                                                <TableRow>
                                                    <TableCell className="text-xs font-medium">Weight Surcharge</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {weight} - {quote.weightThreshold} = {quote.billableWeight} lbs @ {fmt(activeCard.per_lb_rate)}/lb
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-xs">{fmt(quote.weightSurcharge)}</TableCell>
                                                </TableRow>
                                            )}
                                            {quote.accessorialItems.map((a, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-xs font-medium">{a.label}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{a.detail}</TableCell>
                                                    <TableCell className="text-right font-mono text-xs">{fmt(a.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow>
                                                <TableCell className="text-xs font-medium">Fuel Surcharge</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{quote.fuelPct}% of Transportation ({fmt(quote.transportation)})</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{fmt(quote.fuelSurcharge)}</TableCell>
                                            </TableRow>
                                            <TableRow className="border-t-2">
                                                <TableCell colSpan={2} className="font-bold">TOTAL QUOTE</TableCell>
                                                <TableCell className={`text-right font-bold font-mono text-lg ${winClientMode ? 'line-through text-muted-foreground text-sm' : 'gradient-text'}`}>{fmt(quote.total)}</TableCell>
                                            </TableRow>
                                            {winClientMode && (
                                                <>
                                                    <TableRow>
                                                        <TableCell className="text-xs font-medium text-green-500">Win Client Discount</TableCell>
                                                        <TableCell className="text-xs text-green-500">{discountPct}% off</TableCell>
                                                        <TableCell className="text-right font-mono text-xs text-green-500">-{fmt(quote.total * discountPct / 100)}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-t-2">
                                                        <TableCell colSpan={2} className="font-bold text-green-500">DISCOUNTED TOTAL</TableCell>
                                                        <TableCell className="text-right font-bold font-mono text-lg text-green-500">{fmt(quote.total * (1 - discountPct / 100))}</TableCell>
                                                    </TableRow>
                                                </>
                                            )}
                                        </TableBody>
                                    </Table>

                                    {/* Rate card info */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        <Badge variant="secondary" className="text-[10px]">{hubLabel}</Badge>
                                        <Badge variant="secondary" className="text-[10px]">{vehicleLabel}</Badge>
                                        <Badge variant="secondary" className="text-[10px]">{distance} mi</Badge>
                                        <Badge variant="secondary" className="text-[10px]">{weight} lbs</Badge>
                                    </div>

                                    {/* Win Client Mode */}
                                    <div className={`rounded-lg border p-3 space-y-2 transition-colors ${winClientMode ? 'bg-green-500/10 border-green-500/30' : 'bg-card/50'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Percent className="h-4 w-4 text-green-500" />
                                                <Label className="text-sm font-medium">Win Client Mode</Label>
                                            </div>
                                            <Switch checked={winClientMode} onCheckedChange={setWinClientMode} />
                                        </div>
                                        {winClientMode && (
                                            <div className="space-y-2 pt-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">Discount: <span className="font-bold text-green-500">{discountPct}%</span></span>
                                                    <span className="font-mono text-green-500 font-bold">{fmt(quote.total * (1 - discountPct / 100))}</span>
                                                </div>
                                                <Slider
                                                    value={[discountPct]}
                                                    onValueChange={(v) => setDiscountPct(v[0])}
                                                    min={20}
                                                    max={40}
                                                    step={1}
                                                    className="w-full"
                                                />
                                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                                    <span>20%</span>
                                                    <span>30%</span>
                                                    <span>40%</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-2">
                                        <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2 btn-gradient">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            Save
                                        </Button>
                                        <Button variant="outline" onClick={handleCopy} className="gap-2">
                                            {copied ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            {copied ? "Copied!" : "Copy"}
                                        </Button>
                                        <Button variant="outline" onClick={() => setEmailDialogOpen(true)} className="gap-2">
                                            <Mail className="h-4 w-4" /> Email
                                        </Button>
                                    </div>
                                </>
                            ) : null}
                        </CardContent>
                    </Card>

                    {/* Rate Sheet Reference */}
                    <Card className="glass-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{hubLabel} Rate Sheet</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Rate</TableHead>
                                        <TableHead className="text-right text-xs">Cargo Van</TableHead>
                                        <TableHead className="text-right text-xs">Box Truck</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        const isPhxOrLax = hub === "phoenix" || hub === "la";
                                        const cv = isPhxOrLax
                                            ? { ...RATE_SHEET.cargo_van }
                                            : rateCards.find((c) => c.hub === hub && c.service_type === "last_mile" && c.vehicle_type === "cargo_van");
                                        const bt = isPhxOrLax
                                            ? { ...RATE_SHEET.box_truck }
                                            : rateCards.find((c) => c.hub === hub && c.service_type === "last_mile" && c.vehicle_type === "box_truck");
                                        if (!cv || !bt) return <TableRow><TableCell colSpan={3} className="text-xs text-muted-foreground text-center py-4">No rate data</TableCell></TableRow>;
                                        return (
                                            <>
                                                <TableRow><TableCell className="text-xs">Base (first {cv.included_miles} mi)</TableCell><TableCell className="text-right font-mono text-xs">{fmt(cv.base_rate)}</TableCell><TableCell className="text-right font-mono text-xs">{fmt(bt.base_rate)}</TableCell></TableRow>
                                                <TableRow><TableCell className="text-xs">Add'l Mile</TableCell><TableCell className="text-right font-mono text-xs">{fmt(cv.per_mile_rate)}/mi</TableCell><TableCell className="text-right font-mono text-xs">{fmt(bt.per_mile_rate)}/mi</TableCell></TableRow>
                                                <TableRow><TableCell className="text-xs">Deadhead Mile</TableCell><TableCell className="text-right font-mono text-xs">{fmt(cv.per_mile_rate)}/mi</TableCell><TableCell className="text-right font-mono text-xs">{fmt(bt.per_mile_rate)}/mi</TableCell></TableRow>
                                                <TableRow><TableCell className="text-xs">Weight Surcharge</TableCell><TableCell className="text-right font-mono text-xs">{fmt(cv.per_lb_rate)}/lb &gt;{cv.weight_threshold_lbs}</TableCell><TableCell className="text-right font-mono text-xs">{fmt(bt.per_lb_rate)}/lb &gt;{bt.weight_threshold_lbs}</TableCell></TableRow>
                                                <TableRow><TableCell className="text-xs">Fuel Surcharge</TableCell><TableCell className="text-right font-mono text-xs">{cv.fuel_surcharge_pct}%</TableCell><TableCell className="text-right font-mono text-xs">{bt.fuel_surcharge_pct}%</TableCell></TableRow>
                                            </>
                                        );
                                    })()}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Market Comparison */}
                    <MarketComparison
                        hub={hub}
                        vehicleType={vehicleType}
                        distance={distance}
                        ourTotal={quote?.total ?? null}
                    />
                </div>
            </div>

            {/* ─── Quote History ─────────────────────── */}
            <Card className="glass-card">
                <CardHeader className="pb-2"><CardTitle className="text-lg">Recent Quotes</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {loadingHistory ? (
                        <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full shimmer" />)}</div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">No saved quotes yet.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Hub</TableHead>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead className="text-right">Distance</TableHead>
                                    <TableHead className="text-right">Weight</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((q) => (
                                    <TableRow key={q.id} className="cursor-pointer hover:bg-muted/30 transition-colors"
                                        onClick={() => {
                                            setHub(q.hub);
                                            setVehicleType(q.vehicle_type);
                                            setDistance(Number(q.distance_miles) || 0);
                                            setWeight(Number(q.weight_lbs) || 0);
                                            window.scrollTo({ top: 0, behavior: "smooth" });
                                        }}
                                    >
                                        <TableCell className="text-xs">{new Date(q.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-[10px]">{CITY_HUBS.find((h) => h.value === q.hub)?.label ?? q.hub}</Badge></TableCell>
                                        <TableCell className="text-xs">{VEHICLES.find((v) => v.value === q.vehicle_type)?.label ?? q.vehicle_type}</TableCell>
                                        <TableCell className="text-right text-xs font-mono">{q.distance_miles} mi</TableCell>
                                        <TableCell className="text-right text-xs font-mono">{q.weight_lbs} lbs</TableCell>
                                        <TableCell className="text-right font-semibold font-mono text-accent">{fmt(q.total_quote)}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{q.notes}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* ─── Email Dialog ─────────────────────── */}
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email Quote</DialogTitle>
                        <DialogDescription>Send this quote as a formatted email</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Send To (email)</Label>
                            <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
                                placeholder="dispatch@anikalogistics.com" />
                        </div>
                        {quote && (
                            <div className="bg-muted/30 rounded-lg p-3 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                                {buildQuoteText(false)}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendEmail} disabled={sendingEmail || !emailTo.trim()} className="gap-2 btn-gradient">
                            {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Send Quote
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
