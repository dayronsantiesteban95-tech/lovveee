/**
 * Onfleet Integration Client
 *
 * All calls go through Supabase Edge Functions to keep the API key server-side.
 * The Edge Function name is "onfleet-proxy" and accepts:
 *   POST { action, ...params }
 *
 * Read operations:
 *   getWorkerLocations() -- live GPS positions
 *   getTask(id)          -- single task details
 *   getTodayTasks()      -- all tasks for today
 *
 * Write operations:
 *   pushLoadToOnfleet()  -- create a task from our load data
 *   updateOnfleetTask()  -- update task fields
 *   completeOnfleetTask()-- mark task completed with POD
 *
 * Sync:
 *   syncTaskToLoad()     -- pull an Onfleet task -> our daily_loads row
 *   syncAllTasks()       -- bulk sync all today's tasks
 */
import { supabase } from "@/integrations/supabase/client";
import type {
    OnfleetTask,
    OnfleetWorker,
} from "./types";
import { mapOnfleetStatus, calcWaitMinutes } from "./types";

// --- Edge Function Caller ------------------------------

async function callEdge<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await supabase.functions.invoke("onfleet-proxy", {
        body: { action, ...params },
    });
    if (error) throw new Error(`Onfleet proxy error: ${error.message}`);
    return data as T;
}

// --- Read Operations -----------------------------------

/** Get all active workers with their GPS locations */
export async function getWorkerLocations(): Promise<OnfleetWorker[]> {
    return callEdge<OnfleetWorker[]>("listWorkers");
}

/** Get a single task by Onfleet ID */
export async function getTask(taskId: string): Promise<OnfleetTask> {
    return callEdge<OnfleetTask>("getTask", { taskId });
}

/** List all tasks for today */
export async function getTodayTasks(): Promise<OnfleetTask[]> {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    return callEdge<OnfleetTask[]>("listTasks", {
        from: from.getTime(),
        to: to.getTime(),
        state: "all",
    });
}

// --- Write Operations (Push -> Onfleet) -----------------

interface PushLoadPayload {
    pickupAddress: string;
    deliveryAddress: string;
    recipientName: string;
    recipientPhone: string;
    notes?: string;
    pickupAfter?: number;     // Unix ms
    deliverBefore?: number;   // Unix ms
    packages?: number;
    serviceTimeMinutes?: number;
    assignToWorkerId?: string;
}

/** Create a new Onfleet task from our load data (bidirectional sync) */
export async function pushLoadToOnfleet(payload: PushLoadPayload): Promise<OnfleetTask> {
    return callEdge<OnfleetTask>("createTask", {
        destination: {
            address: { unparsed: payload.deliveryAddress },
        },
        recipients: [
            {
                name: payload.recipientName || "Recipient",
                phone: payload.recipientPhone || "",
            },
        ],
        notes: payload.notes ?? "",
        completeAfter: payload.pickupAfter,
        completeBefore: payload.deliverBefore,
        quantity: payload.packages ?? 1,
        serviceTime: payload.serviceTimeMinutes ?? 5,
        // If assigning to a specific worker, use their container
        ...(payload.assignToWorkerId ? {
            container: {
                type: "WORKER",
                worker: payload.assignToWorkerId,
            },
        } : {}),
    });
}

/** Update an existing Onfleet task */
export async function updateOnfleetTask(
    taskId: string,
    updates: {
        notes?: string;
        deliveryAddress?: string;
        recipientName?: string;
        recipientPhone?: string;
        completeBefore?: number;
    },
): Promise<OnfleetTask> {
    const params: Record<string, unknown> = { taskId };

    if (updates.notes !== undefined) params.notes = updates.notes;
    if (updates.completeBefore !== undefined) params.completeBefore = updates.completeBefore;
    if (updates.deliveryAddress) {
        params.destination = { address: { unparsed: updates.deliveryAddress } };
    }
    if (updates.recipientName || updates.recipientPhone) {
        params.recipients = [{
            name: updates.recipientName ?? "",
            phone: updates.recipientPhone ?? "",
        }];
    }

    return callEdge<OnfleetTask>("updateTask", params);
}

/** Mark an Onfleet task as completed (with optional notes) */
export async function completeOnfleetTask(
    taskId: string,
    success: boolean = true,
    completionNotes?: string,
): Promise<void> {
    await callEdge("completeTask", {
        taskId,
        success,
        completionNotes: completionNotes ?? "",
    });
}

/** Delete an Onfleet task */
export async function deleteOnfleetTask(taskId: string): Promise<void> {
    await callEdge("deleteTask", { taskId });
}

// --- Sync (Pull -> daily_loads) ------------------------

/** Sync a single Onfleet task -> daily_loads row */
export async function syncTaskToLoad(
    task: OnfleetTask,
    driverMapping: Record<string, string>, // onfleetWorkerId -> our driverId
    userId: string,
) {
    const ourDriverId = task.worker ? driverMapping[task.worker] ?? null : null;
    const status = mapOnfleetStatus(task.state, task.completionDetails?.success);
    const waitMinutes = task.completionDetails?.events
        ? calcWaitMinutes(task.completionDetails.events)
        : 0;

    // Build upsert payload -- keyed by reference_number (the Onfleet shortId)
    const payload: Record<string, unknown> = {
        reference_number: task.shortId,
        status,
        driver_id: ourDriverId,
        delivery_address: task.destination?.address?.unparsed
            ?? `${task.destination?.address?.street}, ${task.destination?.address?.city}`,
        wait_time_minutes: waitMinutes,
        packages: task.recipients?.length ?? 1,
        updated_at: new Date().toISOString(),
    };

    // If completed, add POD and distance data
    if (task.completionDetails) {
        const cd = task.completionDetails;
        payload.pod_confirmed = cd.success;

        // meters -> miles (1 meter = 0.000621371 miles)
        if (cd.distance) {
            payload.miles = Math.round(cd.distance * 0.000621371 * 10) / 10;
        }

        // Compute start/end times from completion events
        const startEvt = cd.events.find((e) => e.name === "start");
        const endEvt = cd.events.find((e) => e.name === "completion");
        if (startEvt) payload.start_time = new Date(startEvt.time).toISOString().split("T")[1].slice(0, 5);
        if (endEvt) payload.end_time = new Date(endEvt.time).toISOString().split("T")[1].slice(0, 5);

        // Detention eligibility: > 15 min wait
        payload.detention_eligible = waitMinutes > 15;
    }

    // Upsert using reference_number as the conflict key
    const { error } = await supabase
        .from("daily_loads")
        .upsert(payload as any, { onConflict: "reference_number" });

    if (error) throw new Error(`Sync failed for ${task.shortId}: ${error.message}`);
    return payload;
}

/** Bulk sync all today's Onfleet tasks */
export async function syncAllTasks(
    driverMapping: Record<string, string>,
    userId: string,
): Promise<{ synced: number; errors: string[] }> {
    const tasks = await getTodayTasks();
    const errors: string[] = [];
    let synced = 0;

    for (const task of tasks) {
        try {
            await syncTaskToLoad(task, driverMapping, userId);
            synced++;
        } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e));
        }
    }

    return { synced, errors };
}

// --- GPS Polling ---------------------------------------

export interface DriverGPS {
    driverId: string;      // our internal driver ID
    name: string;
    lat: number;
    lng: number;
    onDuty: boolean;
    activeTaskId: string | null;
    lastSeen: number;      // Unix ms
    eta?: number;          // seconds
}

/** Fetch live GPS for all on-duty workers, mapped to our driver IDs */
export async function getLiveGPS(
    driverMapping: Record<string, string>, // onfleetWorkerId -> our driverId
): Promise<DriverGPS[]> {
    const workers = await getWorkerLocations();

    return workers
        .filter((w) => w.location && w.onDuty)
        .map((w) => ({
            driverId: driverMapping[w.id] ?? w.id,
            name: w.name,
            lat: w.location!.latitude,
            lng: w.location!.longitude,
            onDuty: w.onDuty,
            activeTaskId: w.activeTask ?? null,
            lastSeen: w.timeLastSeen ?? Date.now(),
        }));
}
