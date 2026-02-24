// -----------------------------------------------------------
// Anika Rate Calculator - Pure business logic
// Extracted from NewLoadForm.tsx for testability
// -----------------------------------------------------------

import type { AnikaModifiers, AnikaBreakdown } from "@/pages/dispatch/types";

export const ANIKA_RATES = {
    cargo_van: { base: 105, perMile: 2.0, deadheadPerMile: 2.0, weightThreshold: 100, weightRate: 0.10 },
    box_truck: { base: 170, perMile: 2.5, deadheadPerMile: 2.5, weightThreshold: 600, weightRate: 0.15 },
} as const;

export type AnikaVehicle = keyof typeof ANIKA_RATES;

export function calculateRate(
    vehicleType: string,
    miles: number,
    weightLbs: number,
    modifiers: AnikaModifiers,
): AnikaBreakdown {
    const vt = (vehicleType === "box_truck" ? "box_truck" : "cargo_van") as AnikaVehicle;
    const rates = ANIKA_RATES[vt];

    const baseRate = rates.base;
    const mileageCharge = miles > 20 ? (miles - 20) * rates.perMile : 0;
    const fuelSurcharge = (baseRate + mileageCharge) * 0.25;
    const subtotal = baseRate + mileageCharge + fuelSurcharge;

    const weightOver = Math.max(0, weightLbs - rates.weightThreshold);
    const weightSurcharge = weightOver * rates.weightRate;

    let modifiersTotal = 0;
    if (modifiers.afterHours)    modifiersTotal += 25;
    if (modifiers.weekend)       modifiersTotal += 25;
    if (modifiers.holiday)       modifiersTotal += 50;
    if (modifiers.tenderingFee)  modifiersTotal += 15;
    if (modifiers.attemptCharge) modifiersTotal += baseRate;
    modifiersTotal += modifiers.additionalStops * 50;
    modifiersTotal += modifiers.extraPieces * 15;
    if (modifiers.specialHandling) modifiersTotal += 20;
    if (modifiers.documents)       modifiersTotal += 20;
    modifiersTotal += modifiers.holding * 50;
    modifiersTotal += modifiers.waitTime * 30;
    if (modifiers.secondPerson) modifiersTotal += 100;
    if (modifiers.whiteGlove)   modifiersTotal += 50;
    if (modifiers.hazmat)       modifiersTotal += 50;

    const finalQuote = subtotal + weightSurcharge + modifiersTotal;

    return { baseRate, mileageCharge, fuelSurcharge, subtotal, weightSurcharge, modifiersTotal, finalQuote };
}

// ---------- Tracking Token Generator ----------
// 8 chars from 36-char alphabet = 36^8 = ~2.8 trillion combinations
export function generateTrackingToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = 'ANK-';
    for (let i = 0; i < 8; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// ---------- Empty modifiers (useful for testing defaults) ----------
export const EMPTY_ANIKA_MODIFIERS: AnikaModifiers = {
    afterHours: false, weekend: false, holiday: false, tenderingFee: false, attemptCharge: false,
    additionalStops: 0, extraPieces: 0, specialHandling: false, documents: false,
    holding: 0, waitTime: 0, secondPerson: false, whiteGlove: false, hazmat: false,
};
