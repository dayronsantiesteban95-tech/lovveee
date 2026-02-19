/**
 * DriverPickerModal — Smart driver picker with AI scoring.
 *
 * Replaces the flat driver dropdown in NewLoadForm and LoadBoard.
 * Shows distance from pickup, current workload, hub match, and AI suggestion.
 */

import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Star, Search, MapPin, RefreshCw, X } from "lucide-react";
import { useDriverAvailability } from "@/hooks/useDriverAvailability";
import { geocodeAddress } from "@/utils/geocodeAddress";
import type { DriverScore } from "@/utils/scoreDrivers";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DriverPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (driverId: string, driverName: string) => void;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  currentDriverId?: string | null;
}

// ─── Hub filter config ────────────────────────────────────────────────────────
// Default = hub-locked (only drivers matching the load's hub).
// "override" = dispatcher manually bypasses for cross-hub emergency assign.

type HubMode = "locked" | "override";

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusDot(status: string): string {
  const s = status.toLowerCase();
  if (s === "idle" || s === "active") return "🟢";
  if (s === "finishing_soon" || s === "on_load" || s === "in_progress") return "🟡";
  return "🔴";
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "idle" || s === "active") return "Idle";
  if (s === "finishing_soon") return "Finishing soon";
  if (s === "on_load" || s === "in_progress") return "On Load";
  return "Off";
}

// ─── Driver Card ─────────────────────────────────────────────────────────────

interface DriverCardProps {
  entry: DriverScore;
  isSelected: boolean;
  isSuggested: boolean;
  onAssign: () => void;
}

function DriverCard({ entry, isSelected, isSuggested, onAssign }: DriverCardProps) {
  const { driver, distanceMi, reasoning } = entry;

  const distanceLabel =
    distanceMi != null ? `${distanceMi.toFixed(1)} mi` : "No GPS";

  const dot = statusDot(driver.status);
  const label = statusLabel(driver.status);

  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl border p-3 transition-all ${
        isSuggested
          ? "border-orange-500 bg-orange-500/5 ring-1 ring-orange-500/30"
          : isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-muted-foreground/40 hover:bg-muted/20"
      }`}
    >
      {/* AI badge (top-left corner) */}
      {isSuggested && (
        <div className="absolute -top-2 left-3 flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
          <Star className="h-2.5 w-2.5" />
          AI Pick
        </div>
      )}

      {/* Avatar */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isSelected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {driver.full_name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{dot} {driver.full_name}</span>
          <Badge
            variant="outline"
            className="shrink-0 px-1.5 text-[10px]"
          >
            {driver.hub.toUpperCase()}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {label} · {reasoning}
        </p>
      </div>

      {/* Distance badge + assign button */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="font-mono text-xs text-muted-foreground">{distanceLabel}</span>
        <Button
          size="sm"
          variant={isSelected ? "default" : isSuggested ? "default" : "outline"}
          className={`h-7 px-3 text-xs ${
            isSuggested && !isSelected
              ? "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
              : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onAssign();
          }}
        >
          {isSelected ? "Selected ✓" : "Assign"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function DriverPickerModal({
  open,
  onClose,
  onSelect,
  pickupAddress,
  pickupLat: propLat,
  pickupLng: propLng,
  currentDriverId,
}: DriverPickerModalProps) {
  const [search, setSearch] = useState("");
  const [hubMode, setHubMode] = useState<HubMode>("locked");
  const [resolvedLat, setResolvedLat] = useState<number | undefined>(propLat);
  const [resolvedLng, setResolvedLng] = useState<number | undefined>(propLng);

  // Geocode pickup address when modal opens (if coords not already provided)
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setHubMode("locked");

    if (propLat != null && propLng != null) {
      setResolvedLat(propLat);
      setResolvedLng(propLng);
      return;
    }

    if (pickupAddress) {
      geocodeAddress(pickupAddress).then((coords) => {
        if (coords) {
          setResolvedLat(coords.lat);
          setResolvedLng(coords.lng);
        }
      });
    }
  }, [open, pickupAddress, propLat, propLng]);

  // Determine hub from pickup address for scoring
  const inferredHub = useMemo(() => {
    if (!pickupAddress) return "PHX";
    const addr = pickupAddress.toLowerCase();
    if (addr.includes("atlanta") || addr.includes("atl")) return "ATL";
    if (addr.includes("los angeles") || addr.includes(" la ") || addr.includes(", la")) return "LA";
    return "PHX";
  }, [pickupAddress]);

  const { drivers: scored, loading, refresh } = useDriverAvailability(
    resolvedLat,
    resolvedLng,
    inferredHub,
  );

  // AI top suggestion = first in scored list (highest score)
  const topSuggestion: DriverScore | undefined = scored[0];

  // Filter by search + hub (locked = hard hub filter, override = all hubs)
  const filtered = useMemo(() => {
    return scored.filter((entry) => {
      const matchesSearch =
        !search ||
        entry.driver.full_name.toLowerCase().includes(search.toLowerCase());
      const matchesHub =
        hubMode === "override" ||
        entry.driver.hub.toUpperCase() === inferredHub.toUpperCase();
      return matchesSearch && matchesHub;
    });
  }, [scored, search, hubMode, inferredHub]);

  // Separate AI suggestion from the rest for display
  const suggestionEntry =
    topSuggestion && filtered.some((e) => e.driver.id === topSuggestion.driver.id)
      ? topSuggestion
      : null;
  const restList = suggestionEntry
    ? filtered.filter((e) => e.driver.id !== suggestionEntry.driver.id)
    : filtered;

  const truncatedAddress =
    pickupAddress && pickupAddress.length > 48
      ? pickupAddress.slice(0, 48) + "…"
      : pickupAddress;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-5 pt-5 pb-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">Assign Driver</h2>
            {pickupAddress && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0 text-orange-500" />
                <span className="truncate">{truncatedAddress}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => void refresh()}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search + Hub filter */}
        <div className="space-y-2 border-b px-4 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search drivers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Hub lock indicator */}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
                hubMode === "locked"
                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {inferredHub.toUpperCase()} Hub
            </div>
            {/* Override button */}
            <button
              onClick={() =>
                setHubMode((m) => (m === "locked" ? "override" : "locked"))
              }
              className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
                hubMode === "override"
                  ? "bg-amber-500 text-white ring-1 ring-amber-500"
                  : "bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600"
              }`}
            >
              {hubMode === "override" ? "⚠ Override — All Hubs" : "Override — All Hubs"}
            </button>
          </div>
        </div>

        {/* Override warning banner */}
        {hubMode === "override" && (
          <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            <span className="shrink-0 font-bold">⚠ Cross-hub override active.</span>
            <span>Showing all hubs — use only in emergencies.</span>
          </div>
        )}

        {/* Driver list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Loading drivers…
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <p className="text-sm">No {inferredHub.toUpperCase()} drivers available</p>
              <p className="text-xs opacity-60">
                {hubMode === "locked"
                  ? 'Use "Override — All Hubs" to cross-assign in an emergency'
                  : "Try adjusting your search"}
              </p>
            </div>
          )}

          {/* AI Suggestion card (always first if visible) */}
          {!loading && suggestionEntry && (
            <div className="mb-1 pt-3">
              <DriverCard
                entry={suggestionEntry}
                isSelected={currentDriverId === suggestionEntry.driver.id}
                isSuggested
                onAssign={() =>
                  onSelect(suggestionEntry.driver.id, suggestionEntry.driver.full_name)
                }
              />
            </div>
          )}

          {/* Rest of drivers */}
          {!loading &&
            restList.map((entry) => (
              <DriverCard
                key={entry.driver.id}
                entry={entry}
                isSelected={currentDriverId === entry.driver.id}
                isSuggested={false}
                onAssign={() => onSelect(entry.driver.id, entry.driver.full_name)}
              />
            ))}
        </div>

        {/* Footer: reasoning for AI pick */}
        {!loading && suggestionEntry && (
          <div className="border-t bg-orange-500/5 px-4 py-2.5">
            <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-snug">
              <Star className="mr-1 inline h-3 w-3" />
              <strong>AI Pick:</strong>{" "}
              {suggestionEntry.driver.full_name} — {suggestionEntry.reasoning}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
