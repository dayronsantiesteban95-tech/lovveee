export const TEAM_MEMBERS = [
  { name: "Dayron Santiesteban", role: "owner" as const },
  { name: "Reinaldo Neira", role: "owner" as const },
  { name: "Andres Villegas", role: "owner" as const },
  { name: "Juan Pedraza", role: "dispatcher" as const },
  { name: "Daniela Villegas", role: "dispatcher" as const },
  { name: "Rosalia Dominguez", role: "dispatcher" as const },
  { name: "Dana Perez", role: "dispatcher" as const },
];

export const LEAD_STAGES = [
  { value: "new_lead", label: "New Lead" },
  { value: "qualified", label: "Qualified / Needs Analysis" },
  { value: "quote_sent", label: "Quote Sent / Proposal" },
  { value: "operational_review", label: "Operational Review" },
  { value: "trial_run", label: "Trial Run / Pilot" },
  { value: "account_active", label: "Account Active" },
  { value: "retention", label: "Retention / Check-in" },
] as const;

export const TASK_PRIORITIES = [
  { value: "critical", label: "Critical", color: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "low", label: "Low", color: "bg-green-500" },
] as const;

export const TASK_STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
] as const;

export const DEPARTMENTS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "marketing_growth", label: "Marketing/Growth" },
  { value: "operations", label: "Operations" },
  { value: "fleet_courier", label: "Fleet/Courier Mgt" },
  { value: "finance", label: "Finance" },
] as const;

export const ACTIVITY_TYPES = [
  { value: "note", label: "Note", icon: "MessageSquare" },
  { value: "email", label: "Email", icon: "Mail" },
  { value: "call", label: "Call", icon: "Phone" },
  { value: "meeting", label: "Meeting", icon: "Users" },
] as const;

export const TIMEZONES = [
  { city: "Atlanta", timezone: "America/New_York", abbr: "EST" },
  { city: "Phoenix", timezone: "America/Phoenix", abbr: "MST" },
  { city: "Los Angeles", timezone: "America/Los_Angeles", abbr: "PST" },
] as const;

export const CITY_HUBS = [
  { value: "atlanta", label: "Atlanta" },
  { value: "phoenix", label: "Phoenix" },
  { value: "la", label: "Los Angeles" },
] as const;

export const INDUSTRIES = [
  { value: "medical_pharma", label: "Medical/Pharma", color: "bg-blue-500" },
  { value: "legal", label: "Legal", color: "bg-purple-500" },
  { value: "auto_parts", label: "Auto Parts", color: "bg-amber-500" },
  {
    value: "ecommerce_last_mile",
    label: "E-commerce/Last-Mile",
    color: "bg-emerald-500",
  },
] as const;

export const SERVICE_TYPES = [
  { value: "last_mile", label: "Last Mile" },
  { value: "courier", label: "Courier" },
  { value: "white_glove", label: "White-Glove" },
  { value: "hotshot", label: "6-Hour Hotshot" },
] as const;

export const VEHICLE_TYPES = [
  { value: "cargo_van", label: "Cargo Van" },
  { value: "sprinter", label: "Sprinter" },
  { value: "box_truck", label: "Box Truck" },
  { value: "car_suv", label: "Car/SUV" },
] as const;

export const SOP_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "last_mile", label: "Last-Mile" },
  { value: "hotshot", label: "Hotshot" },
  { value: "onboarding", label: "Onboarding" },
] as const;

// -----------------------------------------------------------
// Timing & Refresh Intervals (milliseconds)
// -----------------------------------------------------------

/** ETA refresh interval - fetch new traffic data every 60 seconds */
export const ETA_REFRESH_INTERVAL_MS = 60 * 1000;

/** Real-time driver location active threshold - 10 minutes */
export const DRIVER_ACTIVE_THRESHOLD_MS = 10 * 60 * 1000;

/** Minimum time between driver position updates to prevent thrashing */
export const MIN_DRIVER_UPDATE_INTERVAL_MS = 15_000; // 15 seconds

/** Google Maps script loading poll interval */
export const MAPS_POLL_INTERVAL_MS = 200;

/** Google Maps script loading timeout */
export const MAPS_POLL_TIMEOUT_MS = 15_000;

/** ETA buffer time for "on-time" status (green) */
export const ETA_ON_TIME_BUFFER_MS = 15 * 60 * 1000; // 15 minutes

/** BLAST auto-assignment timer */
export const BLAST_TIMER_MINUTES = 15;

/** BLAST timer in milliseconds */
export const BLAST_TIMER_MS = BLAST_TIMER_MINUTES * 60 * 1000;

// Cities within ~300 miles of each hub for radius validation
export const ACTION_ZONE_CITIES: Record<string, string[]> = {
  atlanta: [
    "atlanta",
    "marietta",
    "decatur",
    "savannah",
    "augusta",
    "macon",
    "athens",
    "alpharetta",
    "roswell",
    "sandy springs",
    "kennesaw",
    "duluth",
    "lawrenceville",
    "columbus",
    "chattanooga",
  ],
  phoenix: [
    "phoenix",
    "scottsdale",
    "tucson",
    "mesa",
    "tempe",
    "chandler",
    "flagstaff",
    "sedona",
    "yuma",
    "prescott",
    "las vegas",
    "henderson",
    "albuquerque",
  ],
  la: [
    "los angeles",
    "long beach",
    "anaheim",
    "santa ana",
    "riverside",
    "san bernardino",
    "ontario",
    "pasadena",
    "san diego",
    "bakersfield",
    "santa barbara",
    "palm springs",
    "ventura",
    "oxnard",
    "irvine",
  ],
};
