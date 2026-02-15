// ─── OnTime 360 API Types ──────────────────────────────
// See: https://ontime360.com/developer

export interface OT360Location {
    id: string;
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    latitude?: number;
    longitude?: number;
}

export type OT360OrderStatus =
    | "Entered"
    | "Submitted"
    | "Quoted"
    | "Assigned"
    | "Dispatched"
    | "AssignedInRoute"
    | "InTransit"
    | "Delivered"
    | "Completed"
    | "Cancelled"
    | "OnHold";

export interface OT360Order {
    id: string;
    trackingNumber: string;
    incomingTrackingNumber?: string;
    outgoingTrackingNumber?: string;
    referenceNumber?: string;
    purchaseOrderNumber?: string;
    customerName: string;
    status: OT360OrderStatus;
    dateSubmitted: string;        // ISO
    dateCompleted?: string;       // ISO
    collectionLocation: string;   // location ID
    deliveryLocation: string;     // location ID
    driverCurrentlyAssigned?: string; // driver ID
    pieces?: number;
    weight?: number;
    serviceType?: string;
    notes?: string;
    collectionSignature?: string; // base64 or URL
    deliverySignature?: string;   // base64 or URL
    proofOfDeliveryPhotos?: string[];
    userDefinedFields?: Record<string, string>;
}

export interface OT360Driver {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    status: "Active" | "Inactive";
    currentLatitude?: number;
    currentLongitude?: number;
    lastGpsUpdate?: string; // ISO
}

export interface OT360GpsPosition {
    driverId: string;
    latitude: number;
    longitude: number;
    timestamp: string; // ISO
    speed?: number;    // mph
    heading?: number;  // degrees
}

// ─── Mapping helpers ───────────────────────────────────

/** Maps OT360 order status to our load status */
export function mapOT360Status(status: OT360OrderStatus): string {
    const map: Record<OT360OrderStatus, string> = {
        Entered: "pending",
        Submitted: "pending",
        Quoted: "pending",
        Assigned: "assigned",
        Dispatched: "dispatched",
        AssignedInRoute: "in_transit",
        InTransit: "in_transit",
        Delivered: "delivered",
        Completed: "delivered",
        Cancelled: "cancelled",
        OnHold: "on_hold",
    };
    return map[status] || "pending";
}
