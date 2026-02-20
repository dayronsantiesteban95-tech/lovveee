// -----------------------------------------------------------
// Shared types for DispatchTracker and its sub-components
// -----------------------------------------------------------

export type Driver = { id: string; full_name: string; hub: string; status: string };
export type Vehicle = { id: string; vehicle_name: string; vehicle_type: string; hub: string; status: string };
export type Load = {
    id: string; load_date: string; reference_number: string | null;
    dispatcher_id: string | null; driver_id: string | null; vehicle_id: string | null;
    shift: string; hub: string; client_name: string | null;
    pickup_address: string | null; delivery_address: string | null;
    miles: number; deadhead_miles: number;
    start_time: string | null; end_time: string | null; wait_time_minutes: number;
    revenue: number; driver_pay: number; fuel_cost: number;
    status: string; detention_eligible: boolean; detention_billed: number;
    service_type: string; packages: number; weight_lbs: number | null;
    comments: string | null; pod_confirmed: boolean;
    created_at: string; updated_at: string;
    // OnTime-parity fields
    shipper_name?: string | null;
    requested_by?: string | null;
    pickup_company?: string | null;
    delivery_company?: string | null;
    collection_time?: string | null;
    delivery_time?: string | null;
    description?: string | null;
    dimensions_text?: string | null;
    vehicle_required?: string | null;
    po_number?: string | null;
    inbound_tracking?: string | null;
    outbound_tracking?: string | null;
    estimated_pickup?: string | null;
    estimated_delivery?: string | null;
    actual_pickup?: string | null;
    actual_delivery?: string | null;
    current_eta?: string | null;
    eta_status?: string | null;
    sla_deadline?: string | null;
    route_distance_meters?: number | null;
    route_duration_seconds?: number | null;
    cutoff_time?: string | null;
};
export type Profile = { user_id: string; full_name: string };

export type AddLoadForm = {
    // Step 1: Load Info
    reference_number: string;
    consol_number: string;
    client_name: string;
    client_id: string;
    service_type: string;
    revenue: string;
    sla_deadline: string;
    po_number: string;
    vehicle_type: string;
    distance_miles: string;
    // Step 2: Pickup
    pickup_company: string;
    pickup_address: string;
    pickup_open_hours: string;
    pickup_contact_name: string;
    pickup_contact_phone: string;
    pickup_time_from: string;
    pickup_time_to: string;
    // Step 2: Delivery
    delivery_company: string;
    delivery_address: string;
    delivery_contact_name: string;
    delivery_contact_phone: string;
    // Step 3: Cargo
    packages: string;
    package_type: string;
    weight_kg: string;
    dim_l: string;
    dim_w: string;
    dim_h: string;
    dimensions_text: string;
    description: string;
    // Step 3: Driver
    driver_id: string;
    // BOL
    bol_url: string;
    // Airline cutoff
    cutoff_time: string;
};

export type Company = {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
};

export type CompanyContact = {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    job_title: string | null;
    company_id: string | null;
};

export type RateCard = {
    hub: string;
    service_type: string;
    vehicle_type: string;
    base_rate: number;
    per_mile_rate: number;
    per_lb_rate: number;
    min_charge: number;
    fuel_surcharge_pct: number;
};

export type AnikaModifiers = {
    afterHours: boolean;
    weekend: boolean;
    holiday: boolean;
    tenderingFee: boolean;
    attemptCharge: boolean;
    additionalStops: number;
    extraPieces: number;
    specialHandling: boolean;
    documents: boolean;
    holding: number;
    waitTime: number;
    secondPerson: boolean;
    whiteGlove: boolean;
    hazmat: boolean;
};

export type AnikaBreakdown = {
    baseRate: number;
    mileageCharge: number;
    fuelSurcharge: number;
    subtotal: number;
    weightSurcharge: number;
    modifiersTotal: number;
    finalQuote: number;
};
