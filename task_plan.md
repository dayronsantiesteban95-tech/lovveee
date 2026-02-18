# 📋 Task Plan — Anika Control OS

> Premium logistics command platform. Tesla + Uber + Palantir for courier ops.

---

## Phase 0: Initialization ✅ COMPLETE
- [x] `gemini.md` — Project Constitution (premium identity)
- [x] `findings.md` — Research, gaps, blocking questions
- [x] `progress.md` — Session log
- [x] `task_plan.md` — This file

## Phase 1: Blueprint ✅ COMPLETE
- [x] 🎯 North Star: Replace OnTime 360 + real-time visibility + sub-2-min dispatching
- [x] 🔌 Integrations: Google Maps, FCM + Twilio SMS, bridge OnTime 30d, QuickBooks later
- [x] 📍 Source of Truth: Supabase only, manual entry, OnTime truth during bridge
- [x] 📦 Payload: Minimal for drivers, OnTime-parity for dispatchers, P&L for owner
- [x] ⚖️ Behavioral Rules: Dispatcher assigns, 15min/30min alerts, auto-rollover
- [x] Blast system updated: auto-assign → dispatcher-confirms
- [x] Schema migration for OnTime field parity

## Phase 2: Foundation — Design System ✅ COMPLETE
- [x] Premium dark-first CSS design system
- [x] Deep navy/charcoal palette with semantic status colors
- [x] Glassmorphism utility classes (glass-panel, glass-card, cc-overlay-panel)
- [x] Animation library (livePulse, glowPulse, markerPing, panelSlideUp, stagger)
- [x] Command Center layout system (cc-layout, cc-metrics-bar, cc-sidebar)
- [x] Status system (on-time, at-risk, late, live, idle)
- [x] Metric card component primitives
- [x] Sleek scrollbar, hover effects
- [x] `html class="dark"` as default

## Phase 3: Command Center — Live Operations Dashboard ✅ BUILT
- [x] Full-bleed map layout (no padding)
- [x] Top metrics bar (6 animated cards: loads, transit, delivered, unassigned, drivers, revenue)
- [x] Right sidebar panel (glass overlay) with 3 tabs:
  - [x] Loads — filterable by status + hub, live status dots
  - [x] Drivers — active list with assigned load info
  - [x] Alerts — auto-generated from wait times, unassigned, idle
- [x] Map placeholder with radar animation (awaiting Google Maps API key)
- [x] Live indicator when sidebar hidden
- [x] Realtime Supabase subscriptions
- [x] Route added, default landing page, sidebar nav entry
- [x] AppLayout full-bleed support
- [ ] Google Maps integration (needs API key)
- [ ] Real driver position markers
- [ ] Load route polylines on map

## Phase 4: Schema Evolution ✅ MIGRATION CREATED
- [x] OnTime-parity fields: shipper_name, requested_by, pickup/delivery_company, description, dimensions_text, po_number, inbound/outbound tracking, vehicle_required
- [x] ETA tracking fields: estimated_pickup/delivery, actual_pickup/delivery, current_eta, eta_status, sla_deadline
- [x] Route data: route_polyline, route_distance_meters, route_duration_seconds
- [x] Driver app fields: user_id, device_token, notification_preference
- [x] route_alerts table with RLS + realtime
- [x] confirm_blast_assignment PG function (dispatcher-confirms flow)
- [x] rollover_undelivered_loads PG function
- [x] check_wait_time_alerts trigger (15min warning, 30min critical)
- [ ] **RUN MIGRATION** on Supabase (pending user action)

## Phase 5: Load Management (Premium Redesign) ✅ BUILT
- [x] Extended Load type with 20+ OnTime-parity fields (shipper, PO, tracking, ETA, dimensions, etc.)
- [x] Added 'pending' and 'blasted' to status list; renamed 'In Progress' → 'In Transit'
- [x] ETA variance column in load table (on_time / at_risk / late badges with icons)
- [x] Description column in load table (truncated)
- [x] Click-to-inspect: rows are clickable → opens LoadDetailPanel slide-over
- [x] LoadDetailPanel: premium glassmorphism slide-over with 8 organized sections
  - Client & Shipper, Route, Timing & ETA, Cargo Details, Tracking Numbers, Assignment, Financials, Notes
  - Inline status selector, ETA badge, detention/POD indicators
  - One-click "Edit Full Record" button
- [x] Extended Add/Edit dialog with new sections: Shipper & Cargo, Tracking Numbers
- [x] handleSubmit sends all OnTime-parity fields to Supabase
- [x] All action buttons have stopPropagation for row click compatibility
- [x] CSS: status-on-time, status-at-risk, status-late, status-idle badge classes
- [x] CSS: text-data monospace utility class
- [ ] Redesigned blast panel (premium aesthetic — Phase 6 scope)

## Phase 6: Alert System ✅ BUILT
- [x] `useAlerts` hook — reads from `route_alerts` Supabase table
  - Supabase Realtime subscription on Command Center
  - 30s polling fallback on other pages (per Q8: D)
  - Today-only scope (clear at midnight, per Q6: A)
  - Toast notifications for new alerts (per Q3: A)
- [x] Tiered escalation engine (per Q5: C):
  - info (0-5min) → warning (5-15min) → critical (15-30min) → auto_ping (30min+)
  - 60-second re-computation tick
  - Auto-ping toasts supervisor when alert hits 30min
- [x] AlertItem component upgraded:
  - Shows escalation severity badges (CRITICAL, ESCALATED)
  - Age timer display ("5m ago", "just now")
  - Glow animation on critical/escalated alerts
  - Click → opens LoadDetailPanel for the related load (per Q4: B)
- [x] Blast integration (per Q7: D):
  - Synthetic "Unassigned load" alerts generated for loads without a driver
  - "Blast this load" button directly on unassigned alerts → navigates to Dispatch Board
  - Deduplication: synthetic alerts skip if a real DB alert exists for the same load
- [x] Command Center sidebar wired to real `combinedAlerts` (DB + synthetic)
- [x] Bottom-left alert panel (when sidebar hidden) shows critical count badge
- [x] Dismiss All button wired to bulk acknowledge
- [x] LoadDetailPanel integrated into Command Center for alert-click-to-inspect
- [x] Wait time alert types only on Day 1 (per Q2: A)

## Phase 7: Driver App (React Native Expo) ✅ SCAFFOLDED — 2026-02-18
- [x] Project setup (anika-driver-app/)
- [x] Auth flow (driver login screen — dark premium UI)
- [x] Tab navigation (Loads / New Jobs / POD / Profile)
- [x] My Loads screen (real-time, status progression, GPS indicator, today stats)
- [x] Blast screen (active blasts, countdown timer, accept/decline)
- [x] POD screen (camera capture, Supabase Storage upload, notes)
- [x] Profile screen (GPS toggle, driver info, sign out)
- [x] Background GPS hook (Expo Location task, Supabase upsert)
- [x] Auth hook (session persistence, driver lookup by user_id)
- [x] Loads hook (real-time Supabase subscription)
- [x] Blast hook (real-time blast feed)
- [x] Full TypeScript types
- [ ] Google Maps integration (needs API key)
- [ ] Map with animated route on assignment confirmation
- [ ] OneSignal push notifications (needs App ID)
- [ ] Offline-first queue + sync
- [ ] EAS build config (eas.json)
- [ ] App Store / Play Store submission

## Phase 8: Intelligence Layer
- [ ] GPS-to-route comparison
- [ ] Dynamic ETA recalculation
- [ ] Historical pattern learning
- [ ] Smart driver suggestions
- [ ] Alert auto-escalation

## Phase 9: Deployment & Triggers
- [ ] Production migrations
- [ ] Cron jobs (expire blasts, ETA checks, rollover)
- [ ] Push notification webhooks
- [ ] App Store / Google Play submission
- [ ] E2E testing

---

## Verification Log

| Date | Check | Result |
|---|---|---|
| 2026-02-14 12:59 | TypeScript compile | 0 errors ✅ |
| 2026-02-14 12:59 | Vite build | 7.68s clean ✅ |
| 2026-02-14 13:15 | Code audit + bug fixes | 6 bugs fixed ✅ |
| 2026-02-14 13:25 | Phase 5 build | TypeScript 0 errors, Vite 8.11s ✅ |
| 2026-02-14 13:28 | Phase 6 build | TypeScript 0 errors, Vite 7.77s ✅ |

## Current Status: Phase 7 scaffolded ✅ — Needs: Supabase migration run + Google Maps key + OneSignal App ID

## Dayron's Tasks (Day 1 — 1hr)
1. Run `lovveee/supabase/migrations/20260218_create_rpc_functions.sql` in Supabase SQL Editor
2. Get Google Maps API key → send to Jarvis
3. Get Supabase anon key → send to Jarvis (for driver app .env)

## Jarvis's Next (autonomous)
1. Web app polish pass (design consistency, broken components audit)
2. Google Maps integration (CommandCenter) — blocked on API key
3. OneSignal push notification setup
4. Driver app map screen (animated route)
5. EAS build config for App Store submission
