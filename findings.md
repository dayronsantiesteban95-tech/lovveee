# 🔍 Findings — Anika Control OS

## Research & Discoveries

### Existing Infrastructure Assessment
| Component | Status | Premium-Ready? |
|---|---|---|
| `drivers` table | ✅ Has phone, email, hub | ❌ No `user_id` — drivers can't log in |
| `driver_locations` (GPS) | ✅ Realtime enabled | 🟡 Needs mobile app to feed it |
| `driver_shifts` | ✅ On-duty tracking | ✅ Can filter blast targets |
| `daily_loads` | ✅ Core load tracking | 🟡 Missing ETA fields, route data |
| `load_status_events` | ✅ Audit trail | ✅ Good foundation |
| Dispatch Blast (just built) | ✅ Tables + hook + UI | 🟡 UI needs premium redesign |
| Onfleet proxy | ✅ Full CRUD | ✅ Can bridge during transition |
| OnTime 360 proxy | ✅ Full CRUD | ✅ Can bridge during transition |
| Map component (`LiveDriverMap`) | ✅ Exists | ❌ Needs total redesign for premium |
| Dark mode | ❌ Not implemented | ❌ Critical — needs full theme system |

### Schema Gaps for Premium Platform
1. **`daily_loads` missing fields:**
   - `estimated_pickup_time` (timestamptz) — for ETA calculations
   - `estimated_delivery_time` (timestamptz) — for SLA tracking
   - `actual_pickup_time` / `actual_delivery_time` — for variance
   - `route_polyline` (text) — encoded route from Maps API
   - `route_distance_meters` (integer) — from routing API
   - `route_duration_seconds` (integer) — from routing API
   - `current_eta` (timestamptz) — dynamically updated
   - `eta_status` (text) — on_time / at_risk / late
   - `sla_deadline` (timestamptz) — contractual delivery deadline

2. **`drivers` missing fields:**
   - `user_id` (uuid) — link to auth.users for driver login
   - `device_token` (text) — for push notifications
   - `notification_preference` (text) — push / sms / both

3. **New tables needed:**
   - `route_alerts` — predictive alerts (idle, deviation, ETA breach)
   - `driver_sessions` — mobile app session tracking

### Integration Research Needed
| Service | What We Need | Decision Required |
|---|---|---|
| **Map Provider** | Routing, traffic ETA, map tiles, geocoding | Google Maps vs Mapbox — user said "open to either" |
| **Push Notifications** | Driver app blast alerts | Firebase FCM vs OneSignal — user said "open to either" |
| **SMS** | Fallback notification channel | Twilio — user said "optional" |
| **Background GPS** | Continuous driver tracking | React Native Geolocation or Flutter location packages |

### Design System Research
Premium reference apps studied:
- **Linear.app** — command palette, keyboard-first, dark theme, minimal spacing
- **Stripe Dashboard** — data density with elegance, smooth charts, clean tables
- **Uber (driver)** — map-centric, large buttons, status progression, haptic feedback
- **Palantir Gotham** — dark operational dashboards, real-time data feeds, map overlays

### Key Architectural Decisions Needed
1. **Mobile framework**: React Native (Expo) vs Flutter — affects entire mobile stack
2. **Map provider**: Google Maps ($) vs Mapbox ($$) — affects routing, ETA, rendering
3. **Push provider**: Firebase FCM (free) vs OneSignal (free tier available)
4. **Build priority**: Dashboard redesign first? Or driver app first?

---

## Open Questions (Blocking)

### Critical (Must answer before Phase 2 build)
- [ ] **React Native or Flutter** for driver app?
- [ ] **Google Maps or Mapbox** for routing + rendering?
- [ ] **Firebase FCM or OneSignal** for push notifications?
- [ ] **Build order**: Redesign web dashboard first → then driver app? Or parallel?
- [ ] Any existing Google Maps / Mapbox API key already provisioned?

### Important (Can decide during build)
- [ ] Should Onfleet/OnTime 360 integration remain during transition, or clean break?
- [ ] Driver roles in Supabase Auth — separate sign-up flow? Dispatcher creates driver accounts?
- [ ] SLA thresholds — what % ETA variance triggers "at-risk"?
- [ ] Should predictive alerts also notify the client, or dispatchers only?
