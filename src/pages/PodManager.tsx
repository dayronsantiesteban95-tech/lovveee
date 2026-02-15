// ═══════════════════════════════════════════════════════════
// POD MANAGER — Proof of Delivery & Load Documents
// Dispatchers upload load docs (BOL, instructions).
// Drivers view docs and submit POD (photos, signature, notes).
// ═══════════════════════════════════════════════════════════
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
    FileText, Upload, Camera, PenTool, CheckCircle, XCircle,
    Clock, Eye, Trash2, Download, Search, Filter,
    Package, Truck, AlertTriangle, Image, FileCheck,
    ChevronDown, ChevronRight, X, Loader2, Shield,
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
};

type Driver = { id: string; full_name: string; hub: string };
type Vehicle = { id: string; vehicle_name: string; vehicle_type: string };

type LoadDocument = {
    id: string;
    load_id: string;
    document_type: string;
    file_name: string;
    file_path: string;
    file_size_bytes: number;
    mime_type: string | null;
    notes: string | null;
    uploaded_by: string | null;
    created_at: string;
};

type ProofOfDelivery = {
    id: string;
    load_id: string;
    photo_paths: string[];
    signature_path: string | null;
    recipient_name: string | null;
    delivery_notes: string | null;
    delivery_time: string | null;
    status: string;
    verified_by: string | null;
    verified_at: string | null;
    rejection_reason: string | null;
    submitted_by: string | null;
    created_at: string;
};

// ─── Constants ──────────────────────────────────────
const DOC_TYPES = [
    { value: "bol", label: "Bill of Lading (BOL)" },
    { value: "delivery_instructions", label: "Delivery Instructions" },
    { value: "rate_confirmation", label: "Rate Confirmation" },
    { value: "customs", label: "Customs / Clearance" },
    { value: "packing_list", label: "Packing List" },
    { value: "other", label: "Other" },
] as const;

const POD_STATUSES = [
    { value: "pending", label: "Pending", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400", icon: Clock },
    { value: "submitted", label: "Submitted", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400", icon: FileCheck },
    { value: "verified", label: "Verified", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", icon: CheckCircle },
    { value: "rejected", label: "Rejected", color: "bg-red-500/15 text-red-700 dark:text-red-400", icon: XCircle },
] as const;

const LOAD_STATUS_COLORS: Record<string, string> = {
    assigned: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    cancelled: "bg-muted text-muted-foreground",
    failed: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_BUCKET = "pod-files";

function getStorageUrl(path: string): string {
    return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

function fmtBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function PodManager() {
    const { user } = useAuth();
    const { isOwner } = useUserRole();
    const { toast } = useToast();

    // Data
    const [loads, setLoads] = useState<Load[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [documents, setDocuments] = useState<LoadDocument[]>([]);
    const [pods, setPods] = useState<ProofOfDelivery[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [podFilter, setPodFilter] = useState("all");
    const [hubFilter, setHubFilter] = useState("all");

    // Dialogs
    const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showPodDialog, setShowPodDialog] = useState(false);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewType, setPreviewType] = useState("");

    // Upload form
    const [uploadDocType, setUploadDocType] = useState("bol");
    const [uploadNotes, setUploadNotes] = useState("");
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    // POD form
    const [podPhotos, setPodPhotos] = useState<File[]>([]);
    const [podPhotoPreviewUrls, setPodPhotoPreviewUrls] = useState<string[]>([]);
    const [podRecipient, setPodRecipient] = useState("");
    const [podNotes, setPodNotes] = useState("");
    const [submittingPod, setSubmittingPod] = useState(false);

    // Signature canvas
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    // ── Fetch Data ───────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const [loadsRes, driversRes, vehiclesRes, docsRes, podsRes] = await Promise.all([
            supabase.from("daily_loads").select("id, load_date, reference_number, client_name, pickup_address, delivery_address, driver_id, vehicle_id, status, hub, packages, pod_confirmed").order("load_date", { ascending: false }).limit(200),
            supabase.from("drivers").select("id, full_name, hub"),
            supabase.from("vehicles").select("id, vehicle_name, vehicle_type"),
            supabase.from("load_documents").select("*").order("created_at", { ascending: false }),
            supabase.from("proof_of_delivery").select("*").order("created_at", { ascending: false }),
        ]);
        if (loadsRes.data) setLoads(loadsRes.data as Load[]);
        if (driversRes.data) setDrivers(driversRes.data as Driver[]);
        if (vehiclesRes.data) setVehicles(vehiclesRes.data as Vehicle[]);
        if (docsRes.data) setDocuments(docsRes.data as LoadDocument[]);
        if (podsRes.data) setPods(podsRes.data as ProofOfDelivery[]);
        setLoading(false);
    }, [user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Lookups ──────────────────────────────────────
    const driverName = (id: string | null) => drivers.find(d => d.id === id)?.full_name || "—";
    const vehicleName = (id: string | null) => vehicles.find(v => v.id === id)?.vehicle_name || "—";
    const docsForLoad = (loadId: string) => documents.filter(d => d.load_id === loadId);
    const podForLoad = (loadId: string) => pods.find(p => p.load_id === loadId);
    const docTypeLabel = (t: string) => DOC_TYPES.find(d => d.value === t)?.label || t;
    const podStatusInfo = (s: string) => POD_STATUSES.find(p => p.value === s) || POD_STATUSES[0];

    // ── Filter loads ─────────────────────────────────
    const filteredLoads = loads.filter(l => {
        const matchesSearch = !search || [
            l.reference_number, l.client_name, l.pickup_address, l.delivery_address,
            driverName(l.driver_id),
        ].some(v => v?.toLowerCase().includes(search.toLowerCase()));
        const matchesStatus = statusFilter === "all" || l.status === statusFilter;
        const matchesHub = hubFilter === "all" || l.hub === hubFilter;
        const matchesPod = podFilter === "all"
            || (podFilter === "has_pod" && podForLoad(l.id))
            || (podFilter === "no_pod" && !podForLoad(l.id))
            || (podFilter === "has_docs" && docsForLoad(l.id).length > 0)
            || (podFilter === "needs_docs" && docsForLoad(l.id).length === 0);
        return matchesSearch && matchesStatus && matchesHub && matchesPod;
    });

    // ── Stats ────────────────────────────────────────
    const totalLoads = loads.length;
    const withPod = loads.filter(l => podForLoad(l.id)).length;
    const verifiedPods = pods.filter(p => p.status === "verified").length;
    const pendingPods = pods.filter(p => p.status === "submitted").length;
    const totalDocs = documents.length;

    // ── Upload Document ──────────────────────────────
    const handleUploadDoc = async () => {
        if (!selectedLoad || !uploadFile || !user) return;
        setUploading(true);
        try {
            const ext = uploadFile.name.split(".").pop() || "pdf";
            const storagePath = `loads/${selectedLoad.id}/docs/${Date.now()}_${uploadFile.name}`;

            const { error: storageErr } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(storagePath, uploadFile, { upsert: false });

            if (storageErr) throw storageErr;

            const { error: dbErr } = await supabase.from("load_documents").insert({
                load_id: selectedLoad.id,
                document_type: uploadDocType,
                file_name: uploadFile.name,
                file_path: storagePath,
                file_size_bytes: uploadFile.size,
                mime_type: uploadFile.type,
                notes: uploadNotes || null,
                uploaded_by: user.id,
            });

            if (dbErr) throw dbErr;

            toast({ title: "Document uploaded", description: `${uploadFile.name} attached to load.` });
            setShowUploadDialog(false);
            resetUploadForm();
            fetchData();
        } catch (err: any) {
            toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        }
        setUploading(false);
    };

    const resetUploadForm = () => {
        setUploadDocType("bol");
        setUploadNotes("");
        setUploadFile(null);
    };

    // ── Delete Document ──────────────────────────────
    const handleDeleteDoc = async (doc: LoadDocument) => {
        await supabase.storage.from(STORAGE_BUCKET).remove([doc.file_path]);
        await supabase.from("load_documents").delete().eq("id", doc.id);
        toast({ title: "Document deleted" });
        fetchData();
    };

    // ── Photo handling ───────────────────────────────
    const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setPodPhotos(prev => [...prev, ...files]);
        const urls = files.map(f => URL.createObjectURL(f));
        setPodPhotoPreviewUrls(prev => [...prev, ...urls]);
    };

    const removePhoto = (idx: number) => {
        URL.revokeObjectURL(podPhotoPreviewUrls[idx]);
        setPodPhotos(prev => prev.filter((_, i) => i !== idx));
        setPodPhotoPreviewUrls(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Signature Canvas ─────────────────────────────
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        ctx.strokeStyle = "hsl(213, 100%, 14%)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }, []);

    useEffect(() => {
        if (showPodDialog) {
            setTimeout(initCanvas, 100);
        }
    }, [showPodDialog, initCanvas]);

    const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        if ("touches" in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const { x, y } = getCanvasPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasSignature(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (!isDrawing) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const { x, y } = getCanvasPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => setIsDrawing(false);

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const getSignatureBlob = (): Promise<Blob | null> => {
        return new Promise(resolve => {
            const canvas = canvasRef.current;
            if (!canvas || !hasSignature) { resolve(null); return; }
            canvas.toBlob(resolve, "image/png");
        });
    };

    // ── Submit POD ───────────────────────────────────
    const handleSubmitPod = async () => {
        if (!selectedLoad || !user) return;
        setSubmittingPod(true);

        try {
            // Upload photos
            const photoPaths: string[] = [];
            for (const photo of podPhotos) {
                const path = `loads/${selectedLoad.id}/pod/photos/${Date.now()}_${photo.name}`;
                const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, photo);
                if (error) throw error;
                photoPaths.push(path);
            }

            // Upload signature
            let signaturePath: string | null = null;
            const sigBlob = await getSignatureBlob();
            if (sigBlob) {
                const path = `loads/${selectedLoad.id}/pod/signature_${Date.now()}.png`;
                const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, sigBlob);
                if (error) throw error;
                signaturePath = path;
            }

            // Check if POD already exists
            const existing = podForLoad(selectedLoad.id);
            if (existing) {
                // Update existing
                const { error } = await supabase.from("proof_of_delivery").update({
                    photo_paths: photoPaths.length > 0 ? photoPaths : existing.photo_paths,
                    signature_path: signaturePath || existing.signature_path,
                    recipient_name: podRecipient || existing.recipient_name,
                    delivery_notes: podNotes || existing.delivery_notes,
                    delivery_time: new Date().toISOString(),
                    status: "submitted",
                    submitted_by: user.id,
                    updated_at: new Date().toISOString(),
                }).eq("id", existing.id);
                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase.from("proof_of_delivery").insert({
                    load_id: selectedLoad.id,
                    photo_paths: photoPaths,
                    signature_path: signaturePath,
                    recipient_name: podRecipient || null,
                    delivery_notes: podNotes || null,
                    delivery_time: new Date().toISOString(),
                    status: "submitted",
                    submitted_by: user.id,
                });
                if (error) throw error;
            }

            // Mark load as POD confirmed
            await supabase.from("daily_loads").update({ pod_confirmed: true }).eq("id", selectedLoad.id);

            toast({ title: "POD Submitted!", description: "Proof of delivery has been recorded." });
            setShowPodDialog(false);
            resetPodForm();
            fetchData();
        } catch (err: any) {
            toast({ title: "POD submission failed", description: err.message, variant: "destructive" });
        }
        setSubmittingPod(false);
    };

    const resetPodForm = () => {
        podPhotoPreviewUrls.forEach(u => URL.revokeObjectURL(u));
        setPodPhotos([]);
        setPodPhotoPreviewUrls([]);
        setPodRecipient("");
        setPodNotes("");
        setHasSignature(false);
    };

    // ── Verify / Reject POD ──────────────────────────
    const handleVerifyPod = async (pod: ProofOfDelivery) => {
        await supabase.from("proof_of_delivery").update({
            status: "verified",
            verified_by: user?.id,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("id", pod.id);
        toast({ title: "POD Verified ✓" });
        fetchData();
    };

    const handleRejectPod = async (pod: ProofOfDelivery, reason: string) => {
        await supabase.from("proof_of_delivery").update({
            status: "rejected",
            rejection_reason: reason,
            verified_by: user?.id,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("id", pod.id);
        // Un-confirm POD on the load
        await supabase.from("daily_loads").update({ pod_confirmed: false }).eq("id", pod.load_id);
        toast({ title: "POD Rejected", variant: "destructive" });
        fetchData();
    };

    // ── Preview file ─────────────────────────────────
    const openPreview = (path: string, mime?: string | null) => {
        setPreviewUrl(getStorageUrl(path));
        setPreviewType(mime || "");
        setShowPreviewDialog(true);
    };

    // ── Loading skeleton ─────────────────────────────
    if (loading) {
        return (
            <div className="space-y-4 animate-in">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in">
            {/* ── Header ───────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight gradient-text">POD Manager</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Upload load documents · Submit & verify proof of delivery
                    </p>
                </div>
            </div>

            {/* ── Stats Cards ──────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="relative accent-bar hover-lift">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10"><Package className="h-4 w-4 text-blue-500" /></div>
                            <div>
                                <p className="text-2xl font-bold">{totalLoads}</p>
                                <p className="text-xs text-muted-foreground">Total Loads</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative accent-bar hover-lift">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10"><CheckCircle className="h-4 w-4 text-emerald-500" /></div>
                            <div>
                                <p className="text-2xl font-bold">{withPod}</p>
                                <p className="text-xs text-muted-foreground">With POD</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative accent-bar hover-lift">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10"><Shield className="h-4 w-4 text-green-500" /></div>
                            <div>
                                <p className="text-2xl font-bold">{verifiedPods}</p>
                                <p className="text-xs text-muted-foreground">Verified</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative accent-bar hover-lift">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10"><Clock className="h-4 w-4 text-amber-500" /></div>
                            <div>
                                <p className="text-2xl font-bold">{pendingPods}</p>
                                <p className="text-xs text-muted-foreground">Pending Review</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative accent-bar hover-lift">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10"><FileText className="h-4 w-4 text-purple-500" /></div>
                            <div>
                                <p className="text-2xl font-bold">{totalDocs}</p>
                                <p className="text-xs text-muted-foreground">Documents</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Filters ──────────────────────────────── */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search loads, clients, drivers..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={podFilter} onValueChange={setPodFilter}>
                            <SelectTrigger className="w-[160px]"><SelectValue placeholder="POD Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All POD</SelectItem>
                                <SelectItem value="has_pod">Has POD</SelectItem>
                                <SelectItem value="no_pod">No POD</SelectItem>
                                <SelectItem value="has_docs">Has Docs</SelectItem>
                                <SelectItem value="needs_docs">Needs Docs</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={hubFilter} onValueChange={setHubFilter}>
                            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Hub" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Hubs</SelectItem>
                                <SelectItem value="phoenix">Phoenix</SelectItem>
                                <SelectItem value="la">Los Angeles</SelectItem>
                                <SelectItem value="atlanta">Atlanta</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* ── Loads Table ──────────────────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Truck className="h-4 w-4" /> Loads ({filteredLoads.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Date</TableHead>
                                <TableHead>Ref #</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Driver</TableHead>
                                <TableHead>Route</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center">Docs</TableHead>
                                <TableHead className="text-center">POD</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLoads.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        No loads found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLoads.map(load => {
                                    const loadDocs = docsForLoad(load.id);
                                    const loadPod = podForLoad(load.id);
                                    const podInfo = loadPod ? podStatusInfo(loadPod.status) : null;
                                    return (
                                        <TableRow key={load.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-mono text-xs">
                                                {format(new Date(load.load_date), "MM/dd")}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs font-medium">
                                                {load.reference_number || "—"}
                                            </TableCell>
                                            <TableCell className="font-medium text-sm max-w-[150px] truncate">
                                                {load.client_name || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {driverName(load.driver_id)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                                                <div className="truncate">{load.pickup_address || "—"}</div>
                                                <div className="truncate">→ {load.delivery_address || "—"}</div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className={`text-[10px] ${LOAD_STATUS_COLORS[load.status] || ""}`}>
                                                    {load.status.replace("_", " ")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {loadDocs.length > 0 ? (
                                                    <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px]">
                                                        {loadDocs.length} doc{loadDocs.length > 1 ? "s" : ""}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {loadPod && podInfo ? (
                                                    <Badge variant="secondary" className={`text-[10px] ${podInfo.color}`}>
                                                        <podInfo.icon className="h-3 w-3 mr-1" />
                                                        {podInfo.label}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 gap-1 text-xs"
                                                        onClick={() => {
                                                            setSelectedLoad(load);
                                                            setShowUploadDialog(true);
                                                        }}
                                                    >
                                                        <Upload className="h-3 w-3" /> Docs
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 gap-1 text-xs"
                                                        onClick={() => {
                                                            setSelectedLoad(load);
                                                            const existing = podForLoad(load.id);
                                                            if (existing) {
                                                                setPodRecipient(existing.recipient_name || "");
                                                                setPodNotes(existing.delivery_notes || "");
                                                            }
                                                            setShowPodDialog(true);
                                                        }}
                                                    >
                                                        <Camera className="h-3 w-3" /> POD
                                                    </Button>
                                                    {loadPod && loadPod.status === "submitted" && isOwner && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs text-emerald-600"
                                                                onClick={() => handleVerifyPod(loadPod)}
                                                            >
                                                                <CheckCircle className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs text-red-600"
                                                                onClick={() => handleRejectPod(loadPod, "Incomplete or unclear POD")}
                                                            >
                                                                <XCircle className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════ */}
            {/* UPLOAD DOCUMENTS DIALOG                    */}
            {/* ═══════════════════════════════════════════ */}
            <Dialog open={showUploadDialog} onOpenChange={(o) => { if (!o) { setShowUploadDialog(false); resetUploadForm(); } }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-purple-500" />
                            Load Documents
                        </DialogTitle>
                        <DialogDescription>
                            {selectedLoad?.reference_number || "Load"} · {selectedLoad?.client_name || "—"} · {selectedLoad ? format(new Date(selectedLoad.load_date), "MMM d, yyyy") : ""}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Existing documents */}
                    {selectedLoad && docsForLoad(selectedLoad.id).length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-muted-foreground">Attached Documents</h4>
                            <div className="space-y-1.5">
                                {docsForLoad(selectedLoad.id).map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-1.5 rounded bg-purple-500/10">
                                                <FileText className="h-4 w-4 text-purple-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{doc.file_name}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {docTypeLabel(doc.document_type)} · {fmtBytes(doc.file_size_bytes)} · {format(new Date(doc.created_at), "MMM d, h:mm a")}
                                                </p>
                                                {doc.notes && <p className="text-[11px] text-muted-foreground mt-0.5 italic">{doc.notes}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openPreview(doc.file_path, doc.mime_type)}>
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                                                <a href={getStorageUrl(doc.file_path)} target="_blank" rel="noopener noreferrer" download>
                                                    <Download className="h-3.5 w-3.5" />
                                                </a>
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteDoc(doc)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload new document */}
                    <div className="space-y-4 pt-2 border-t">
                        <h4 className="text-sm font-semibold text-muted-foreground">Upload New Document</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Document Type</Label>
                                <Select value={uploadDocType} onValueChange={setUploadDocType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Notes (optional)</Label>
                                <Input value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} placeholder="e.g. Updated BOL" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>File</Label>
                            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                                />
                                {uploadFile ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        <span className="font-medium text-sm">{uploadFile.name}</span>
                                        <span className="text-xs text-muted-foreground">({fmtBytes(uploadFile.size)})</span>
                                    </div>
                                ) : (
                                    <div>
                                        <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                                        <p className="text-sm text-muted-foreground">Drop file here or click to browse</p>
                                        <p className="text-[11px] text-muted-foreground/60 mt-1">PDF, images, Word, Excel — up to 10 MB</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowUploadDialog(false); resetUploadForm(); }}>Close</Button>
                        <Button
                            className="btn-gradient gap-2"
                            disabled={!uploadFile || uploading}
                            onClick={handleUploadDoc}
                        >
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Upload Document
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════ */}
            {/* SUBMIT POD DIALOG                          */}
            {/* ═══════════════════════════════════════════ */}
            <Dialog open={showPodDialog} onOpenChange={(o) => { if (!o) { setShowPodDialog(false); resetPodForm(); } }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-emerald-500" />
                            Proof of Delivery
                        </DialogTitle>
                        <DialogDescription>
                            {selectedLoad?.reference_number || "Load"} · {selectedLoad?.client_name || "—"} · {selectedLoad ? format(new Date(selectedLoad.load_date), "MMM d, yyyy") : ""}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Show existing POD info if verified/rejected */}
                    {selectedLoad && podForLoad(selectedLoad.id) && (
                        <div className="space-y-3">
                            {(() => {
                                const pod = podForLoad(selectedLoad.id)!;
                                const info = podStatusInfo(pod.status);
                                return (
                                    <div className={`flex items-center gap-2 p-3 rounded-lg border ${info.color}`}>
                                        <info.icon className="h-4 w-4" />
                                        <span className="font-medium text-sm">Status: {info.label}</span>
                                        {pod.verified_at && (
                                            <span className="text-xs opacity-70 ml-auto">
                                                {format(new Date(pod.verified_at), "MMM d, h:mm a")}
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Show existing photos */}
                            {podForLoad(selectedLoad.id)!.photo_paths.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-muted-foreground">Existing Photos</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {podForLoad(selectedLoad.id)!.photo_paths.map((path, i) => (
                                            <div
                                                key={i}
                                                className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:ring-2 ring-primary transition-all"
                                                onClick={() => openPreview(path, "image/")}
                                            >
                                                <img src={getStorageUrl(path)} alt={`POD photo ${i + 1}`} className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Show existing signature */}
                            {podForLoad(selectedLoad.id)!.signature_path && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-muted-foreground">Signature</h4>
                                    <div className="border rounded-lg p-2 bg-white dark:bg-muted/20 max-w-[300px]">
                                        <img src={getStorageUrl(podForLoad(selectedLoad.id)!.signature_path!)} alt="Signature" className="h-20 object-contain" />
                                    </div>
                                </div>
                            )}

                            {podForLoad(selectedLoad.id)!.rejection_reason && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Rejection reason:</p>
                                    <p className="text-sm mt-1">{podForLoad(selectedLoad.id)!.rejection_reason}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Show load documents to driver */}
                    {selectedLoad && docsForLoad(selectedLoad.id).length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Load Documents
                            </h4>
                            <div className="space-y-1">
                                {docsForLoad(selectedLoad.id).map(doc => (
                                    <div key={doc.id} className="flex items-center gap-2 p-2 rounded border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                                        onClick={() => openPreview(doc.file_path, doc.mime_type)}
                                    >
                                        <FileText className="h-4 w-4 text-purple-500 shrink-0" />
                                        <span className="text-sm truncate">{doc.file_name}</span>
                                        <Badge variant="secondary" className="text-[10px] shrink-0">{docTypeLabel(doc.document_type)}</Badge>
                                        <Eye className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* POD submission form */}
                    <div className="space-y-4 pt-2 border-t">
                        <h4 className="text-sm font-semibold text-muted-foreground">
                            {podForLoad(selectedLoad?.id || "")?.status === "rejected" ? "Re-submit POD" : "Submit POD"}
                        </h4>

                        {/* Photos */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Camera className="h-4 w-4" /> Delivery Photos
                            </Label>
                            <div className="grid grid-cols-4 gap-2">
                                {podPhotoPreviewUrls.map((url, i) => (
                                    <div key={i} className="aspect-square rounded-lg overflow-hidden border relative group">
                                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removePhoto(i)}
                                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                <label className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
                                    <Camera className="h-6 w-6 text-muted-foreground/50" />
                                    <span className="text-[10px] text-muted-foreground mt-1">Add Photo</span>
                                </label>
                            </div>
                        </div>

                        {/* Signature */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                    <PenTool className="h-4 w-4" /> Recipient Signature
                                </Label>
                                {hasSignature && (
                                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearSignature}>
                                        Clear
                                    </Button>
                                )}
                            </div>
                            <div className="border rounded-lg bg-white dark:bg-slate-900 overflow-hidden relative" style={{ touchAction: "none" }}>
                                <canvas
                                    ref={canvasRef}
                                    className="w-full cursor-crosshair"
                                    style={{ height: "150px" }}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                                {!hasSignature && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <p className="text-sm text-muted-foreground/40">Sign here</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recipient name */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Recipient Name</Label>
                                <Input
                                    value={podRecipient}
                                    onChange={e => setPodRecipient(e.target.value)}
                                    placeholder="Who signed for it?"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Delivery Notes</Label>
                                <Input
                                    value={podNotes}
                                    onChange={e => setPodNotes(e.target.value)}
                                    placeholder="e.g. Left at front desk"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowPodDialog(false); resetPodForm(); }}>Cancel</Button>
                        <Button
                            className="btn-gradient gap-2"
                            disabled={submittingPod || (podPhotos.length === 0 && !hasSignature && !podRecipient && !podNotes)}
                            onClick={handleSubmitPod}
                        >
                            {submittingPod ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Submit POD
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════ */}
            {/* FILE PREVIEW DIALOG                        */}
            {/* ═══════════════════════════════════════════ */}
            <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>File Preview</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center min-h-[400px] bg-muted/20 rounded-lg overflow-hidden">
                        {previewType.startsWith("image") || previewUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
                            <img src={previewUrl} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
                        ) : previewType === "application/pdf" || previewUrl.endsWith(".pdf") ? (
                            <iframe src={previewUrl} className="w-full h-[70vh]" title="PDF Preview" />
                        ) : (
                            <div className="text-center p-8">
                                <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                                <p className="text-muted-foreground">Preview not available for this file type</p>
                                <Button variant="outline" size="sm" className="mt-3 gap-2" asChild>
                                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" download>
                                        <Download className="h-4 w-4" /> Download File
                                    </a>
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
