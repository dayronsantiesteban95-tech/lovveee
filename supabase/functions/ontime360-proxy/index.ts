/**
 * Supabase Edge Function: ontime360-proxy
 *
 * Proxies requests to the OnTime 360 API, keeping credentials server-side.
 * Deploy with: supabase functions deploy ontime360-proxy
 *
 * Supported actions:
 *   listOrders         — GET /orders?dateFrom=&dateTo=
 *   getOrder           — GET /orders?trackingNumber=
 *   createOrder        — POST /orders
 *   updateOrder        — PUT /orders/:id
 *   cancelOrder        — PUT /orders/:id (sets status to Cancelled)
 *   listDrivers        — GET /drivers
 *   getDriver          — GET /drivers/:id
 *   driverGpsHistory   — GET /drivers/:id/gps?date=
 *   listLocations      — GET /locations
 *   getLocation        — GET /locations/:id
 *
 * Required secrets:
 *   supabase secrets set ONTIME360_COMPANY_ID=<your-company>
 *   supabase secrets set ONTIME360_API_KEY=<your-key>
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function getCorsHeaders(origin: string | null) {
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin ?? "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
}

serve(async (req) => {
    const origin = req.headers.get("origin");
    const headers = getCorsHeaders(origin);

    if (req.method === "OPTIONS") return new Response("ok", { headers });

    try {
        const companyId = Deno.env.get("ONTIME360_COMPANY_ID");
        const apiKey = Deno.env.get("ONTIME360_API_KEY");
        if (!companyId || !apiKey) {
            throw new Error(
                "OnTime360 credentials not set. Run:\n" +
                "  supabase secrets set ONTIME360_COMPANY_ID=<company>\n" +
                "  supabase secrets set ONTIME360_API_KEY=<key>"
            );
        }

        const BASE = `https://${companyId}.ontime360.com/api`;
        const { action, ...params } = await req.json();
        if (!action || typeof action !== "string") {
            throw new Error("Missing required 'action' field in request body");
        }

        const authHeaders: HeadersInit = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        };

        let url = "";
        let method = "GET";
        let body: string | undefined;

        switch (action) {
            // ── Order operations ────────────────────
            case "listOrders":
                if (!params.dateFrom || !params.dateTo) {
                    throw new Error("dateFrom and dateTo are required (YYYY-MM-DD)");
                }
                url = `${BASE}/orders?dateFrom=${encodeURIComponent(params.dateFrom)}&dateTo=${encodeURIComponent(params.dateTo)}`;
                if (params.status) url += `&status=${encodeURIComponent(params.status)}`;
                if (params.limit) url += `&limit=${params.limit}`;
                break;

            case "getOrder":
                if (!params.trackingNumber) throw new Error("trackingNumber is required");
                url = `${BASE}/orders?trackingNumber=${encodeURIComponent(params.trackingNumber)}`;
                break;

            case "createOrder": {
                url = `${BASE}/orders`;
                method = "POST";
                if (!params.customerName) throw new Error("customerName is required");
                body = JSON.stringify({
                    customerName: params.customerName,
                    collectionLocation: params.collectionLocation ?? null,
                    deliveryLocation: params.deliveryLocation ?? null,
                    pieces: params.pieces ?? 1,
                    weight: params.weight ?? null,
                    serviceType: params.serviceType ?? "Standard",
                    notes: params.notes ?? "",
                    referenceNumber: params.referenceNumber ?? "",
                    purchaseOrderNumber: params.purchaseOrderNumber ?? "",
                    userDefinedFields: params.userDefinedFields ?? {},
                });
                break;
            }

            case "updateOrder": {
                if (!params.orderId) throw new Error("orderId is required");
                url = `${BASE}/orders/${params.orderId}`;
                method = "PUT";
                // Build partial update payload
                const orderUpdate: Record<string, unknown> = {};
                const allowedFields = [
                    "status", "customerName", "collectionLocation", "deliveryLocation",
                    "pieces", "weight", "serviceType", "notes", "referenceNumber",
                    "purchaseOrderNumber", "driverCurrentlyAssigned",
                ];
                for (const field of allowedFields) {
                    if (params[field] !== undefined) orderUpdate[field] = params[field];
                }
                body = JSON.stringify(orderUpdate);
                break;
            }

            case "cancelOrder": {
                if (!params.orderId) throw new Error("orderId is required");
                url = `${BASE}/orders/${params.orderId}`;
                method = "PUT";
                body = JSON.stringify({
                    status: "Cancelled",
                    notes: params.reason ? `Cancelled: ${params.reason}` : "Cancelled via API",
                });
                break;
            }

            // ── Driver operations ───────────────────
            case "listDrivers":
                url = `${BASE}/drivers`;
                if (params.status) url += `?status=${encodeURIComponent(params.status)}`;
                break;

            case "getDriver":
                if (!params.driverId) throw new Error("driverId is required");
                url = `${BASE}/drivers/${params.driverId}`;
                break;

            case "driverGpsHistory":
                if (!params.driverId || !params.date) {
                    throw new Error("driverId and date (YYYY-MM-DD) are required");
                }
                url = `${BASE}/drivers/${params.driverId}/gps?date=${encodeURIComponent(params.date)}`;
                break;

            // ── Location operations ─────────────────
            case "listLocations":
                url = `${BASE}/locations`;
                if (params.search) url += `?search=${encodeURIComponent(params.search)}`;
                break;

            case "getLocation":
                if (!params.locationId) throw new Error("locationId is required");
                url = `${BASE}/locations/${params.locationId}`;
                break;

            default:
                throw new Error(
                    `Unknown action: "${action}". Available: listOrders, getOrder, createOrder, updateOrder, cancelOrder, listDrivers, getDriver, driverGpsHistory, listLocations, getLocation`
                );
        }

        const resp = await fetch(url, { method, headers: authHeaders, body });
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
            const errMsg = (data as any)?.message ?? (data as any)?.error ?? `OnTime360 API error ${resp.status}`;
            throw new Error(errMsg);
        }

        return new Response(JSON.stringify(data), { headers, status: 200 });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return new Response(
            JSON.stringify({ error: message }),
            { headers, status: 400 },
        );
    }
});
