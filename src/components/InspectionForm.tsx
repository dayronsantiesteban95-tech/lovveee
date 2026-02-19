// ═══════════════════════════════════════════════════════════
// INSPECTION FORM — Vehicle Walk-Around Inspection
// Used by Dispatcher App (manual entry) + Driver App (future)
// ═══════════════════════════════════════════════════════════
import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle, Camera, CheckCircle, Loader2, Upload, X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────
type VehicleOption = { id: string; vehicle_name: string; license_plate: string | null };
type DriverOption = { id: string; full_name: string };

type InspectionChecklist = {
    tires_ok: boolean;
    lights_ok: boolean;
    brakes_ok: boolean;
    fluids_ok: boolean;
    exterior_damage: boolean;
    interior_clean: boolean;
    fuel_level: string;
};

type UploadedPhoto = {
    label: string;
    url: string;
    path: string;
    file: File;
    preview: string;
};

export type InspectionFormProps = {
    vehicles: VehicleOption[];
    drivers: DriverOption[];
    defaultVehicleId?: string;
    defaultDriverId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
};

const PHOTO_LABELS = ["Front", "Back", "Driver Side", "Passenger Side", "Other"];

const DEFAULT_CHECKLIST: InspectionChecklist = {
    tires_ok: false,
    lights_ok: false,
    brakes_ok: false,
    fluids_ok: false,
    exterior_damage: false,
    interior_clean: false,
    fuel_level: "",
};

const FUEL_LEVELS = [
    { value: "full", label: "Full" },
    { value: "three_quarter", label: "3/4" },
    { value: "half", label: "1/2" },
    { value: "quarter", label: "1/4" },
    { value: "low", label: "Low" },
];

// ═══════════════════════════════════════════════════════════
export default function InspectionForm({
    vehicles,
    drivers,
    defaultVehicleId,
    defaultDriverId,
    onSuccess,
    onCancel,
}: InspectionFormProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? "");
    const [driverId, setDriverId] = useState(defaultDriverId ?? "");
    const [odometer, setOdometer] = useState("");
    const [checklist, setChecklist] = useState<InspectionChecklist>({ ...DEFAULT_CHECKLIST });
    const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
    const [carWashDone, setCarWashDone] = useState(false);
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [odometerWarning, setOdometerWarning] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Odometer validation ──────────────────────────
    const checkOdometer = useCallback(async (value: string) => {
        if (!vehicleId || !value) return;
        const num = parseInt(value, 10);
        if (isNaN(num)) return;

        // Get yesterday's reading
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const { data } = await supabase
            .from("vehicle_inspections")
            .select("odometer_reading, inspection_date")
            .eq("vehicle_id", vehicleId)
            .order("inspection_date", { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            const lastReading = data[0].odometer_reading;
            if (num < lastReading) {
                setOdometerWarning(
                    `⚠️ Odometer is lower than last reading (${lastReading.toLocaleString()} mi on ${data[0].inspection_date})`
                );
            } else if (num === lastReading) {
                setOdometerWarning(`ℹ️ Same as last reading (${lastReading.toLocaleString()} mi). Is this correct?`);
            } else {
                setOdometerWarning(null);
            }
        } else {
            setOdometerWarning(null);
        }
    }, [vehicleId]);

    // ── Photo upload ─────────────────────────────────
    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;

        setUploading(true);
        try {
            for (const file of files) {
                if (photos.length >= 10) break;

                const preview = URL.createObjectURL(file);
                const label = PHOTO_LABELS[photos.length] ?? "Other";
                const ext = file.name.split(".").pop() ?? "jpg";
                const path = `${vehicleId ?? "unknown"}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

                const { error } = await supabase.storage
                    .from("vehicle-inspections")
                    .upload(path, file, { cacheControl: "3600", upsert: false });

                if (error) {
                    toast({ title: "Upload failed", description: error.message, variant: "destructive" });
                    continue;
                }

                const { data: urlData } = supabase.storage
                    .from("vehicle-inspections")
                    .getPublicUrl(path);

                setPhotos((prev) => [...prev, { label, url: urlData.publicUrl, path, file, preview }]);
            }
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const removePhoto = (idx: number) => {
        setPhotos((prev) => prev.filter((_, i) => i !== idx));
    };

    // ── Submit ───────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!vehicleId) {
            toast({ title: "Vehicle required", description: "Please select a vehicle.", variant: "destructive" });
            return;
        }
        if (!odometer || isNaN(parseInt(odometer, 10))) {
            toast({ title: "Odometer required", description: "Please enter a valid odometer reading.", variant: "destructive" });
            return;
        }
        if (photos.length < 2) {
            toast({ title: "Photos required", description: "Please upload at least 2 photos.", variant: "destructive" });
            return;
        }
        if (!checklist.fuel_level) {
            toast({ title: "Fuel level required", description: "Please select the fuel level.", variant: "destructive" });
            return;
        }
        if (checklist.exterior_damage && !notes.trim()) {
            toast({ title: "Notes required", description: "Exterior damage was marked — please describe it in the notes.", variant: "destructive" });
            return;
        }

        setSubmitting(true);
        try {
            const photoUrls = photos.map((p) => p.url);
            const today = new Date().toISOString().split("T")[0];

            const { error: insertError } = await supabase
                .from("vehicle_inspections")
                .insert({
                    vehicle_id: vehicleId,
                    driver_id: driverId || null,
                    inspection_date: today,
                    odometer_reading: parseInt(odometer, 10),
                    checklist: checklist as unknown as Record<string, unknown>,
                    photos: photoUrls,
                    notes: notes || null,
                    car_wash_done: carWashDone,
                    status: "submitted",
                    submitted_by: user?.id ?? null,
                });

            if (insertError) {
                if (insertError.code === "23505") {
                    toast({ title: "Already submitted", description: "An inspection for this vehicle was already submitted today.", variant: "destructive" });
                } else {
                    toast({ title: "Submit failed", description: insertError.message, variant: "destructive" });
                }
                return;
            }

            // If car wash done → log it
            if (carWashDone) {
                await supabase.from("vehicle_car_washes").insert({
                    vehicle_id: vehicleId,
                    driver_id: driverId || null,
                    wash_date: today,
                    notes: "Logged via inspection form",
                    recorded_by: user?.id ?? null,
                });
            }

            toast({ title: "✅ Inspection submitted!", description: "Walk-around inspection recorded successfully." });
            onSuccess?.();
        } finally {
            setSubmitting(false);
        }
    };

    const setChecklistField = (key: keyof InspectionChecklist, value: boolean | string) => {
        setChecklist((prev) => ({ ...prev, [key]: value }));
    };

    // ══════════════════════════════════════════════════
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vehicle + Driver */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Vehicle *</Label>
                    <Select
                        value={vehicleId}
                        onValueChange={(v) => { setVehicleId(v); setOdometerWarning(null); }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                        <SelectContent>
                            {vehicles.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                    {v.vehicle_name}{v.license_plate ? ` — ${v.license_plate}` : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Driver</Label>
                    <Select value={driverId} onValueChange={setDriverId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">— None —</SelectItem>
                            {drivers.map((d) => (
                                <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Odometer */}
            <div>
                <Label>Odometer Reading (miles) *</Label>
                <Input
                    type="number"
                    min={0}
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    onBlur={() => checkOdometer(odometer)}
                    placeholder="e.g. 45231"
                    className="mt-1"
                />
                {odometerWarning && (
                    <div className="flex items-start gap-2 text-xs text-yellow-600 bg-yellow-500/10 rounded-lg px-3 py-2 mt-2">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        {odometerWarning}
                    </div>
                )}
            </div>

            {/* Checklist */}
            <div className="space-y-3">
                <Label className="text-sm font-semibold">Vehicle Checklist</Label>
                <div className="rounded-xl border border-border/60 divide-y divide-border/40">
                    {[
                        { key: "tires_ok" as const, label: "Tires OK", desc: "No flats, proper inflation" },
                        { key: "lights_ok" as const, label: "Lights OK", desc: "All exterior lights working" },
                        { key: "brakes_ok" as const, label: "Brakes OK", desc: "No unusual sounds or feel" },
                        { key: "fluids_ok" as const, label: "Fluids OK", desc: "Oil, coolant, washer fluid" },
                        { key: "interior_clean" as const, label: "Interior Clean", desc: "Cab is clean and organized" },
                        { key: "exterior_damage" as const, label: "Exterior Damage", desc: "Any dents, scratches, or damage" },
                    ].map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between px-4 py-3">
                            <div>
                                <p className="text-sm font-medium">{label}</p>
                                <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {checklist[key] && key !== "exterior_damage" && (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                                {checklist[key] && key === "exterior_damage" && (
                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                )}
                                <Switch
                                    checked={checklist[key] as boolean}
                                    onCheckedChange={(v) => setChecklistField(key, v)}
                                    className={key === "exterior_damage" ? "data-[state=checked]:bg-orange-500" : ""}
                                />
                            </div>
                        </div>
                    ))}
                    {/* Fuel Level */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <div>
                            <p className="text-sm font-medium">Fuel Level *</p>
                            <p className="text-xs text-muted-foreground">Current fuel gauge reading</p>
                        </div>
                        <Select
                            value={checklist.fuel_level}
                            onValueChange={(v) => setChecklistField("fuel_level", v)}
                        >
                            <SelectTrigger className="w-28">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {FUEL_LEVELS.map((f) => (
                                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {checklist.exterior_damage && (
                    <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-500/10 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        Exterior damage noted — please describe it in the Notes section below.
                    </div>
                )}
            </div>

            {/* Photos */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Photos *</Label>
                    <span className="text-xs text-muted-foreground">
                        {photos.length}/10 — minimum 2 required
                    </span>
                </div>
                {photos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {photos.map((p, i) => (
                            <div key={i} className="relative group rounded-lg overflow-hidden border border-border/60 aspect-square">
                                <img
                                    src={p.preview}
                                    alt={p.label}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                                    <p className="text-[9px] text-white font-medium truncate">{p.label}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removePhoto(i)}
                                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-1">
                    {PHOTO_LABELS.slice(0, 4).map((lbl, i) => (
                        <Badge
                            key={lbl}
                            variant="secondary"
                            className={`text-[10px] ${i < photos.length ? "bg-green-500/15 text-green-700" : ""}`}
                        >
                            {i < photos.length ? "✓" : `${i + 1}`} {lbl}
                        </Badge>
                    ))}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelect}
                />
                <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || photos.length >= 10}
                >
                    {uploading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                    ) : (
                        <><Camera className="h-4 w-4" /> Add Photos</>
                    )}
                </Button>
                {photos.length < 2 && (
                    <p className="text-xs text-red-500">At least 2 photos are required</p>
                )}
            </div>

            {/* Car Wash */}
            <div className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
                <Checkbox
                    id="car_wash_done"
                    checked={carWashDone}
                    onCheckedChange={(v) => setCarWashDone(v === true)}
                />
                <div>
                    <Label htmlFor="car_wash_done" className="cursor-pointer">🚿 Car wash done today?</Label>
                    <p className="text-xs text-muted-foreground">This will log a car wash and reset the 10-day timer</p>
                </div>
            </div>

            {/* Notes */}
            <div>
                <Label>Notes {checklist.exterior_damage ? "*" : "(optional)"}</Label>
                <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                        checklist.exterior_damage
                            ? "Describe the exterior damage in detail..."
                            : "Any additional observations..."
                    }
                    rows={3}
                    className="mt-1"
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                        Cancel
                    </Button>
                )}
                <Button
                    type="submit"
                    className="btn-gradient flex-1 gap-2"
                    disabled={submitting || uploading}
                >
                    {submitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                    ) : (
                        <><CheckCircle className="h-4 w-4" /> Submit Inspection</>
                    )}
                </Button>
            </div>
        </form>
    );
}
