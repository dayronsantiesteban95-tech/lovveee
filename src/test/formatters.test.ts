import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fmtMoney, fmtWait, todayISO, daysAgoISO } from "@/lib/formatters";

// ============================================================
// fmtMoney - Currency formatting
// ============================================================
describe("fmtMoney", () => {
  it("formats a simple integer as USD without cents", () => {
    expect(fmtMoney(1234)).toBe("$1,234");
  });

  it("formats zero as $0", () => {
    expect(fmtMoney(0)).toBe("$0");
  });

  it("formats negative numbers with a minus sign", () => {
    const result = fmtMoney(-500);
    // Locale may use a minus sign or wrap in parens; just check it contains 500
    expect(result).toContain("500");
    // Should indicate negative
    expect(result).toMatch(/[-\u2212(]/);
  });

  it("formats large numbers with comma separators", () => {
    expect(fmtMoney(1000000)).toBe("$1,000,000");
  });

  it("formats very large numbers correctly", () => {
    expect(fmtMoney(99999999)).toBe("$99,999,999");
  });

  it("rounds decimal values (no cents displayed)", () => {
    // minimumFractionDigits: 0 means decimals may be shown or rounded
    const result = fmtMoney(1234.56);
    // Should start with $ and contain 1,234 or 1,235
    expect(result).toMatch(/^\$1,23[45]/);
  });

  it("formats small numbers", () => {
    expect(fmtMoney(1)).toBe("$1");
    expect(fmtMoney(99)).toBe("$99");
  });

  it("formats numbers just below a thousand", () => {
    expect(fmtMoney(999)).toBe("$999");
  });

  it("formats exactly one thousand", () => {
    expect(fmtMoney(1000)).toBe("$1,000");
  });
});

// ============================================================
// fmtWait - Wait time formatting
// ============================================================
describe("fmtWait", () => {
  it("returns em-dash for zero minutes", () => {
    expect(fmtWait(0)).toBe("\u2014");
  });

  it("returns em-dash for falsy values (NaN coerced to 0)", () => {
    // !NaN === true, so fmtWait(NaN) should return em-dash
    expect(fmtWait(NaN)).toBe("\u2014");
  });

  it("formats minutes under 60 as Xm", () => {
    expect(fmtWait(1)).toBe("1m");
    expect(fmtWait(30)).toBe("30m");
    expect(fmtWait(45)).toBe("45m");
    expect(fmtWait(59)).toBe("59m");
  });

  it("formats exactly 60 minutes as 1h 0m", () => {
    expect(fmtWait(60)).toBe("1h 0m");
  });

  it("formats 90 minutes as 1h 30m", () => {
    expect(fmtWait(90)).toBe("1h 30m");
  });

  it("formats 120 minutes as 2h 0m", () => {
    expect(fmtWait(120)).toBe("2h 0m");
  });

  it("formats large durations", () => {
    expect(fmtWait(600)).toBe("10h 0m");
    expect(fmtWait(601)).toBe("10h 1m");
  });

  it("handles edge case of 1 minute", () => {
    expect(fmtWait(1)).toBe("1m");
  });

  it("handles very large wait times", () => {
    expect(fmtWait(1440)).toBe("24h 0m"); // Full day
    expect(fmtWait(1500)).toBe("25h 0m");
  });
});

// ============================================================
// todayISO - Returns today as YYYY-MM-DD
// ============================================================
describe("todayISO", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a string in YYYY-MM-DD format", () => {
    vi.setSystemTime(new Date("2025-07-15T12:00:00Z"));
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns the correct date for a known timestamp", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    expect(todayISO()).toBe("2025-01-01");
  });

  it("returns the correct date at end of day", () => {
    vi.setSystemTime(new Date("2025-12-31T23:59:59Z"));
    expect(todayISO()).toBe("2025-12-31");
  });

  it("handles leap year correctly", () => {
    vi.setSystemTime(new Date("2024-02-29T12:00:00Z"));
    expect(todayISO()).toBe("2024-02-29");
  });
});

// ============================================================
// daysAgoISO - Returns date N days ago as YYYY-MM-DD
// ============================================================
describe("daysAgoISO", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today when days=0", () => {
    vi.setSystemTime(new Date("2025-07-15T12:00:00Z"));
    expect(daysAgoISO(0)).toBe(todayISO());
  });

  it("returns yesterday when days=1", () => {
    vi.setSystemTime(new Date("2025-07-15T12:00:00Z"));
    expect(daysAgoISO(1)).toBe("2025-07-14");
  });

  it("correctly crosses month boundaries", () => {
    vi.setSystemTime(new Date("2025-03-01T12:00:00Z"));
    expect(daysAgoISO(1)).toBe("2025-02-28");
  });

  it("correctly crosses year boundaries", () => {
    vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
    expect(daysAgoISO(1)).toBe("2024-12-31");
  });

  it("handles large day counts", () => {
    vi.setSystemTime(new Date("2025-07-15T12:00:00Z"));
    expect(daysAgoISO(30)).toBe("2025-06-15");
  });

  it("handles 7 days for a week", () => {
    vi.setSystemTime(new Date("2025-07-15T12:00:00Z"));
    expect(daysAgoISO(7)).toBe("2025-07-08");
  });

  it("returns a string in YYYY-MM-DD format", () => {
    vi.setSystemTime(new Date("2025-07-15T12:00:00Z"));
    expect(daysAgoISO(10)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
