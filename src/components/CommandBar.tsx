/**
 * -----------------------------------------------------------
 * COMMAND BAR -- ?K / Ctrl+K Spotlight Search
 *
 * Press Ctrl+K (or ?K on Mac) from ANYWHERE in the app to:
 *   * Search loads by reference #, client, address, status
 *   * Search drivers by name, hub, status
 *   * Search customers / companies
 *   * Quick-navigate to any page
 *   * Run quick actions (create load, assign driver, etc.)
 *
 * Designed to feel like Raycast / Linear -- instant, keyboard-driven.
 * -----------------------------------------------------------
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
    Package, Truck, Users, Building2, MapPin, Search, ArrowRight,
    Navigation, Plus, FileText, BarChart3, Settings, Zap,
    Hash, Clock, CheckCircle2, AlertCircle, Star, Route,
} from "lucide-react";

// --- Result Types --------------------------------------

type ResultCategory = "loads" | "drivers" | "customers" | "pages" | "actions";

interface SearchResult {
    id: string;
    category: ResultCategory;
    title: string;
    subtitle: string;
    icon: typeof Package;
    iconColor: string;
    action: () => void;
    badge?: string;
    badgeColor?: string;
}

// --- Quick-nav pages ----------------------------------

const PAGES: SearchResult[] = [
    { id: "nav-dashboard", category: "pages", title: "Dashboard", subtitle: "Overview & analytics", icon: BarChart3, iconColor: "text-blue-500", action: () => { }, badge: "Page" },
    { id: "nav-dispatch", category: "pages", title: "Dispatch Tracker", subtitle: "Load board, live ops, reports", icon: Package, iconColor: "text-violet-500", action: () => { }, badge: "Page" },
    { id: "nav-fleet", category: "pages", title: "Fleet Tracker", subtitle: "Vehicles & maintenance", icon: Truck, iconColor: "text-green-500", action: () => { }, badge: "Page" },
    { id: "nav-pipeline", category: "pages", title: "Sales Pipeline", subtitle: "Leads & deals", icon: Star, iconColor: "text-amber-500", action: () => { }, badge: "Page" },
    { id: "nav-rate", category: "pages", title: "Rate Calculator", subtitle: "Pricing & quotes", icon: FileText, iconColor: "text-orange-500", action: () => { }, badge: "Page" },
    { id: "nav-contacts", category: "pages", title: "Contacts", subtitle: "People & relationships", icon: Users, iconColor: "text-pink-500", action: () => { }, badge: "Page" },
    { id: "nav-companies", category: "pages", title: "Companies", subtitle: "Business accounts", icon: Building2, iconColor: "text-indigo-500", action: () => { }, badge: "Page" },
    { id: "nav-driver", category: "pages", title: "Driver Portal", subtitle: "Mobile driver app", icon: Navigation, iconColor: "text-emerald-500", action: () => { }, badge: "Page" },
];

const PAGE_ROUTES: Record<string, string> = {
    "nav-dashboard": "/dashboard",
    "nav-dispatch": "/dispatch",
    "nav-fleet": "/fleet",
    "nav-pipeline": "/pipeline",
    "nav-rate": "/rate-calculator",
    "nav-contacts": "/contacts",
    "nav-companies": "/companies",
    "nav-driver": "/driver",
};

// --- Status helpers -----------------------------------

function statusBadge(status: string): { badge: string; badgeColor: string } {
    switch (status) {
        case "delivered": return { badge: "? Delivered", badgeColor: "bg-green-500/15 text-green-600" };
        case "in_progress": return { badge: "In Transit", badgeColor: "bg-yellow-500/15 text-yellow-600" };
        case "picked_up": return { badge: "Picked Up", badgeColor: "bg-blue-500/15 text-blue-600" };
        case "assigned": return { badge: "Assigned", badgeColor: "bg-indigo-500/15 text-indigo-600" };
        case "pending": return { badge: "? Pending", badgeColor: "bg-slate-500/15 text-slate-600" };
        case "cancelled": return { badge: "? Cancelled", badgeColor: "bg-red-500/15 text-red-600" };
        default: return { badge: status, badgeColor: "bg-slate-500/15 text-slate-600" };
    }
}

// -----------------------------------------------------------
export default function CommandBar() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [searching, setSearching] = useState(false);

    // -- Keyboard shortcut ---------------------
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    // -- Focus input when opened ---------------
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery("");
            setResults([]);
            setSelectedIdx(0);
        }
    }, [open]);

    // -- Search logic --------------------------
    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            return;
        }
        setSearching(true);
        const term = q.trim().toLowerCase()
            .replace(/%/g, "\\%")   // Escape SQL wildcard
            .replace(/_/g, "\\_");  // Escape SQL single-char wildcard
        const allResults: SearchResult[] = [];

        // -- Quick actions --
        if (term.includes("new") || term.includes("create") || term.includes("add")) {
            allResults.push({
                id: "action-new-load", category: "actions",
                title: "Create New Load", subtitle: "Add a delivery to the load board",
                icon: Plus, iconColor: "text-green-500",
                action: () => { navigate("/dispatch"); setOpen(false); },
                badge: "Action", badgeColor: "bg-green-500/15 text-green-600",
            });
        }
        if (term.includes("import") || term.includes("csv") || term.includes("excel")) {
            allResults.push({
                id: "action-import", category: "actions",
                title: "Import Loads from CSV", subtitle: "Bulk upload from spreadsheet",
                icon: FileText, iconColor: "text-orange-500",
                action: () => { navigate("/dispatch"); setOpen(false); },
                badge: "Action", badgeColor: "bg-orange-500/15 text-orange-600",
            });
        }
        if (term.includes("route") || term.includes("optimize")) {
            allResults.push({
                id: "action-route", category: "actions",
                title: "Optimize Route", subtitle: "Auto-arrange delivery order",
                icon: Route, iconColor: "text-violet-500",
                action: () => { navigate("/dispatch"); setOpen(false); },
                badge: "Action", badgeColor: "bg-violet-500/15 text-violet-600",
            });
        }

        // -- Pages (filter by query) --
        const matchedPages = PAGES.filter(
            (p) => p.title.toLowerCase().includes(term) || p.subtitle.toLowerCase().includes(term),
        ).map((p) => ({
            ...p,
            action: () => { navigate(PAGE_ROUTES[p.id]); setOpen(false); },
        }));
        allResults.push(...matchedPages);

        // -- Search loads --
        try {
            const { data: loads } = await supabase
                .from("daily_loads")
                .select("id, reference_number, client_name, delivery_address, status, tracking_token, load_date")
                .or(`reference_number.ilike.%${term}%,client_name.ilike.%${term}%,delivery_address.ilike.%${term}%,tracking_token.ilike.%${term}%`)
                .order("load_date", { ascending: false })
                .limit(6) as { data: any[] | null };

            if (loads) {
                for (const load of loads) {
                    const sb = statusBadge(load.status);
                    allResults.push({
                        id: `load-${load.id}`,
                        category: "loads",
                        title: `${load.client_name ?? "Unknown"} -- ${load.reference_number ?? "No Ref"}`,
                        subtitle: load.delivery_address ?? load.load_date ?? "",
                        icon: Package,
                        iconColor: "text-violet-500",
                        action: () => { navigate("/dispatch"); setOpen(false); },
                        badge: sb.badge,
                        badgeColor: sb.badgeColor,
                    });
                }
            }
        } catch { /* ignore */ }

        // -- Search drivers --
        try {
            const { data: drivers } = await supabase
                .from("drivers")
                .select("id, full_name, hub, status, phone")
                .or(`full_name.ilike.%${term}%,hub.ilike.%${term}%,phone.ilike.%${term}%`)
                .limit(5) as { data: any[] | null };

            if (drivers) {
                for (const d of drivers) {
                    allResults.push({
                        id: `driver-${d.id}`,
                        category: "drivers",
                        title: d.full_name,
                        subtitle: `${d.hub?.charAt(0).toUpperCase()}${d.hub?.slice(1)} Hub ? ${d.status}`,
                        icon: Truck,
                        iconColor: "text-emerald-500",
                        action: () => { navigate("/dispatch"); setOpen(false); },
                        badge: d.status === "active" ? "Active" : "Inactive",
                        badgeColor: d.status === "active" ? "bg-green-500/15 text-green-600" : "bg-slate-500/15 text-slate-500",
                    });
                }
            }
        } catch { /* ignore */ }

        // -- Search contacts/companies --
        try {
            const { data: contacts } = await supabase
                .from("contacts")
                .select("id, name, email, company")
                .or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`)
                .limit(4) as { data: any[] | null };

            if (contacts) {
                for (const c of contacts) {
                    allResults.push({
                        id: `contact-${c.id}`,
                        category: "customers",
                        title: c.name,
                        subtitle: `${c.company ?? ""} ${c.email ? "| " + c.email : ""}`.trim(),
                        icon: Users,
                        iconColor: "text-pink-500",
                        action: () => { navigate("/contacts"); setOpen(false); },
                    });
                }
            }
        } catch { /* ignore */ }

        setResults(allResults);
        setSelectedIdx(0);
        setSearching(false);
    }, [navigate]);

    // -- Debounced search ----------------------
    useEffect(() => {
        if (!open) return;
        const timeout = setTimeout(() => doSearch(query), 200);
        return () => clearTimeout(timeout);
    }, [query, open, doSearch]);

    // -- Keyboard navigation -------------------
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && results[selectedIdx]) {
            e.preventDefault();
            results[selectedIdx].action();
        }
    };

    // -- Category labels -----------------------
    const grouped = useMemo(() => {
        const groups: { category: ResultCategory; label: string; items: SearchResult[] }[] = [];
        const catOrder: { key: ResultCategory; label: string }[] = [
            { key: "actions", label: "Quick Actions" },
            { key: "loads", label: "Loads" },
            { key: "drivers", label: "Drivers" },
            { key: "customers", label: "Customers" },
            { key: "pages", label: "Navigate" },
        ];
        for (const cat of catOrder) {
            const items = results.filter((r) => r.category === cat.key);
            if (items.length > 0) groups.push({ category: cat.key, label: cat.label, items });
        }
        return groups;
    }, [results]);

    // -- Flatten for index tracking ------------
    const flatResults = useMemo(() => results, [results]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />

            {/* Command palette */}
            <div
                className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl animate-in slide-in-from-top-4 fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-background rounded-xl border shadow-2xl overflow-hidden">
                    {/* Search input */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b">
                        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search loads, drivers, customers... or type a command"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted border text-muted-foreground font-mono shrink-0">
                            ESC
                        </kbd>
                    </div>

                    {/* Results */}
                    <div className="max-h-[50vh] overflow-y-auto py-1">
                        {query && grouped.length === 0 && !searching && (
                            <div className="px-4 py-8 text-center">
                                <AlertCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">No results for "{query}"</p>
                                <p className="text-xs text-muted-foreground/50 mt-1">Try searching by name, reference #, or address</p>
                            </div>
                        )}

                        {searching && query && (
                            <div className="px-4 py-6 text-center">
                                <Zap className="h-6 w-6 text-primary animate-pulse mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">Searching...</p>
                            </div>
                        )}

                        {!query && (
                            <div className="px-3 py-2">
                                <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">
                                    Quick Actions
                                </p>
                                {[
                                    { label: "Create new load", icon: Plus, color: "text-green-500", shortcut: "N" },
                                    { label: "Go to Load Board", icon: Package, color: "text-violet-500", shortcut: "L" },
                                    { label: "Go to Live Ops", icon: Navigation, color: "text-blue-500", shortcut: "O" },
                                    { label: "Optimize route", icon: Route, color: "text-orange-500", shortcut: "R" },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                        onClick={() => { navigate("/dispatch"); setOpen(false); }}
                                    >
                                        <item.icon className={`h-4 w-4 ${item.color}`} />
                                        <span className="text-sm flex-1">{item.label}</span>
                                        <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-muted border text-muted-foreground font-mono">
                                            {item.shortcut}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        )}

                        {grouped.map((group) => (
                            <div key={group.category} className="px-3 py-1">
                                <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">
                                    {group.label}
                                </p>
                                {group.items.map((result) => {
                                    const globalIdx = flatResults.indexOf(result);
                                    const isSelected = globalIdx === selectedIdx;
                                    const Icon = result.icon;
                                    return (
                                        <div
                                            key={result.id}
                                            className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                                                }`}
                                            onClick={result.action}
                                            onMouseEnter={() => setSelectedIdx(globalIdx)}
                                        >
                                            <div className={`h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0`}>
                                                <Icon className={`h-4 w-4 ${result.iconColor}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{result.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                                            </div>
                                            {result.badge && (
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${result.badgeColor ?? "bg-muted text-muted-foreground"} whitespace-nowrap shrink-0`}>
                                                    {result.badge}
                                                </span>
                                            )}
                                            {isSelected && <ArrowRight className="h-3 w-3 text-primary shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-4 text-[10px] text-muted-foreground/50">
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-muted border font-mono">Cmd+K</kbd> Navigate</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-muted border font-mono">?</kbd> Select</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-muted border font-mono">ESC</kbd> Close</span>
                        <span className="ml-auto">Ctrl+K to toggle</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
