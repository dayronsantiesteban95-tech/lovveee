import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import LiveDriverMap from "@/components/LiveDriverMap";
import IntegrationSyncPanel from "@/components/IntegrationSyncPanel";
import RouteOptimizerPanel from "@/components/RouteOptimizerPanel";
import type { Driver } from "./types";

interface LiveDriver {
    driverId: string;
    name: string;
    lat: number;
    lng: number;
    isMoving: boolean;
    shiftStatus: string;
    speed: number | null;
    heading: number | null;
    battery: number | null;
    lastSeen: string;
    activeLoadId: string | null;
}

interface LiveOpsTabProps {
    liveDrivers: LiveDriver[];
    liveDriversLoading: boolean;
    liveDriversConnected: boolean;
    refreshLiveDrivers: () => Promise<void>;
    boardLoads: { id: string; client_name: string | null; delivery_address: string | null; pickup_address: string | null; status: string; packages: number }[];
    drivers: Driver[];
    onRefetchLoads: () => void;
    onSettingsClick: () => void;
}

export default function LiveOpsTab({
    liveDrivers,
    liveDriversLoading,
    liveDriversConnected,
    refreshLiveDrivers,
    boardLoads,
    drivers,
    onRefetchLoads,
    onSettingsClick,
}: LiveOpsTabProps) {
    return (
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
                    }))}
                    loading={liveDriversLoading}
                    pollActive={liveDriversConnected}
                    onRefresh={refreshLiveDrivers}
                />
            </div>
            <div className="space-y-4">
                <IntegrationSyncPanel
                    onfleetConnected={false}
                    ontime360Connected={false}
                    onOpenSettings={onSettingsClick}
                />
                <RouteOptimizerPanel
                    loads={boardLoads.map(l => ({
                        id: l.id,
                        client_name: l.client_name,
                        delivery_address: l.delivery_address,
                        pickup_address: l.pickup_address,
                        delivery_lat: null,
                        delivery_lng: null,
                        status: l.status,
                        packages: l.packages,
                        tracking_token: null,
                    }))}
                    onRouteApplied={onRefetchLoads}
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
    );
}
