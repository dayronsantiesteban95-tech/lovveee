// ─── Onfleet API Types ─────────────────────────────────
// See: https://docs.onfleet.com/reference

export interface OnfleetLocation {
    lat: number;
    lng: number;
}

export interface OnfleetAddress {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    apartment?: string;
    unparsed?: string;
}

export interface OnfleetDestination {
    id: string;
    address: OnfleetAddress;
    location: [number, number]; // [lng, lat]
    notes?: string;
}

export interface OnfleetRecipient {
    id: string;
    name: string;
    phone: string;
    notes?: string;
}

export interface OnfleetCompletionDetails {
    success: boolean;
    notes?: string;
    time: number; // Unix ms
    firstLocation?: [number, number];
    lastLocation?: [number, number];
    distance?: number; // meters
    signatureUrl?: string;
    photoUrls?: string[];
    events: OnfleetCompletionEvent[];
}

export interface OnfleetCompletionEvent {
    name: "start" | "arrival" | "departure" | "completion";
    time: number; // Unix ms
    location?: [number, number];
}

/** Onfleet task states */
export type OnfleetTaskState = 0 | 1 | 2 | 3;
// 0 = Unassigned, 1 = Assigned, 2 = Active, 3 = Completed

export interface OnfleetTask {
    id: string;
    shortId: string;
    trackingURL: string;
    state: OnfleetTaskState;
    destination: OnfleetDestination;
    recipients: OnfleetRecipient[];
    notes?: string;
    completionDetails?: OnfleetCompletionDetails;
    feedback?: { rating: number; comment?: string };
    eta?: number; // seconds until arrival
    delayTime?: number; // seconds
    serviceTime?: number; // estimated minutes at stop
    estimatedCompletionTime?: number; // Unix ms
    timeCreated: number;
    timeLastModified: number;
    completeAfter?: number;
    completeBefore?: number;
    metadata?: { name: string; type: string; value: unknown }[];
    worker?: string; // worker ID
}

export interface OnfleetWorker {
    id: string;
    name: string;
    phone: string;
    activeTask?: string | null;
    tasks: string[];
    onDuty: boolean;
    location?: {
        longitude: number;
        latitude: number;
    };
    vehicle?: {
        id: string;
        type: string;
        description?: string;
        licensePlate?: string;
        color?: string;
    };
    metadata?: { name: string; type: string; value: unknown }[];
    timeLastSeen?: number; // Unix ms
    timeLastModified: number;
    timeCreated: number;
}

/** Webhook event types we care about */
export type OnfleetWebhookTrigger =
    | "taskStarted"      // 0
    | "taskEta"          // 1
    | "taskArrival"      // 2
    | "taskCompleted"    // 3
    | "taskFailed"       // 4
    | "workerDuty"       // 5
    | "taskCreated"      // 6
    | "taskUpdated"      // 7
    | "taskDelayed"      // 9
    | "taskCloned"       // 12
    | "taskUnassigned";  // 13

export interface OnfleetWebhookPayload {
    actionContext: { type: string };
    adminId?: string;
    data: OnfleetTask | OnfleetWorker;
    taskId?: string;
    workerId?: string;
    time: number;
    triggerId: number;
    triggerName: OnfleetWebhookTrigger;
}

// ─── Mapping helpers ───────────────────────────────────

/** Maps Onfleet task state to our load status */
export function mapOnfleetStatus(state: OnfleetTaskState, success?: boolean): string {
    switch (state) {
        case 0: return "unassigned";
        case 1: return "assigned";
        case 2: return "in_transit";
        case 3: return success ? "delivered" : "failed";
        default: return "pending";
    }
}

/** Extracts wait time in minutes from completion events */
export function calcWaitMinutes(events: OnfleetCompletionEvent[]): number {
    const arrival = events.find((e) => e.name === "arrival");
    const departure = events.find((e) => e.name === "departure");
    if (!arrival || !departure) return 0;
    return Math.round((departure.time - arrival.time) / 60_000);
}

/** Extracts service time (arrival → completion) in minutes */
export function calcServiceMinutes(events: OnfleetCompletionEvent[]): number {
    const arrival = events.find((e) => e.name === "arrival");
    const completion = events.find((e) => e.name === "completion");
    if (!arrival || !completion) return 0;
    return Math.round((completion.time - arrival.time) / 60_000);
}
