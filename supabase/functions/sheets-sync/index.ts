import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Google Sheets Two-Way Sync Edge Function
 *
 * Environment variables required:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — Full JSON string of Google Cloud service account key
 *   GOOGLE_SHEET_ID — The ID from the Google Sheet URL
 *   GOOGLE_SHEET_NAME — The tab/sheet name (default: "Daily Dispatch")
 *
 * Actions:
 *   "pull" — Read rows from Google Sheets → upsert into daily_dispatches table
 *   "push" — Read from daily_dispatches table → write back to Google Sheets
 *   "sync" — Pull then push (full bidirectional sync)
 */

interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

// Get Google OAuth2 access token from Service Account
async function getGoogleAccessToken(serviceAccount: Record<string, string>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    // Build JWT header and claim set
    const header = { alg: "RS256", typ: "JWT" };
    const claimSet = {
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
    };

    // Base64url encode
    const b64 = (obj: unknown) =>
        btoa(JSON.stringify(obj))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

    const unsignedToken = `${b64(header)}.${b64(claimSet)}`;

    // Import the private key and sign
    const privateKeyPem = serviceAccount.private_key;
    const pemContent = privateKeyPem
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\s/g, "");

    const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        new TextEncoder().encode(unsignedToken)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const jwt = `${unsignedToken}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    });

    if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        throw new Error(`Google OAuth failed [${tokenRes.status}]: ${errBody}`);
    }

    const tokenData: GoogleTokenResponse = await tokenRes.json();
    return tokenData.access_token;
}

// Read rows from Google Sheets
async function readSheet(accessToken: string, sheetId: string, sheetName: string) {
    const range = encodeURIComponent(`${sheetName}!A:H`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Sheets read failed [${res.status}]: ${errBody}`);
    }

    const data = await res.json();
    return data.values || [];
}

// Write/append rows to Google Sheets
async function appendToSheet(
    accessToken: string,
    sheetId: string,
    sheetName: string,
    rows: string[][]
) {
    const range = encodeURIComponent(`${sheetName}!A:H`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: rows }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Sheets append failed [${res.status}]: ${errBody}`);
    }

    return await res.json();
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Auth check
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // Validate JWT
        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claimsData?.claims) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Load Google config
        const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
        const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
        const sheetName = Deno.env.get("GOOGLE_SHEET_NAME") || "Daily Dispatch";

        if (!serviceAccountJson || !sheetId) {
            throw new Error(
                "Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID in Edge Function secrets."
            );
        }

        const serviceAccount = JSON.parse(serviceAccountJson);
        const accessToken = await getGoogleAccessToken(serviceAccount);

        const { action } = await req.json();

        // ── PULL: Sheet → Supabase ──
        if (action === "pull" || action === "sync") {
            const rows = await readSheet(accessToken, sheetId, sheetName);

            if (rows.length < 2) {
                // Only header or empty
                if (action === "pull") {
                    return new Response(
                        JSON.stringify({ success: true, message: "No data rows found in sheet", pulled: 0 }),
                        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            } else {
                // Expected columns: Date, Vehicle ID, Driver Name, Route, Stops, Status, Notes
                const header = rows[0].map((h: string) => h.toLowerCase().replace(/\s+/g, "_"));
                const dataRows = rows.slice(1);

                let pullCount = 0;
                for (const row of dataRows) {
                    const rowObj: Record<string, string> = {};
                    header.forEach((h: string, i: number) => {
                        rowObj[h] = row[i] || "";
                    });

                    const dispatchDate = rowObj["date"] || new Date().toISOString().split("T")[0];
                    const vehicleId = rowObj["vehicle_id"] || rowObj["vehicle"] || "";
                    const driverName = rowObj["driver_name"] || rowObj["driver"] || "";

                    if (!vehicleId && !driverName) continue;

                    await supabase.from("daily_dispatches").upsert(
                        {
                            dispatch_date: dispatchDate,
                            vehicle_id: vehicleId,
                            driver_name: driverName,
                            route: rowObj["route"] || null,
                            stops: parseInt(rowObj["stops"]) || 0,
                            status: rowObj["status"] || "scheduled",
                            notes: rowObj["notes"] || null,
                            synced_at: new Date().toISOString(),
                        },
                        { onConflict: "dispatch_date,vehicle_id" as any, ignoreDuplicates: false }
                    );
                    pullCount++;
                }

                if (action === "pull") {
                    return new Response(
                        JSON.stringify({ success: true, pulled: pullCount }),
                        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }
        }

        // ── PUSH: Supabase → Sheet ──
        if (action === "push" || action === "sync") {
            // Get dispatches that haven't been synced yet or were updated after last sync
            const { data: dispatches, error: fetchErr } = await supabase
                .from("daily_dispatches")
                .select("*")
                .or("synced_at.is.null,updated_at.gt.synced_at")
                .order("dispatch_date", { ascending: false })
                .limit(100);

            if (fetchErr) throw new Error(`Failed to fetch dispatches: ${fetchErr.message}`);

            if (dispatches && dispatches.length > 0) {
                const newRows = dispatches.map((d: any) => [
                    d.dispatch_date,
                    d.vehicle_id,
                    d.driver_name,
                    d.route || "",
                    String(d.stops || 0),
                    d.status,
                    d.notes || "",
                    new Date().toISOString(),
                ]);

                await appendToSheet(accessToken, sheetId, sheetName, newRows);

                // Mark as synced
                const ids = dispatches.map((d: any) => d.id);
                await supabase
                    .from("daily_dispatches")
                    .update({ synced_at: new Date().toISOString() })
                    .in("id", ids);
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    pushed: dispatches?.length || 0,
                    ...(action === "sync" ? { message: "Full sync completed" } : {}),
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ error: "Invalid action. Use 'pull', 'push', or 'sync'." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error: unknown) {
        console.error("sheets-sync error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
