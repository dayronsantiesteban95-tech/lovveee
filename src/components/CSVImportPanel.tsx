/**
 * -----------------------------------------------------------
 * CSV IMPORT / EXPORT -- Bulk Load Operations
 *
 * Import:  Drag & drop or file picker for CSV/Excel files.
 *          Auto-maps columns, shows preview, bulk inserts.
 *
 * Export:  One-click export any filtered load list to CSV.
 *
 * Replaces the manual "paste from Google Sheet" workflow.
 * -----------------------------------------------------------
 */
import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { captureScopedError } from "@/lib/sentry";
import { geocodeAddress } from "@/utils/geocodeAddress";
import {
    Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle,
    X, ArrowRight, RefreshCw, FileText, Table2,
} from "lucide-react";

// --- Column mapping ---------------------------------

const DB_COLUMNS = [
    { key: "reference_number", label: "Reference #", example: "REF-001" },
    { key: "client_name", label: "Client Name", example: "Acme Corp" },
    { key: "pickup_address", label: "Pickup Address", example: "123 Main St" },
    { key: "delivery_address", label: "Delivery Address", example: "456 Oak Ave" },
    { key: "customer_name", label: "Customer Name", example: "John Doe" },
    { key: "customer_phone", label: "Customer Phone", example: "602-555-1234" },
    { key: "customer_email", label: "Customer Email", example: "john@example.com" },
    { key: "packages", label: "Packages", example: "3" },
    { key: "service_type", label: "Service Type", example: "same_day" },
    { key: "hub", label: "Hub", example: "phoenix" },
    { key: "comments", label: "Comments", example: "Fragile" },
    { key: "start_time", label: "Pickup Time", example: "09:00" },
    { key: "weight_lbs", label: "Weight (lbs)", example: "25" },
    { key: "revenue", label: "Revenue ($)", example: "45.00" },
    { key: "miles", label: "Miles", example: "12.5" },
];

// --- CSV Parser -------------------------------------

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === "," && !inQuotes) {
                result.push(current.trim());
                current = "";
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);
    return { headers, rows };
}

// --- Auto-map columns ------------------------------

function autoMapColumns(csvHeaders: string[]): Record<number, string> {
    const mapping: Record<number, string> = {};
    const aliases: Record<string, string[]> = {
        reference_number: ["reference", "ref", "ref #", "ref#", "waybill", "tracking", "order #", "order", "order_number"],
        client_name: ["client", "customer", "company", "shipper", "sender", "account"],
        pickup_address: ["pickup", "origin", "from", "pickup address", "from address", "pickup_address"],
        delivery_address: ["delivery", "destination", "to", "deliver to", "delivery address", "drop", "dropoff", "to address", "delivery_address"],
        customer_name: ["recipient", "receiver", "consignee", "deliver to name", "customer_name"],
        customer_phone: ["phone", "tel", "mobile", "contact phone", "customer_phone"],
        customer_email: ["email", "e-mail", "customer_email"],
        packages: ["packages", "pieces", "qty", "quantity", "items", "pcs", "count"],
        service_type: ["service", "type", "service type", "priority", "service_type"],
        hub: ["hub", "zone", "area", "region", "terminal"],
        comments: ["comments", "notes", "instructions", "special", "remarks"],
        start_time: ["time", "pickup time", "start", "scheduled", "start_time"],
        weight_lbs: ["weight", "lbs", "pounds", "wt", "weight_lbs"],
        revenue: ["revenue", "price", "rate", "charge", "amount", "cost", "total"],
        miles: ["miles", "distance", "mi"],
    };

    csvHeaders.forEach((header, idx) => {
        const normalized = header.toLowerCase().trim().replace(/[_\-\s]+/g, " ");
        for (const [dbCol, names] of Object.entries(aliases)) {
            if (names.some((n) => normalized === n || normalized.includes(n))) {
                if (!Object.values(mapping).includes(dbCol)) {
                    mapping[idx] = dbCol;
                    break;
                }
            }
        }
    });

    return mapping;
}

// --- Export to CSV ----------------------------------

export function exportToCSV(rows: Record<string, any>[], filename: string) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
        headers.join(","),
        ...rows.map((row) =>
            headers.map((h) => {
                const val = row[h] ?? "";
                const str = String(val);
                return str.includes(",") || str.includes('"') || str.includes("\n")
                    ? `"${str.replace(/"/g, '""')}"`
                    : str;
            }).join(","),
        ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// -----------------------------------------------------------

interface CSVImportPanelProps {
    onImportComplete?: (count: number) => void;
    loadDate?: string;
    hub?: string;
}

export default function CSVImportPanel({ onImportComplete, loadDate, hub }: CSVImportPanelProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const fileRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvRows, setCsvRows] = useState<string[][]>([]);
    const [columnMap, setColumnMap] = useState<Record<number, string>>({});
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState({ success: 0, errors: 0 });
    const [dragOver, setDragOver] = useState(false);

    const handleFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const { headers, rows } = parseCSV(text);
            if (headers.length === 0) {
                toast({ title: "Empty file", description: "No data found in the CSV.", variant: "destructive" });
                return;
            }
            setCsvHeaders(headers);
            setCsvRows(rows);
            setColumnMap(autoMapColumns(headers));
            setStep("preview");
        };
        reader.readAsText(file);
    }, [toast]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith(".csv") || file.name.endsWith(".txt"))) {
            handleFile(file);
        } else {
            toast({ title: "Invalid file", description: "Please upload a .csv file.", variant: "destructive" });
        }
    }, [handleFile, toast]);

    const handleImport = async () => {
        if (!user) return;
        setImporting(true);
        setStep("importing");
        let success = 0;
        let errors = 0;
        const today = loadDate ?? new Date().toISOString().split("T")[0];

        // Build all payloads first, then batch insert
        const payloads: Record<string, any>[] = [];

        for (const row of csvRows) {
            const payload: Record<string, any> = {
                load_date: today,
                hub: hub ?? "phoenix",
                status: "pending",
                created_by: user.id,
            };

            // Map columns
            for (const [csvIdx, dbCol] of Object.entries(columnMap)) {
                const value = row[Number(csvIdx)];
                if (value !== undefined && value !== "") {
                    if (["packages", "miles", "revenue", "weight_lbs", "deadhead_miles", "driver_pay", "fuel_cost", "wait_time_minutes"].includes(dbCol)) {
                        const parsed = Number(value);
                        payload[dbCol] = Number.isFinite(parsed) ? parsed : 0;
                    } else {
                        payload[dbCol] = value;
                    }
                }
            }
            payloads.push(payload);
        }

        // Geocode addresses for geofence enforcement
        for (const p of payloads) {
            const pickup = (p as any).pickup_address;
            const delivery = (p as any).delivery_address;
            if (pickup && !(p as any).pickup_lat) {
                const coords = await geocodeAddress(pickup);
                if (coords) { (p as any).pickup_lat = coords.lat; (p as any).pickup_lng = coords.lng; }
            }
            if (delivery && !(p as any).delivery_lat) {
                const coords = await geocodeAddress(delivery);
                if (coords) { (p as any).delivery_lat = coords.lat; (p as any).delivery_lng = coords.lng; }
            }
        }

        // Batch insert in chunks of 50 for performance
        const BATCH_SIZE = 50;
        for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
            const batch = payloads.slice(i, i + BATCH_SIZE);
            try {
                const { error, data } = await supabase.from("daily_loads").insert(batch).select("id");
                if (error) throw error;
                success += data?.length ?? batch.length;
            } catch (err) {
                errors += batch.length;
                console.error(`CSV import batch ${i / BATCH_SIZE + 1} failed:`, err);
                captureScopedError("csv_import", { batchNumber: i / BATCH_SIZE + 1, batchSize: batch.length }, err);
            }
        }

        setImportResult({ success, errors });
        setImporting(false);
        setStep("done");
        toast({
            title: "Import complete",
            description: `${success} loads imported${errors > 0 ? `, ${errors} errors` : ""}`,
        });
        onImportComplete?.(success);
    };

    const updateMapping = (csvIdx: number, dbCol: string) => {
        setColumnMap((prev) => {
            const next = { ...prev };
            if (dbCol === "") {
                delete next[csvIdx];
            } else {
                // Remove existing mapping for this dbCol
                for (const [k, v] of Object.entries(next)) {
                    if (v === dbCol) delete next[Number(k)];
                }
                next[csvIdx] = dbCol;
            }
            return next;
        });
    };

    const reset = () => {
        setStep("upload");
        setCsvHeaders([]);
        setCsvRows([]);
        setColumnMap({});
        setImportResult({ success: 0, errors: 0 });
    };

    return (
        <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        Import Loads from CSV
                    </h3>
                    {step !== "upload" && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={reset}>
                            <X className="h-3 w-3 mr-1" /> Reset
                        </Button>
                    )}
                </div>

                {/* STEP: Upload */}
                {step === "upload" && (
                    <div
                        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
                            }`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileRef.current?.click()}
                    >
                        <Upload className={`h-8 w-8 mx-auto mb-2 ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
                        <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">Supports .csv files with headers</p>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,.txt"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFile(file);
                                // Reset so same file can be re-uploaded
                                e.target.value = "";
                            }}
                        />
                    </div>
                )}

                {/* STEP: Preview & Column Mapping */}
                {step === "preview" && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Table2 className="h-3.5 w-3.5" />
                            {csvRows.length} rows ? {csvHeaders.length} columns ? {Object.keys(columnMap).length} mapped
                        </div>

                        {/* Column mapping */}
                        <div className="max-h-60 overflow-y-auto space-y-1.5">
                            {csvHeaders.map((header, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                    <span className="w-28 truncate text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded">
                                        {header}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                                    <select
                                        value={columnMap[idx] ?? ""}
                                        onChange={(e) => updateMapping(idx, e.target.value)}
                                        className="flex-1 h-7 rounded border bg-background px-2 text-xs"
                                    >
                                        <option value="">-- Skip --</option>
                                        {DB_COLUMNS.map((col) => (
                                            <option key={col.key} value={col.key}>
                                                {col.label}
                                            </option>
                                        ))}
                                    </select>
                                    {columnMap[idx] && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                                </div>
                            ))}
                        </div>

                        {/* Preview first 3 rows */}
                        <div className="text-xs text-muted-foreground">
                            <p className="font-semibold mb-1">Preview (first 3 rows):</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[10px]">
                                    <thead>
                                        <tr>
                                            {Object.entries(columnMap).map(([csvIdx, dbCol]) => (
                                                <th key={csvIdx} className="text-left p-1 border-b font-semibold">
                                                    {DB_COLUMNS.find((c) => c.key === dbCol)?.label ?? dbCol}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {csvRows.slice(0, 3).map((row, i) => (
                                            <tr key={i}>
                                                {Object.keys(columnMap).map((csvIdx) => (
                                                    <td key={csvIdx} className="p-1 border-b truncate max-w-[120px]">
                                                        {row[Number(csvIdx)] ?? "--"}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <Button
                            onClick={handleImport}
                            disabled={Object.keys(columnMap).length === 0}
                            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                        >
                            <Upload className="h-4 w-4" /> Import {csvRows.length} Loads
                        </Button>
                    </div>
                )}

                {/* STEP: Importing */}
                {step === "importing" && (
                    <div className="py-6 text-center space-y-3">
                        <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto" />
                        <p className="text-sm font-medium">Importing loads...</p>
                        <p className="text-xs text-muted-foreground">This may take a moment for large files</p>
                    </div>
                )}

                {/* STEP: Done */}
                {step === "done" && (
                    <div className="py-4 text-center space-y-3">
                        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
                        <div>
                            <p className="text-sm font-semibold">Import Complete!</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {importResult.success} loads imported successfully
                                {importResult.errors > 0 && (
                                    <span className="text-red-500"> ? {importResult.errors} errors</span>
                                )}
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={reset}>Import More</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
