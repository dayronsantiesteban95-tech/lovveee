// -----------------------------------------------------------
// LoadSearchFilters -- Search bar + filter bar + sort for Load Board
// Used in DispatchTracker Tab 1: Load Board
// -----------------------------------------------------------
import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    X, Search, ChevronDown, ChevronUp, SlidersHorizontal,
} from "lucide-react";

// --- Types --------------------------------------------------
export type LoadSortKey = "newest" | "oldest" | "revenue_desc" | "status";

export type LoadFilters = {
    search: string;
    status: string;        // "" = All
    driverId: string;      // "" = All
    serviceType: string;   // "" = All
    dateRange: "today" | "yesterday" | "this_week" | "custom" | "";
    sort: LoadSortKey;
};

export const EMPTY_LOAD_FILTERS: LoadFilters = {
    search: "",
    status: "",
    driverId: "",
    serviceType: "",
    dateRange: "",
    sort: "newest",
};

export type Driver = {
    id: string;
    full_name: string;
};

type Props = {
    filters: LoadFilters;
    onFiltersChange: (filters: LoadFilters) => void;
    totalCount: number;
    filteredCount: number;
    drivers: Driver[];
};

// --- Status options (matching the main STATUSES array) ------
const STATUS_OPTIONS = [
    { value: "", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "assigned", label: "Assigned" },
    { value: "blasted", label: "Blasted" },
    { value: "in_progress", label: "In Transit" },
    { value: "arrived_pickup", label: "At Pickup" },
    { value: "in_transit", label: "In Transit (GPS)" },
    { value: "arrived_delivery", label: "At Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "failed", label: "Failed" },
];

const SERVICE_TYPES = [
    { value: "", label: "All Services" },
    { value: "AOG", label: "AOG" },
    { value: "Courier", label: "? Courier" },
    { value: "Standard", label: "Standard" },
];

const DATE_RANGES = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "this_week", label: "This Week" },
];

const SORT_OPTIONS = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "revenue_desc", label: "Revenue (High to Low)" },
    { value: "status", label: "By Status" },
];

// --- Component -----------------------------------------------
export default function LoadSearchFilters({
    filters,
    onFiltersChange,
    totalCount,
    filteredCount,
    drivers,
}: Props) {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [localSearch, setLocalSearch] = useState(filters.search);

    // Sync local search with external filters (e.g., on clear)
    useEffect(() => {
        setLocalSearch(filters.search);
    }, [filters.search]);

    // Debounced search
    const handleSearchChange = useCallback(
        (value: string) => {
            setLocalSearch(value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                onFiltersChange({ ...filters, search: value });
            }, 300);
        },
        [filters, onFiltersChange],
    );

    const clearSearch = () => {
        setLocalSearch("");
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onFiltersChange({ ...filters, search: "" });
    };

    const setFilter = <K extends keyof LoadFilters>(key: K, value: LoadFilters[K]) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const clearAllFilters = () => {
        setLocalSearch("");
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onFiltersChange(EMPTY_LOAD_FILTERS);
    };

    // -- Compute active filter count (excluding sort + search) --
    const activeFilterCount = [
        filters.status,
        filters.driverId,
        filters.serviceType,
        filters.dateRange,
    ].filter(Boolean).length;

    const hasAnyFilter = !!(
        filters.search ||
        filters.status ||
        filters.driverId ||
        filters.serviceType ||
        filters.dateRange
    );

    // -- Active filter badges ---------------------------------
    const activeBadges: { label: string; clear: () => void }[] = [];
    if (filters.status) {
        const s = STATUS_OPTIONS.find((o) => o.value === filters.status);
        activeBadges.push({ label: `Status: ${s?.label ?? filters.status}`, clear: () => setFilter("status", "") });
    }
    if (filters.driverId) {
        const d = drivers.find((dr) => dr.id === filters.driverId);
        activeBadges.push({ label: `Driver: ${d?.full_name ?? "Unknown"}`, clear: () => setFilter("driverId", "") });
    }
    if (filters.serviceType) {
        const st = SERVICE_TYPES.find((o) => o.value === filters.serviceType);
        activeBadges.push({ label: `Service: ${st?.label ?? filters.serviceType}`, clear: () => setFilter("serviceType", "") });
    }
    if (filters.dateRange) {
        const dr = DATE_RANGES.find((o) => o.value === filters.dateRange);
        activeBadges.push({ label: `Date: ${dr?.label ?? filters.dateRange}`, clear: () => setFilter("dateRange", "") });
    }

    return (
        <div className="space-y-2 mb-3">
            {/* -- Search Row -- */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        value={localSearch}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search by reference, client, pickup, delivery..."
                        className="pl-8 pr-8 h-9"
                    />
                    {localSearch && (
                        <button
                            onClick={clearSearch}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Sort */}
                <Select
                    value={filters.sort}
                    onValueChange={(v) => setFilter("sort", v as LoadSortKey)}
                >
                    <SelectTrigger className="w-44 h-9 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SORT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Toggle filters */}
                <Button
                    variant={filtersOpen || activeFilterCount > 0 ? "default" : "outline"}
                    size="sm"
                    className="h-9 gap-1.5 text-xs shrink-0"
                    onClick={() => setFiltersOpen(!filtersOpen)}
                >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                        <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-white text-primary ml-0.5">
                            {activeFilterCount}
                        </Badge>
                    )}
                    {filtersOpen ? (
                        <ChevronUp className="h-3 w-3" />
                    ) : (
                        <ChevronDown className="h-3 w-3" />
                    )}
                </Button>
            </div>

            {/* -- Result Count -- */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                    {hasAnyFilter ? (
                        <>
                            Showing{" "}
                            <strong className="text-foreground">{filteredCount}</strong> of{" "}
                            <strong className="text-foreground">{totalCount}</strong> loads
                        </>
                    ) : (
                        <>
                            <strong className="text-foreground">{totalCount}</strong> load
                            {totalCount !== 1 ? "s" : ""}
                        </>
                    )}
                </span>

                {/* Active filter badges */}
                {activeBadges.map((badge) => (
                    <Badge
                        key={badge.label}
                        variant="secondary"
                        className="text-[10px] gap-1 h-5 pr-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={badge.clear}
                    >
                        {badge.label}
                        <X className="h-2.5 w-2.5" />
                    </Badge>
                ))}

                {hasAnyFilter && (
                    <button
                        onClick={clearAllFilters}
                        className="text-[10px] text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* -- Filter Bar (collapsible) -- */}
            {filtersOpen && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-muted/30 rounded-xl border border-border/50 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                    {/* Status */}
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                            Status
                        </p>
                        <Select
                            value={filters.status || "__all__"}
                            onValueChange={(v) => setFilter("status", v === "__all__" ? "" : v)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem
                                        key={o.value || "__all__"}
                                        value={o.value || "__all__"}
                                        className="text-xs"
                                    >
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Driver */}
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                            Driver
                        </p>
                        <Select
                            value={filters.driverId || "__all__"}
                            onValueChange={(v) => setFilter("driverId", v === "__all__" ? "" : v)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="All Drivers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__" className="text-xs">
                                    All Drivers
                                </SelectItem>
                                {drivers.map((d) => (
                                    <SelectItem key={d.id} value={d.id} className="text-xs">
                                        {d.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Service Type */}
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                            Service Type
                        </p>
                        <Select
                            value={filters.serviceType || "__all__"}
                            onValueChange={(v) => setFilter("serviceType", v === "__all__" ? "" : v)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SERVICE_TYPES.map((o) => (
                                    <SelectItem
                                        key={o.value || "__all__"}
                                        value={o.value || "__all__"}
                                        className="text-xs"
                                    >
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Range */}
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                            Date Range
                        </p>
                        <div className="flex gap-1 flex-wrap">
                            {DATE_RANGES.map((dr) => (
                                <button
                                    key={dr.value}
                                    onClick={() =>
                                        setFilter(
                                            "dateRange",
                                            filters.dateRange === dr.value
                                                ? ""
                                                : (dr.value as LoadFilters["dateRange"]),
                                        )
                                    }
                                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                                        filters.dateRange === dr.value
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-background border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {dr.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
