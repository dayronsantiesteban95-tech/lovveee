import { describe, it, expect } from "vitest";
import { generateTrackingToken } from "@/lib/rateCalculator";

// ============================================================
// generateTrackingToken
// ============================================================
describe("generateTrackingToken", () => {
  // ----- Format tests -----

  it("starts with 'ANK-'", () => {
    const token = generateTrackingToken();
    expect(token.startsWith("ANK-")).toBe(true);
  });

  it("is exactly 10 characters long (ANK- prefix + 6 chars)", () => {
    const token = generateTrackingToken();
    expect(token).toHaveLength(10);
  });

  it("contains only uppercase letters and digits after the prefix", () => {
    const token = generateTrackingToken();
    const suffix = token.slice(4); // Remove "ANK-"
    expect(suffix).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("has the correct prefix format", () => {
    const token = generateTrackingToken();
    expect(token).toMatch(/^ANK-[A-Z0-9]{6}$/);
  });

  // ----- Randomness / uniqueness tests -----

  it("generates unique tokens across 1000 calls", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateTrackingToken());
    }
    // With 36^6 = 2,176,782,336 possible combinations,
    // 1000 tokens should have no collisions
    expect(tokens.size).toBe(1000);
  });

  it("generates tokens with variety in the suffix", () => {
    // Generate 100 tokens and check that at least 10 unique first suffix chars appear
    const firstChars = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const token = generateTrackingToken();
      firstChars.add(token[4]);
    }
    // Should see a good spread of characters
    expect(firstChars.size).toBeGreaterThan(5);
  });

  // ----- Edge case: repeated generation -----

  it("returns a new string on each call (not cached)", () => {
    const a = generateTrackingToken();
    const b = generateTrackingToken();
    // Technically could be equal by chance, but astronomically unlikely
    // We test many to be sure
    let foundDifferent = false;
    for (let i = 0; i < 100; i++) {
      if (generateTrackingToken() !== a) {
        foundDifferent = true;
        break;
      }
    }
    expect(foundDifferent).toBe(true);
  });

  // ----- Character set validation -----

  it("never contains lowercase letters", () => {
    for (let i = 0; i < 500; i++) {
      const token = generateTrackingToken();
      expect(token).not.toMatch(/[a-z]/);
    }
  });

  it("never contains special characters", () => {
    for (let i = 0; i < 500; i++) {
      const token = generateTrackingToken();
      const suffix = token.slice(4);
      // Only A-Z and 0-9 allowed
      expect(suffix).not.toMatch(/[^A-Z0-9]/);
    }
  });

  it("suffix uses the full 36-char alphabet (A-Z, 0-9) over many samples", () => {
    const allChars = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const token = generateTrackingToken();
      for (const ch of token.slice(4)) {
        allChars.add(ch);
      }
    }
    // With 5000 * 6 = 30,000 samples from a 36-char alphabet,
    // we should see all 36 characters
    expect(allChars.size).toBe(36);
  });

  // ----- Batch generation consistency -----

  it("all tokens in a batch of 50 pass validation", () => {
    const tokens: string[] = [];
    for (let i = 0; i < 50; i++) {
      tokens.push(generateTrackingToken());
    }

    for (const token of tokens) {
      expect(token).toHaveLength(10);
      expect(token).toMatch(/^ANK-[A-Z0-9]{6}$/);
    }
  });
});
