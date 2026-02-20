import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";

// -- Hub Assignment --
// Maps US states to the nearest Anika hub
const STATE_TO_HUB: Record<string, string> = {
    // Atlanta hub covers Southeast
    GA: "atlanta", FL: "atlanta", AL: "atlanta", SC: "atlanta", NC: "atlanta",
    TN: "atlanta", MS: "atlanta", VA: "atlanta", KY: "atlanta", WV: "atlanta",
    // Phoenix hub covers Southwest
    AZ: "phoenix", NM: "phoenix", TX: "phoenix", CO: "phoenix", UT: "phoenix",
    NV: "phoenix", OK: "phoenix",
    // LA hub covers West Coast
    CA: "la", OR: "la", WA: "la", HI: "la",
    // Default to nearest for remaining states
    LA: "atlanta", AR: "atlanta", MO: "atlanta", IN: "atlanta", OH: "atlanta",
    IL: "atlanta", MI: "atlanta", WI: "atlanta", MN: "atlanta",
    IA: "phoenix", KS: "phoenix", NE: "phoenix", SD: "phoenix", ND: "phoenix",
    WY: "phoenix", MT: "phoenix", ID: "la",
    PA: "atlanta", NY: "atlanta", NJ: "atlanta", CT: "atlanta", MA: "atlanta",
    ME: "atlanta", NH: "atlanta", VT: "atlanta", RI: "atlanta", DE: "atlanta",
    MD: "atlanta", DC: "atlanta",
    AK: "la",
};

// City-level overrides (for when city is more telling than state)
const CITY_TO_HUB: Record<string, string> = {
    "atlanta": "atlanta", "phoenix": "phoenix", "scottsdale": "phoenix",
    "los angeles": "la", "la": "la", "san francisco": "la", "san diego": "la",
    "sacramento": "la", "las vegas": "la", "tucson": "phoenix", "el paso": "phoenix",
    "dallas": "phoenix", "houston": "phoenix", "san antonio": "phoenix",
    "austin": "phoenix", "miami": "atlanta", "orlando": "atlanta", "tampa": "atlanta",
    "jacksonville": "atlanta", "charlotte": "atlanta", "nashville": "atlanta",
    "seattle": "la", "portland": "la", "denver": "phoenix",
};

/**
 * Determine the closest Anika hub based on state and/or city.
 */
export function assignHub(state?: string | null, city?: string | null): string {
    // Try city first (more specific)
    if (city) {
        const normalizedCity = city.toLowerCase().trim();
        if (CITY_TO_HUB[normalizedCity]) return CITY_TO_HUB[normalizedCity];
    }
    // Try state
    if (state) {
        const normalizedState = state.toUpperCase().trim();
        if (STATE_TO_HUB[normalizedState]) return STATE_TO_HUB[normalizedState];
    }
    // Default to phoenix (central)
    return "phoenix";
}

// -- Default cadence settings --
const DEFAULT_CADENCE = {
    email1_to_email2_days: 3,
    email2_to_call_days: 4,
};

/**
 * Fetch the nurture cadence settings from the database, or use defaults.
 */
async function getCadenceSettings(): Promise<{ email1_to_email2_days: number; email2_to_call_days: number }> {
    const { data } = await supabase.from("nurture_settings").select("setting_key, setting_value");
    if (!data) return DEFAULT_CADENCE;
    const result = { ...DEFAULT_CADENCE };
    for (const row of data) {
        if (row.setting_key === "email1_to_email2_days") result.email1_to_email2_days = parseInt(row.setting_value) || DEFAULT_CADENCE.email1_to_email2_days;
        if (row.setting_key === "email2_to_call_days") result.email2_to_call_days = parseInt(row.setting_value) || DEFAULT_CADENCE.email2_to_call_days;
    }
    return result;
}

/**
 * Create a 3-step nurture sequence for a lead.
 * Steps: email_1 (today), email_2 (today + cadence), call (today + cadence + cadence)
 * Returns the inserted sequence rows.
 */
export async function createSequenceForLead(leadId: string, userId: string): Promise<boolean> {
    const cadence = await getCadenceSettings();
    const today = format(new Date(), "yyyy-MM-dd");
    const e2Days = cadence.email1_to_email2_days;
    const callDays = e2Days + cadence.email2_to_call_days;

    const rows = [
        { lead_id: leadId, step_type: "email_1", status: "pending", follow_up_date: today, response_status: "no_response", created_by: userId },
        { lead_id: leadId, step_type: "email_2", status: "pending", follow_up_date: format(addDays(new Date(), e2Days), "yyyy-MM-dd"), response_status: "no_response", created_by: userId },
        { lead_id: leadId, step_type: "call", status: "pending", follow_up_date: format(addDays(new Date(), callDays), "yyyy-MM-dd"), response_status: "no_response", created_by: userId },
    ];

    const { error } = await supabase.from("lead_sequences").insert(rows);
    if (error) {
        return false;
    }
    return true;
}
