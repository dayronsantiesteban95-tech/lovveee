// ═══════════════════════════════════════════════════════════
// Shared Formatting Utilities
// Centralized to avoid duplication across pages
// ═══════════════════════════════════════════════════════════

/**
 * Format a number as USD currency (no cents).
 * e.g. 1234 → "$1,234"
 */
export function fmtMoney(n: number): string {
    return n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
    });
}

/**
 * Format minutes into a human-readable wait time.
 * e.g. 0 → "—", 45 → "45m", 90 → "1h 30m"
 */
export function fmtWait(mins: number): string {
    if (!mins) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Returns today's date as an ISO string (YYYY-MM-DD).
 */
export function todayISO(): string {
    return new Date().toISOString().split("T")[0];
}

/**
 * Returns the date N days ago as an ISO string.
 */
export function daysAgoISO(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
}
