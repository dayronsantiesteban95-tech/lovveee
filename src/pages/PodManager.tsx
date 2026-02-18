// ═══════════════════════════════════════════════════════════
// POD MANAGER — Proof of Delivery & Load Documents
// Dispatchers upload load docs (BOL, pickup, delivery photos).
// Full 4-section layout: Search → Selected Load → Upload → All PODs
// ═══════════════════════════════════════════════════════════
import { useEffect, useState, useCallback, useRef, useDeferredValue } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    FileText, Upload, Camera, CheckCircle, XCircle,
    Clock, Download, Search, Package, Truck,
    Image as ImageIcon, X, Loader2, Shield,
    AlertTriangle, Eye, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────
type Load = {
    id: string;
    load_date: string;
    reference_number: string | null;
    client_name: string | null;
    pickup_address: string | null;
    delivery_address: string | null;
    driver_id: string | null;
    vehicle_id: string | null;
    status: string;
    hub: string;
    packages: number;
    pod_confirmed: boolean;
    bol_url: string | null;
};

type Driver = { id: string; full_name: string; hub: string };

type PodSubmission = {
    id: string;
    load_id: string;
    driver_id: string | null;
    photo_url: string | null;
    signature_url: string | null;
    notes: string | null;
    lat: number | null;
    lng: number | null;
    captured_at: string | null;
    created_at: string;
};

type DocType = "bol" | "pickup" | "delivery" | "other";

// ─── Constants ──────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const POD_BUCKET = "pod-photos";
const DOC_BUCKET = "documents";

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = [
    { value: "bol",      label: "Bill of Lading (BOL)" },
    { value: "pickup",   label: "Pickup Photo" },
    { value: "delivery", label: "Delivery Photo / POD" },
    { value: "other",    label: "Other" },
];

const LOAD_STATUS_COLORS: Record<string, string> = {
    assigned:    "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    delivered:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    cancelled:   "bg-muted text-muted-foreground",
    failed:      "bg-red-500/15 text-red-700 dark:text-red-400",
};

function publicUrl(bucket: string, path: string): string {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function isPickup(sub: PodSubmission): boolean {
    return !!(sub.notes?.toLowerCase().includes("pickup") ||
              sub.notes?.toLowerCase().includes("pick up") ||
              sub.notes?.toLowerCase().startsWith("pickup:"));
}

// ─── Tiny helpers ────────────────────────────────────
function StatusIcon({ ok }: { ok: boolean }) {
    return ok
        ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
        : <AlertTriangle className="h-4 w-4 text-amber-400 mx-auto" />;
}

function DocCard({
    label,
    url,
    onUpload,
}: {
    label: string;
    url: string | null;
    onUpload: () => void;
}) {
    const isImg = url && /\.(png|jpg|jpeg|gif|webp)/i.test(url);
    return (
        <div className="border rounded-xl p-3 space-y-2 bg-muted/20 hover:bg-muted/40 transition-colors">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                {url ? (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 gap-1">
                        <CheckCircle className="h-3 w-3" /> On file
                    </Badge>
                ) : (
                    <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 gap-1">
                        <AlertTriangle className="h-3 w-3" /> Missing
                    </Badge>
                )}
            </div>

            {url ? (
                <div className="space-y-2">
                    {isImg ? (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                            <img
                                src={url}
                                alt={label}
                                className="w-full h-28 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                            />
                        </a>
                    ) : (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
                            <FileText className="h-5 w-5 text-purple-500 shrink-0" />
                            <span className="text-xs truncate flex-1">{label}</span>
                        </div>
                    )}
                    <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" asChild>
                            <a href={url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-3 w-3" /> View
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" asChild>
                            <a href={url} download target="_blank" rel="noopener noreferrer">
                                <Download className="h-3 w-3" /> Download
                            </a>
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center h-16 border-2 border-dashed rounded-lg">
                    <span className="text-xs text-muted-foreground">No file yet</span>
                </div>
            )}

            <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1 border-dashed"
                onClick={onUpload}
            >
                <Upload className="h-3 w-3" /> Upload {label}
            </Button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function PodManager() {
    const { user } = useAuth();
    const { toast } = useToast();

    // ── Data ─────────────────────────────────────────
    const [loads, setLoads] = useState<Load[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [submissions, setSubmissions] = useState<PodSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Search / Selection ────────────────────────────
    const [search, setSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const deferredSearch = useDeferredValue(search);

    // ── Upload Panel ──────────────────────────────────
    const [uploadType, setUploadType] = useState<DocType>("bol");
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Fetch ─────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const [loadsRes, driversRes, subsRes] = await Promise.all([
            supabase
                .from("daily_loads")
                .select("id, load_date, reference_number, client_name, pickup_address, delivery_address, driver_id, vehicle_id, status, hub, packages, pod_confirmed, bol_url")
                .order("load_date", { ascending: false })
                .limit(300),
            supabase.from("drivers").select("id, full_name, hub"),
            supabase
                .from("pod_submissions")
                .select("id, load_id, driver_id, photo_url, signature_url, notes, lat, lng, captured_at, created_at")
                .order("created_at", { ascending: false }),
        ]);
        if (loadsRes.data) setLoads(loadsRes.data as Load[]);
        if (driversRes.data) setDrivers(driversRes.data as Driver[]);
        if (subsRes.data) setSubmissions(subsRes.data as PodSubmission[]);
        setLoading(false);
    }, [user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ── Lookups ──────────────────────────────────────
    const driverName = (id: string | null) =>
        id ? (drivers.find(d => d.id === id)?.full_name ?? "—") : "—";

    const subsForLoad = (loadId: string) =>
        submissions.filter(s => s.load_id === loadId);

    const pickupSub = (loadId: string): PodSubmission | undefined =>
        submissions.find(s => s.load_id === loadId && isPickup(s));

    const deliverySub = (loadId: string): PodSubmission | undefined =>
        submissions
            .filter(s => s.load_id === loadId && !isPickup(s))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    const signatureSub = (loadId: string): PodSubmission | undefined =>
        submissions
            .filter(s => s.load_id === loadId && !!s.signature_url)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    // ── Search filter ────────────────────────────────
    const searchResults = deferredSearch.trim().length === 0
        ? loads.slice(0, 10)
        : loads.filter(l => {
            const q = deferredSearch.toLowerCase();
            return [l.reference_number, l.client_name, driverName(l.driver_id)]
                .some(v => v?.toLowerCase().includes(q));
        }).slice(0, 20);

    const selectLoad = (load: Load) => {
        setSelectedLoad(load);
        setSearch(load.reference_number || load.client_name || "");
        setShowDropdown(false);
    };

    // ── Upload handler ───────────────────────────────
    const handleUpload = async () => {
        if (!uploadFile || !selectedLoad || !user) return;
        setUploading(true);
        setUploadProgress(10);

        try {
            const ext = uploadFile.name.split(".").pop() || "bin";
            const ts = Date.now();
            const bucket = uploadType === "bol" ? DOC_BUCKET : POD_BUCKET;
            const path = `loads/${selectedLoad.id}/${uploadType}/${ts}_${uploadFile.name}`;

            // Upload to storage
            const { error: storageErr } = await supabase.storage
                .from(bucket)
                .upload(path, uploadFile, { upsert: true });
            if (storageErr) throw storageErr;
            setUploadProgress(60);

            const fileUrl = publicUrl(bucket, path);

            if (uploadType === "bol") {
                // Save to daily_loads.bol_url
                const { error } = await supabase
                    .from("daily_loads")
                    .update({ bol_url: fileUrl })
                    .eq("id", selectedLoad.id);
                if (error) throw error;
            } else {
                // Save to pod_submissions
                const notePrefix = uploadType === "pickup" ? "pickup: " : uploadType === "delivery" ? "delivery: " : "other: ";
                const { error } = await supabase.from("pod_submissions").insert({
                    load_id: selectedLoad.id,
                    driver_id: user.id,
                    photo_url: fileUrl,
                    notes: notePrefix + (uploadFile.name),
                });
                if (error) throw error;
            }
            setUploadProgress(100);

            toast({
                title: "Upload complete ✓",
                description: `${DOC_TYPE_OPTIONS.find(d => d.value === uploadType)?.label} saved.`,
            });

            // Reset + refresh
            setUploadFile(null);
            setUploadProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = "";
            await fetchData();

            // Re-select refreshed load
            setSelectedLoad(prev => {
                if (!prev) return null;
                return loads.find(l => l.id === prev.id) ?? prev;
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            toast({ title: "Upload failed", description: msg, variant: "destructive" });
            setUploadProgress(0);
        }
        setUploading(false);
    };

    // ── Drag & Drop ──────────────────────────────────
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) setUploadFile(file);
    };

    // ── Loading skeleton ─────────────────────────────
    if (loading) {
        return (
            <div className="space-y-4 animate-in">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-40" />
                <Skeleton className="h-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    // ── Derived data for selected load ───────────────
    const selPickup   = selectedLoad ? pickupSub(selectedLoad.id)   : undefined;
    const selDelivery = selectedLoad ? deliverySub(selectedLoad.id) : undefined;
    const selSig      = selectedLoad ? signatureSub(selectedLoad.id): undefined;

    return (
        <div className="space-y-6 animate-in">

            {/* ══════════════════════════════════════════
                SECTION 1 — HEADER + SEARCH
            ══════════════════════════════════════════ */}
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight gradient-text">POD Manager</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Search loads · View &amp; upload BOL / Pickup / Delivery photos · Track all PODs
                    </p>
                </div>

                {/* Load Search Bar */}
                <div ref={searchRef} className="relative max-w-xl">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-9 pr-10 h-11 text-sm"
                            placeholder="Search by reference # or client name…"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
                            onFocus={() => setShowDropdown(true)}
                        />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>

                    {showDropdown && searchResults.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-background border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                            {search.trim() === "" && (
                                <div className="px-3 py-2 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider border-b">
                                    Recent Loads
                                </div>
                            )}
                            {searchResults.map(load => (
                                <button
                                    key={load.id}
                                    className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center gap-3"
                                    onClick={() => selectLoad(load)}
                                >
                                    <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <div className="font-mono text-xs font-semibold">
                                            {load.reference_number || "No Ref"}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {load.client_name || "—"} · {format(new Date(load.load_date), "MM/dd/yy")} · {driverName(load.driver_id)}
                                        </div>
                                    </div>
                                    <Badge
                                        variant="secondary"
                                        className={`ml-auto text-[10px] shrink-0 ${LOAD_STATUS_COLORS[load.status] || ""}`}
                                    >
                                        {load.status.replace("_", " ")}
                                    </Badge>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════
                SECTION 2 — SELECTED LOAD DOCUMENT PANEL
            ══════════════════════════════════════════ */}
            {selectedLoad ? (
                <Card className="relative overflow-hidden">
                    {/* Header strip */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />
                    <CardHeader className="pt-5 pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Package className="h-4 w-4 text-blue-500" />
                                    Load #{selectedLoad.reference_number || "—"}
                                    <Badge
                                        variant="secondary"
                                        className={`text-[10px] ml-1 ${LOAD_STATUS_COLORS[selectedLoad.status] || ""}`}
                                    >
                                        {selectedLoad.status.replace("_", " ")}
                                    </Badge>
                                </CardTitle>
                                <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                                    <div>
                                        <span className="font-medium text-foreground">{selectedLoad.client_name || "—"}</span>
                                        {" · "}Driver: <span className="font-medium text-foreground">{driverName(selectedLoad.driver_id)}</span>
                                        {" · "}Date: <span className="font-medium text-foreground">{format(new Date(selectedLoad.load_date), "MMM d, yyyy")}</span>
                                    </div>
                                    <div className="text-xs flex items-center gap-1">
                                        <span className="truncate max-w-[200px]">{selectedLoad.pickup_address || "—"}</span>
                                        <span className="text-muted-foreground">→</span>
                                        <span className="truncate max-w-[200px]">{selectedLoad.delivery_address || "—"}</span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground"
                                onClick={() => { setSelectedLoad(null); setSearch(""); }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="pb-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* BOL */}
                            <DocCard
                                label="BOL"
                                url={selectedLoad.bol_url}
                                onUpload={() => setUploadType("bol")}
                            />

                            {/* Pickup Photo */}
                            <DocCard
                                label="Pickup Photo"
                                url={selPickup?.photo_url ?? null}
                                onUpload={() => setUploadType("pickup")}
                            />

                            {/* Delivery POD */}
                            <DocCard
                                label="Delivery POD"
                                url={selDelivery?.photo_url ?? null}
                                onUpload={() => setUploadType("delivery")}
                            />

                            {/* Signature */}
                            <DocCard
                                label="Signature"
                                url={selSig?.signature_url ?? null}
                                onUpload={() => setUploadType("delivery")}
                            />
                        </div>

                        {/* Submission history */}
                        {subsForLoad(selectedLoad.id).length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                    Submission History ({subsForLoad(selectedLoad.id).length})
                                </p>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                    {subsForLoad(selectedLoad.id).map(sub => (
                                        <div key={sub.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-xs">
                                            {sub.photo_url
                                                ? <Camera className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                : <Shield className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                            }
                                            <span className="truncate flex-1 text-muted-foreground">{sub.notes || "—"}</span>
                                            <span className="text-muted-foreground shrink-0">
                                                {sub.captured_at
                                                    ? format(new Date(sub.captured_at), "MM/dd h:mm a")
                                                    : format(new Date(sub.created_at), "MM/dd h:mm a")
                                                }
                                            </span>
                                            {sub.photo_url && (
                                                <a href={sub.photo_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                    <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Search for a load above to view its documents</p>
                    </CardContent>
                </Card>
            )}

            {/* ══════════════════════════════════════════
                SECTION 3 — UPLOAD PANEL
            ══════════════════════════════════════════ */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="h-4 w-4 text-purple-500" />
                        Upload Document / Photo
                        {!selectedLoad && (
                            <span className="text-xs text-amber-500 font-normal ml-2">(select a load first)</span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Type selector */}
                        <div className="space-y-2">
                            <Label>Document Type</Label>
                            <Select value={uploadType} onValueChange={v => setUploadType(v as DocType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DOC_TYPE_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Drop zone */}
                        <div className="md:col-span-2 space-y-2">
                            <Label>File</Label>
                            <div
                                className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                                    dragOver
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                                }`}
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.webp"
                                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                                />
                                {uploadFile ? (
                                    <div className="flex items-center justify-center gap-3">
                                        {uploadFile.type.startsWith("image") ? (
                                            <ImageIcon className="h-6 w-6 text-blue-500" />
                                        ) : (
                                            <FileText className="h-6 w-6 text-purple-500" />
                                        )}
                                        <div className="text-left">
                                            <p className="font-medium text-sm">{uploadFile.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {(uploadFile.size / 1024).toFixed(1)} KB
                                            </p>
                                        </div>
                                        <button
                                            className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                                            onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                                        <p className="text-sm text-muted-foreground">
                                            Drop file here or <span className="text-primary underline underline-offset-2">click to browse</span>
                                        </p>
                                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                                            PDF, PNG, JPG, WEBP, DOC, XLS
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    {uploading && uploadProgress > 0 && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Uploading…</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300 rounded-full"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <Button
                        className="btn-gradient gap-2"
                        disabled={!uploadFile || !selectedLoad || uploading}
                        onClick={handleUpload}
                    >
                        {uploading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                        ) : (
                            <><Upload className="h-4 w-4" /> Upload to {selectedLoad ? `Load #${selectedLoad.reference_number || "—"}` : "Load"}</>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* ══════════════════════════════════════════
                SECTION 4 — ALL PODs TABLE
            ══════════════════════════════════════════ */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            All Loads &amp; POD Status
                            <Badge variant="secondary" className="text-xs ml-1">{loads.length}</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> = on file
                            </span>
                            <span className="flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> = missing
                            </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[90px]">Date</TableHead>
                                <TableHead>Ref #</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Driver</TableHead>
                                <TableHead className="text-center">BOL</TableHead>
                                <TableHead className="text-center">Pickup Photo</TableHead>
                                <TableHead className="text-center">POD Photo</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loads.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        No loads found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                loads.map(load => {
                                    const hasBol      = !!load.bol_url;
                                    const hasPickup   = !!pickupSub(load.id)?.photo_url;
                                    const hasDelivery = !!deliverySub(load.id)?.photo_url;
                                    const isSelected  = selectedLoad?.id === load.id;
                                    return (
                                        <TableRow
                                            key={load.id}
                                            className={`cursor-pointer transition-colors ${
                                                isSelected
                                                    ? "bg-primary/5 ring-1 ring-inset ring-primary/30"
                                                    : "hover:bg-muted/30"
                                            }`}
                                            onClick={() => selectLoad(load)}
                                        >
                                            <TableCell className="font-mono text-xs">
                                                {format(new Date(load.load_date), "MM/dd")}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs font-semibold">
                                                {load.reference_number || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm max-w-[130px] truncate">
                                                {load.client_name || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {driverName(load.driver_id)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <StatusIcon ok={hasBol} />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <StatusIcon ok={hasPickup} />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <StatusIcon ok={hasDelivery} />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] ${LOAD_STATUS_COLORS[load.status] || ""}`}
                                                >
                                                    {load.status.replace("_", " ")}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
