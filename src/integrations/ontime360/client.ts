/**
 * OnTime 360 Integration Client
 *
 * All calls go through Supabase Edge Functions to keep the API key server-side.
 * The Edge Function name is "ontime360-proxy" and accepts:
 *   POST { action, ...params }
 *
 * Read operations:
 *   getTodayOrders()    — orders for today
 *   getOrder()          — single order by tracking #
 *   getDrivers()        — all active drivers
 *   getDriverGpsHistory()— GPS trail for a driver
 *   getLocations()      — location directory
 *
 * Write operations:
 *   pushLoadToOnTime360() — create an order from our load data
 *   updateOT360Order()    — update order fields
 *   cancelOT360Order()    — cancel an order
 *
 * Sync:
 *   syncOrderToLoad()  — pull an OT360 order → our daily_loads row
 *   syncAllOrders()    — bulk sync all today's orders
 */
import { supabase } from "@/integrations/supabase/client";
import type {
    OT360Order,
    OT360Driver,
    OT360GpsPosition,
    OT360Location,
} from "./types";
import { mapOT360Status } from "./types";

// ─── Edge Function Caller ──────────────────────────────

async function callEdge<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await supabase.functions.invoke("ontime360-proxy", {
        body: { action, ...params },
    });
    if (error) throw new Error(`OnTime360 proxy error: ${error.message}`);
    return data as T;
}

// ─── Read Operations ───────────────────────────────────

/** List today's orders from OnTime 360 */
export async function getTodayOrders(): Promise<OT360Order[]> {
    const today = new Date().toISOString().split("T")[0];
    return callEdge<OT360Order[]>("listOrders", { dateFrom: today, dateTo: today });
}

/** List orders for a date range */
export async function getOrdersByDateRange(
    dateFrom: string,
    dateTo: string,
    status?: string,
): Promise<OT360Order[]> {
    return callEdge<OT360Order[]>("listOrders", { dateFrom, dateTo, status });
}

/** Get a single order by tracking number */
export async function getOrder(trackingNumber: string): Promise<OT360Order> {
    return callEdge<OT360Order>("getOrder", { trackingNumber });
}

/** Get all active drivers with GPS */
export async function getDrivers(): Promise<OT360Driver[]> {
    return callEdge<OT360Driver[]>("listDrivers");
}

/** Get a single driver by ID */
export async function getDriver(driverId: string): Promise<OT360Driver> {
    return callEdge<OT360Driver>("getDriver", { driverId });
}

/** Get GPS position history for a driver */
export async function getDriverGpsHistory(
    driverId: string,
    date: string,
): Promise<OT360GpsPosition[]> {
    return callEdge<OT360GpsPosition[]>("driverGpsHistory", { driverId, date });
}

/** Get the OT360 location directory */
export async function getLocations(search?: string): Promise<OT360Location[]> {
    return callEdge<OT360Location[]>("listLocations", search ? { search } : {});
}

/** Get a single location by ID */
export async function getLocation(locationId: string): Promise<OT360Location> {
    return callEdge<OT360Location>("getLocation", { locationId });
}

// ─── Write Operations (Push → OnTime 360) ──────────────

interface PushOrderPayload {
    customerName: string;
    collectionLocation?: string;   // OT360 location ID
    deliveryLocation?: string;     // OT360 location ID
    pieces?: number;
    weight?: number;
    serviceType?: string;
    notes?: string;
    referenceNumber?: string;
    purchaseOrderNumber?: string;
}

/** Create a new order in OnTime 360 from our load data */
export async function pushLoadToOnTime360(payload: PushOrderPayload): Promise<OT360Order> {
    return callEdge<OT360Order>("createOrder", {
        customerName: payload.customerName,
        collectionLocation: payload.collectionLocation ?? null,
        deliveryLocation: payload.deliveryLocation ?? null,
        pieces: payload.pieces ?? 1,
        weight: payload.weight ?? null,
        serviceType: payload.serviceType ?? "Standard",
        notes: payload.notes ?? "",
        referenceNumber: payload.referenceNumber ?? "",
        purchaseOrderNumber: payload.purchaseOrderNumber ?? "",
    });
}

/** Update an existing OT360 order */
export async function updateOT360Order(
    orderId: string,
    updates: Partial<{
        status: string;
        customerName: string;
        notes: string;
        pieces: number;
        weight: number;
        serviceType: string;
        driverCurrentlyAssigned: string;
    }>,
): Promise<OT360Order> {
    return callEdge<OT360Order>("updateOrder", { orderId, ...updates });
}

/** Cancel an OT360 order */
export async function cancelOT360Order(orderId: string, reason?: string): Promise<void> {
    await callEdge("cancelOrder", { orderId, reason });
}

// ─── Sync (Pull → daily_loads) ────────────────────────

/** Sync a single OT360 order → daily_loads row */
export async function syncOrderToLoad(
    order: OT360Order,
    driverMapping: Record<string, string>, // ot360DriverId → our driverId
) {
    const ourDriverId = order.driverCurrentlyAssigned
        ? driverMapping[order.driverCurrentlyAssigned] ?? null
        : null;

    const status = mapOT360Status(order.status);

    const payload: Record<string, unknown> = {
        reference_number: order.trackingNumber,
        status,
        driver_id: ourDriverId,
        client_name: order.customerName,
        packages: order.pieces ?? 1,
        weight_lbs: order.weight ?? null,
        service_type: order.serviceType ?? "last_mile",
        comments: order.notes ?? null,
        updated_at: new Date().toISOString(),
    };

    // POD data
    if (order.deliverySignature || (order.proofOfDeliveryPhotos && order.proofOfDeliveryPhotos.length > 0)) {
        payload.pod_confirmed = true;
    }
    if (order.dateCompleted) {
        payload.end_time = new Date(order.dateCompleted).toISOString().split("T")[1].slice(0, 5);
    }

    const { error } = await supabase
        .from("daily_loads")
        .upsert(payload as any, { onConflict: "reference_number" });

    if (error) throw new Error(`OT360 sync failed for ${order.trackingNumber}: ${error.message}`);
    return payload;
}

/** Bulk sync all today's OT360 orders */
export async function syncAllOrders(
    driverMapping: Record<string, string>,
): Promise<{ synced: number; errors: string[] }> {
    const orders = await getTodayOrders();
    const errors: string[] = [];
    let synced = 0;

    for (const order of orders) {
        try {
            await syncOrderToLoad(order, driverMapping);
            synced++;
        } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e));
        }
    }

    return { synced, errors };
}

// ─── GPS Polling ───────────────────────────────────────

export interface DriverGPS {
    driverId: string;
    name: string;
    lat: number;
    lng: number;
    lastUpdate: string;
    speed?: number;
}

/** Fetch live GPS for all active OT360 drivers */
export async function getLiveGPS(
    driverMapping: Record<string, string>,
): Promise<DriverGPS[]> {
    const drivers = await getDrivers();

    return drivers
        .filter((d) => d.status === "Active" && d.currentLatitude && d.currentLongitude)
        .map((d) => ({
            driverId: driverMapping[d.id] ?? d.id,
            name: d.name,
            lat: d.currentLatitude!,
            lng: d.currentLongitude!,
            lastUpdate: d.lastGpsUpdate ?? new Date().toISOString(),
        }));
}
