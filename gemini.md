# 📜 Gemini — Project Constitution

> This file is **LAW**. Only updated when schemas change, rules are added, or architecture is modified.

---

## Identity

- **Product:** Anika Control OS
- **Tagline:** High-performance logistics command platform
- **Purpose:** Fully replace OnTime360 with a premium, real-time operations cockpit — delivering live tracking, manual dispatcher control with intelligent assistance, predictive delay alerts, and structured load management.
- **Stack:** React 18 / TypeScript / Vite / Supabase / Vanilla CSS + CSS Variables / shadcn-ui
- **Mobile:** React Native (Expo) — driver app
- **Maps:** Google Maps (routing, traffic ETA, geocoding)
- **Push:** Firebase FCM + Twilio SMS fallback
- **Identity Model:** Tesla + Uber + Palantir for courier ops

---

## 🎯 North Star

> Replace OnTime 360 + real-time operational visibility + sub-2-minute dispatching.
> Revenue intelligence and scaling come in later phases.

---

## Phase 1 Blueprint (Locked)

### Integrations
| Service | Purpose | Status |
|---|---|---|
| Google Maps | Routing, traffic ETA, geocoding, map rendering | 🟡 Fresh provision |
| Firebase FCM | Push notifications to driver app | 🟡 Fresh provision |
| Twilio | SMS fallback when driver doesn't have app | 🟡 Fresh provision |
| Supabase | DB + Auth + Realtime + Edge Functions | ✅ Active |
| OnTime 360 | Bridge mode — truth during 30-day transition | ✅ Proxy built |
| Onfleet | Bridge mode — secondary reference | ✅ Proxy built |
| QuickBooks/FreshBooks | Accounting/invoicing (future phase) | 🔮 Roadmap |
| Email Parser | Auto-create loads from client emails (future) | 🔮 Roadmap |

### Source of Truth
- **Database:** Supabase only (single Postgres instance)
- **Load entry:** Manual by dispatchers (email parser later)
- **During 30-day bridge:** OnTime 360 is truth → Control OS mirrors → Control OS takes over

### Delivery Payload
| Role | What they see |
|---|---|
| **Driver (blast)** | Minimal: pickup address, delivery address, package count |
| **Dispatcher** | Full OnTime-style: order #, shipper, requested by, collection/delivery locations with company names, service level, description, quantity, weight, dimensions, reference #, P.O. #, tracking numbers, times |
| **CEO/Owner** | P&L dashboard (revenue, costs, margins) + dispatch controls |
| **Client** | Live tracking link: "Your delivery is 10 min away" |

### Behavioral Rules
1. **Dispatcher assigns all loads** — no auto-assign from blasts. Blast = availability check, dispatcher confirms.
2. **Any active driver** can receive blasts (no workload filtering)
3. **Wait time:** Alert at 15 minutes, detention-eligible at 30 minutes
4. **Late loads:** Alert dispatcher only — they handle it
5. **Undelivered loads:** Auto roll over to next day
6. All authenticated team members can read all data
7. Write operations scoped to `auth.uid()` via RLS
8. API keys server-side only via Edge Functions
9. Sanitize `%` and `_` in `.ilike()` queries
10. Dark mode is primary theme
11. Map is primary interface, tables are secondary
12. Every real-time update must animate, never "pop in"

---

## Design Philosophy

### Must Feel Like
- **Linear.app** — clean, fast, minimal clutter
- **Stripe Dashboard** — smooth transitions, premium typography
- **Uber Driver App** — instant responsiveness, large controls, map-centric

### Must NOT Feel Like
- Old freight software UI / Spreadsheet-heavy layout / Clunky enterprise design

### Design Pillars
1. Fast (sub-100ms interactions)
2. Smooth (micro-animations, eased transitions)
3. Dark-mode primary
4. Map-centric
5. Real-time animated
6. Minimal clutter
7. High-end enterprise SaaS quality

---

## Data Schema

### Core Tables

#### `daily_loads` (Enhanced — OnTime parity)
```
id, load_date, reference_number, dispatcher_id, driver_id, vehicle_id,
shift, hub, status, service_type,
-- Client / Shipper
client_name, shipper_name, requested_by,
-- Locations
pickup_address, pickup_company, delivery_address, delivery_company,
-- Timing
collection_time, delivery_time, start_time, end_time,
-- Package details
packages, weight_lbs, dimensions_text, description,
-- Tracking
po_number, inbound_tracking, outbound_tracking,
vehicle_required,
-- Financial
miles, deadhead_miles, revenue, driver_pay, fuel_cost,
-- Wait / Detention
wait_time_minutes, detention_eligible, detention_billed,
-- Status
pod_confirmed, comments,
created_at, updated_at
```

#### `drivers`
```
id, full_name, phone, email, hub, status,
license_number, hourly_rate,
user_id (future — for driver app login),
device_token (future — for push notifications)
```

#### `vehicles`
```
id, name, type, plate_number, vin, status, hub,
year, make, model, current_mileage
```

### Dispatch Blast System
#### `dispatch_blasts`
- priority: low | normal | high | urgent
- status: active | accepted | expired | cancelled
- **NOTE:** "accepted" means dispatcher confirmed assignment, NOT auto-assigned

#### `blast_responses`
- status: pending | viewed | interested | declined | expired
- **Changed:** "accepted" → "interested" — driver expresses interest, dispatcher decides

### GPS & Tracking
- `driver_locations` — GPS breadcrumb trail (realtime)
- `driver_shifts` — on-duty / off-duty / break
- `load_status_events` — audit trail for every status change

### CRM Tables (Existing)
profiles, leads, companies, contacts, tasks, notifications

---

## Architectural Invariants

1. Supabase is the single source of truth
2. Auth via Supabase Auth exclusively
3. RLS policies enforce data access
4. Real-time via Supabase Realtime (WebSockets)
5. Dispatcher controls all assignments (blast = availability tool, not auto-assign)
6. Hub-first driver selection in blast UI
7. Background GPS from driver app feeds `driver_locations`
8. Predictive alerts computed server-side
9. Mobile app must work offline for core driver actions

---

## Deployment
- **Web:** Vercel
- **Mobile:** App Store + Google Play (future)
- **Database:** Supabase (managed Postgres)
- **Edge Functions:** Supabase Edge Functions (Deno)

---

## Maintenance Log

| Date | Change | Author |
|---|---|---|
| 2026-02-11 | Initial constitution | System Pilot |
| 2026-02-13 | Dispatch Blast schema | System Pilot |
| 2026-02-13 | Rebranded to Anika Control OS | System Pilot |
| 2026-02-14 | **Phase 1 Blueprint locked** — all 5 discovery questions answered. North star, integrations, source of truth, payload, behavioral rules defined. Blast changed from auto-assign to dispatcher-confirms. OnTime field parity added to schema. | System Pilot |
