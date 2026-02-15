/**
 * ═══════════════════════════════════════════════════════════
 * CUSTOMER ORDER HISTORY — Full Delivery History by Client
 *
 * Quick drawer/panel that shows all past deliveries for a
 * given client or customer. Includes stats, repeat frequency,
 * and one-click clone to create a similar load.
 *
 * Inspired by Onfleet's recipient history feature.
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
    History, Search, Package, CheckCircle2, Clock, Copy,
    TrendingUp, MapPin, DollarSign, RefreshCw, X, User,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────

interface OrderHistoryEntry {
    id: string;
    reference_number: string | null;
    load_date: string;
    status: string;
    delivery_address: string | null;
    packages: number;
    revenue: number;
    service_type: string;
    driver_name?: string;
    pod_confirmed: boolean;
}

interface CustomerStats {
    totalOrders: number;
    totalRevenue: number;
    avgRevenue: number;
    deliveredCount: number;
    successRate: number;
    topAddresses: { address: string; count: number }[];
    firstOrder: string;
    lastOrder: string;
}

interface CustomerOrderHistoryProps {
    clientName?: string;
    onClone?: (load: OrderHistoryEntry) => void;
    onClose?: () => void;
}

// ═══════════════════════════════════════════════════════════

export default function CustomerOrderHistory({
    clientName: initialClient, onClone, onClose,
}: CustomerOrderHistoryProps) {
    const [clientName, setClientName] = useState(initialClient ?? "");
    const [searchInput, setSearchInput] = useState(initialClient ?? "");
    const [orders, setOrders] = useState<OrderHistoryEntry[]>([]);
    const [stats, setStats] = useState<CustomerStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    // Fetch unique client names for autocomplete
    useEffect(() => {
        const fetchClients = async () => {
            const { data } = await (supabase as any)
                .from("daily_loads")
                .select("client_name")
                .not("client_name", "is", null)
                .order("created_at", { ascending: false })
                .limit(200) as { data: { client_name: string }[] | null };

            if (data) {
                const unique = [...new Set(data.map((d) => d.client_name).filter(Boolean))];
                setSuggestions(unique);
            }
        };
        fetchClients();
    }, []);

    // Fetch order history
    const fetchHistory = async (name: string) => {
        if (!name.trim()) return;
        setLoading(true);
        const sanitized = name.trim()
            .replace(/%/g, "\\%")  // Escape SQL wildcard
            .replace(/_/g, "\\_"); // Escape SQL single-char wildcard
        setClientName(name.trim());

        const { data } = await (supabase as any)
            .from("daily_loads")
            .select(`
        id, reference_number, load_date, status,
        delivery_address, packages, revenue, service_type,
        pod_confirmed, driver_id
      `)
            .ilike("client_name", `%${sanitized}%`)
            .order("load_date", { ascending: false })
            .limit(100) as { data: any[] | null };

        if (data && data.length > 0) {
            setOrders(data);

            // Calculate stats
            const totalRevenue = data.reduce((sum: number, d: any) => sum + (d.revenue ?? 0), 0);
            const deliveredCount = data.filter((d: any) => d.status === "delivered").length;

            // Top addresses
            const addrMap = new Map<string, number>();
            for (const d of data) {
                if (d.delivery_address) {
                    addrMap.set(d.delivery_address, (addrMap.get(d.delivery_address) ?? 0) + 1);
                }
            }
            const topAddresses = [...addrMap.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([address, count]) => ({ address, count }));

            setStats({
                totalOrders: data.length,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                avgRevenue: Math.round((totalRevenue / data.length) * 100) / 100,
                deliveredCount,
                successRate: Math.round((deliveredCount / data.length) * 100),
                topAddresses,
                firstOrder: data[data.length - 1].load_date,
                lastOrder: data[0].load_date,
            });
        } else {
            setOrders([]);
            setStats(null);
        }
        setLoading(false);
    };

    // Auto-fetch if initial client provided
    useEffect(() => {
        if (initialClient) fetchHistory(initialClient);
    }, [initialClient]);

    return (
        <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        Customer Order History
                    </h3>
                    {onClose && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* Search */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                            placeholder="Search client name..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchHistory(searchInput)}
                            className="h-8 text-xs pl-7"
                            list="client-suggestions"
                        />
                        <datalist id="client-suggestions">
                            {suggestions.map((s, i) => (
                                <option key={i} value={s} />
                            ))}
                        </datalist>
                    </div>
                    <Button
                        size="sm" className="h-8"
                        onClick={() => fetchHistory(searchInput)}
                        disabled={loading || !searchInput.trim()}
                    >
                        {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                    </Button>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-muted/30">
                            <p className="text-[9px] text-muted-foreground">Orders</p>
                            <p className="text-sm font-bold">{stats.totalOrders}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/30">
                            <p className="text-[9px] text-muted-foreground">Revenue</p>
                            <p className="text-sm font-bold">${stats.totalRevenue.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/30">
                            <p className="text-[9px] text-muted-foreground">Avg/Order</p>
                            <p className="text-sm font-bold">${stats.avgRevenue}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <p className="text-[9px] text-muted-foreground">Success</p>
                            <p className="text-sm font-bold text-green-600">{stats.successRate}%</p>
                        </div>
                    </div>
                )}

                {/* Top addresses */}
                {stats && stats.topAddresses.length > 0 && (
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                            Frequently Used Addresses
                        </p>
                        {stats.topAddresses.map((addr, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs py-1">
                                <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                <span className="truncate flex-1 text-muted-foreground">{addr.address}</span>
                                <Badge variant="secondary" className="text-[9px]">{addr.count}x</Badge>
                            </div>
                        ))}
                    </div>
                )}

                {/* Order list */}
                {orders.length > 0 && (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            Recent Orders ({orders.length})
                        </p>
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors text-xs"
                            >
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${order.status === "delivered" ? "bg-green-500/10" : "bg-muted/50"
                                    }`}>
                                    {order.status === "delivered" ? (
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <Package className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                            {order.reference_number ?? "—"}
                                        </span>
                                        <span className="text-muted-foreground/30">·</span>
                                        <span className="text-muted-foreground">{order.load_date}</span>
                                    </div>
                                    <p className="truncate text-muted-foreground">{order.delivery_address ?? "—"}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-medium">${order.revenue}</p>
                                    <p className="text-[9px] text-muted-foreground">{order.packages} pkg</p>
                                </div>
                                {onClone && (
                                    <Button
                                        variant="ghost" size="sm"
                                        className="h-6 w-6 p-0 shrink-0"
                                        onClick={() => onClone(order)}
                                        title="Clone this load"
                                    >
                                        <Copy className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {clientName && !loading && orders.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                        No orders found for "{clientName}"
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
