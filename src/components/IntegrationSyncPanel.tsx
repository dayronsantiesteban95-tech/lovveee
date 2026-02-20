import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    RefreshCw, CheckCircle2, AlertCircle, Clock, Zap, ArrowDownToLine,
    Plug, PlugZap, Settings2,
} from "lucide-react";

// --- Types ---------------------------------------------

type SyncSource = "onfleet" | "ontime360";

interface SyncResult {
    source: SyncSource;
    synced: number;
    errors: string[];
    timestamp: string;
}

interface IntegrationSyncPanelProps {
    onSyncOnfleet?: () => Promise<{ synced: number; errors: string[] }>;
    onSyncOntime360?: () => Promise<{ synced: number; errors: string[] }>;
    onfleetConnected?: boolean;
    ontime360Connected?: boolean;
    lastSync?: SyncResult | null;
    onOpenSettings?: () => void;
}

// --- Component -----------------------------------------

export default function IntegrationSyncPanel({
    onSyncOnfleet,
    onSyncOntime360,
    onfleetConnected = false,
    ontime360Connected = false,
    lastSync,
    onOpenSettings,
}: IntegrationSyncPanelProps) {
    const { toast } = useToast();
    const [syncing, setSyncing] = useState<SyncSource | null>(null);
    const [results, setResults] = useState<SyncResult | null>(lastSync ?? null);

    const handleSync = useCallback(
        async (source: SyncSource) => {
            setSyncing(source);
            try {
                const handler = source === "onfleet" ? onSyncOnfleet : onSyncOntime360;
                if (!handler) {
                    toast({ title: "Not connected", description: `${source} integration is not configured.`, variant: "destructive" });
                    return;
                }
                const result = await handler();
                const syncResult: SyncResult = {
                    source,
                    synced: result.synced,
                    errors: result.errors,
                    timestamp: new Date().toISOString(),
                };
                setResults(syncResult);

                if (result.errors.length > 0) {
                    toast({
                        title: "Synced with warnings",
                        description: `${result.synced} loads synced, ${result.errors.length} errors from ${source}.`,
                        variant: "destructive",
                    });
                } else {
                    toast({
                        title: `? Sync complete`,
                        description: `${result.synced} loads synced from ${source === "onfleet" ? "Onfleet" : "OnTime 360"}.`,
                    });
                }
            } catch (e) {
                toast({
                    title: "Sync failed",
                    description: e instanceof Error ? e.message : "Unknown error",
                    variant: "destructive",
                });
            } finally {
                setSyncing(null);
            }
        },
        [onSyncOnfleet, onSyncOntime360, toast],
    );

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    };

    return (
        <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Integration Sync
                    </h3>
                    {onOpenSettings && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onOpenSettings}>
                            <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                {/* Integration Cards */}
                <div className="grid grid-cols-2 gap-2">
                    {/* Onfleet */}
                    <div className={`rounded-xl border p-3 transition-all ${onfleetConnected ? "border-green-500/30 bg-green-500/5" : "border-dashed border-muted-foreground/20 bg-muted/5"}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {onfleetConnected ? (
                                <PlugZap className="h-4 w-4 text-green-500" />
                            ) : (
                                <Plug className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-xs font-semibold">Onfleet</span>
                            <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ml-auto ${onfleetConnected ? "text-green-600 border-green-500/30" : "text-muted-foreground"}`}
                            >
                                {onfleetConnected ? "Connected" : "Not Set Up"}
                            </Badge>
                        </div>
                        <Button
                            variant={onfleetConnected ? "default" : "outline"}
                            size="sm"
                            className="w-full h-7 text-xs gap-1"
                            disabled={!onfleetConnected || syncing !== null}
                            onClick={() => handleSync("onfleet")}
                        >
                            {syncing === "onfleet" ? (
                                <><RefreshCw className="h-3 w-3 animate-spin" /> Syncing...</>
                            ) : (
                                <><ArrowDownToLine className="h-3 w-3" /> Sync Loads</>
                            )}
                        </Button>
                    </div>

                    {/* OnTime 360 */}
                    <div className={`rounded-xl border p-3 transition-all ${ontime360Connected ? "border-blue-500/30 bg-blue-500/5" : "border-dashed border-muted-foreground/20 bg-muted/5"}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {ontime360Connected ? (
                                <PlugZap className="h-4 w-4 text-blue-500" />
                            ) : (
                                <Plug className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-xs font-semibold">OnTime 360</span>
                            <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ml-auto ${ontime360Connected ? "text-blue-600 border-blue-500/30" : "text-muted-foreground"}`}
                            >
                                {ontime360Connected ? "Connected" : "Not Set Up"}
                            </Badge>
                        </div>
                        <Button
                            variant={ontime360Connected ? "default" : "outline"}
                            size="sm"
                            className="w-full h-7 text-xs gap-1"
                            disabled={!ontime360Connected || syncing !== null}
                            onClick={() => handleSync("ontime360")}
                        >
                            {syncing === "ontime360" ? (
                                <><RefreshCw className="h-3 w-3 animate-spin" /> Syncing...</>
                            ) : (
                                <><ArrowDownToLine className="h-3 w-3" /> Sync Orders</>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Last Sync Result */}
                {results && (
                    <div className="rounded-lg bg-muted/30 px-3 py-2 text-[11px] flex items-center gap-2">
                        {results.errors.length > 0 ? (
                            <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        )}
                        <span>
                            <strong>{results.synced}</strong> loads synced from{" "}
                            <strong>{results.source === "onfleet" ? "Onfleet" : "OnTime 360"}</strong>
                            {results.errors.length > 0 && (
                                <span className="text-yellow-600"> ? {results.errors.length} errors</span>
                            )}
                        </span>
                        <span className="ml-auto text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> {formatTime(results.timestamp)}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
