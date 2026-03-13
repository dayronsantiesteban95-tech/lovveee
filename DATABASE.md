# Database Schema Documentation

Complete reference for Anika Control OS database schema (Supabase/PostgreSQL).

**Database**: Supabase PostgreSQL
**Migrations**: 65 deployed
**Last Updated**: March 13, 2026

---

## 📋 Table of Contents

- [Overview](#overview)
- [Core Tables](#core-tables)
- [Dispatch & Logistics Tables](#dispatch--logistics-tables)
- [Driver & Fleet Tables](#driver--fleet-tables)
- [CRM Tables](#crm-tables)
- [Authentication & Users](#authentication--users)
- [System Tables](#system-tables)
- [Database Functions (RPCs)](#database-functions-rpcs)
- [Row Level Security (RLS)](#row-level-security-rls)
- [Indexes & Performance](#indexes--performance)
- [Migration History](#migration-history)
- [ER Diagram](#er-diagram)

---

## Overview

### Database Statistics

- **Total Tables**: 30+
- **Total Migrations**: 65
- **RLS Enabled**: All user-facing tables
- **Realtime Enabled**: 6 tables (WebSocket subscriptions)
- **Custom Functions**: 10+ RPCs
- **Storage Buckets**: 1 (`pod-photos`)

### Technology

- **Database**: PostgreSQL 15.x (Supabase managed)
- **Extensions**:
  - `uuid-ossp` - UUID generation
  - `pg_cron` - Scheduled jobs
  - `pg_stat_statements` - Query performance
- **Realtime**: Supabase Realtime (WebSockets)
- **Auth**: Supabase Auth (built-in)

---

## Core Tables

### `daily_loads`

**Primary logistics table** — Stores all delivery/pickup loads.

**Purpose**: Core load management (equivalent to OnTime 360 orders)

**Columns**:
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()

-- Metadata
load_date             DATE NOT NULL
reference_number      TEXT UNIQUE
status                TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'in_transit',
                                      'picked_up', 'out_for_delivery', 'delivered',
                                      'cancelled', 'blasted'))

-- Assignments
dispatcher_id         UUID REFERENCES profiles(id)
driver_id             UUID REFERENCES drivers(id)
vehicle_id            UUID REFERENCES vehicles(id)
shift                 TEXT
hub                   TEXT

-- Client Information
client_name           TEXT
shipper_name          TEXT
requested_by          TEXT

-- Locations
pickup_address        TEXT NOT NULL
pickup_company        TEXT
pickup_lat            NUMERIC
pickup_lng            NUMERIC
delivery_address      TEXT NOT NULL
delivery_company      TEXT
delivery_lat          NUMERIC
delivery_lng          NUMERIC

-- Timing
collection_time       TIMESTAMPTZ
delivery_time         TIMESTAMPTZ
start_time            TIMESTAMPTZ  -- When driver started
end_time              TIMESTAMPTZ  -- When delivered
estimated_pickup_time TIMESTAMPTZ
estimated_delivery_time TIMESTAMPTZ
actual_pickup_time    TIMESTAMPTZ
actual_delivery_time  TIMESTAMPTZ

-- Package Details
packages              INTEGER DEFAULT 1
weight_lbs            NUMERIC
dimensions_text       TEXT
description           TEXT
service_type          TEXT  -- 'same-day', 'next-day', 'scheduled'

-- Tracking
po_number             TEXT
inbound_tracking      TEXT
outbound_tracking     TEXT
vehicle_required      TEXT

-- Financial
miles                 NUMERIC
deadhead_miles        NUMERIC
revenue               NUMERIC
driver_pay            NUMERIC
fuel_cost             NUMERIC

-- Wait Time & Detention
wait_time_minutes     INTEGER DEFAULT 0
detention_eligible    BOOLEAN DEFAULT false
detention_billed      BOOLEAN DEFAULT false

-- Status & Notes
pod_confirmed         BOOLEAN DEFAULT false
comments              TEXT
tracking_token        TEXT UNIQUE  -- For customer tracking
company_tracking_token TEXT        -- For company-level tracking (Client Portal)
```

**Indexes**:
```sql
CREATE INDEX idx_loads_date ON daily_loads(load_date);
CREATE INDEX idx_loads_status ON daily_loads(status);
CREATE INDEX idx_loads_driver ON daily_loads(driver_id);
CREATE INDEX idx_loads_hub ON daily_loads(hub);
CREATE INDEX idx_loads_tracking_token ON daily_loads(tracking_token);
CREATE INDEX idx_loads_company_tracking_token ON daily_loads(company_tracking_token);
CREATE INDEX idx_loads_reference ON daily_loads(reference_number);
```

**Realtime**: Enabled (WebSocket subscriptions)

**RLS Policies**:
- `SELECT`: All authenticated users can read all loads
- `INSERT`: Authenticated users can create loads
- `UPDATE`: Authenticated users can update loads
- `DELETE`: Only owners can delete (soft delete preferred)

**Relationships**:
- `driver_id` → `drivers.id`
- `vehicle_id` → `vehicles.id`
- `dispatcher_id` → `profiles.id`

---

### `load_status_events`

**Audit trail table** — Tracks every status change for loads.

**Purpose**: Compliance, debugging, and timeline reconstruction

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
load_id         UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE
old_status      TEXT
new_status      TEXT NOT NULL
changed_by      UUID REFERENCES profiles(id)
changed_at      TIMESTAMPTZ DEFAULT now()
lat             NUMERIC  -- GPS coordinates when status changed
lng             NUMERIC
notes           TEXT
```

**Indexes**:
```sql
CREATE INDEX idx_status_events_load ON load_status_events(load_id);
CREATE INDEX idx_status_events_time ON load_status_events(changed_at);
```

**Use Cases**:
- "When did this load get picked up?"
- "Who marked this load as delivered?"
- "Show timeline of load status changes"

---

### `load_messages`

**Chat/messaging table** — Dispatcher ↔ Driver communication per load.

**Purpose**: In-app messaging for specific loads

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
load_id         UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE
sender_id       UUID NOT NULL
sender_name     TEXT NOT NULL DEFAULT ''
sender_role     TEXT NOT NULL CHECK (sender_role IN ('dispatcher', 'driver'))
message         TEXT NOT NULL
read_by         JSONB DEFAULT '[]'::jsonb  -- Array of user IDs who read message
created_at      TIMESTAMPTZ DEFAULT now()
```

**Indexes**:
```sql
CREATE INDEX idx_load_messages_load_id ON load_messages(load_id);
CREATE INDEX idx_load_messages_created_at ON load_messages(created_at);
```

**Realtime**: Enabled (live chat)

**RLS**: All authenticated users can read/write

**Functions**:
- `mark_messages_read(p_load_id, p_user_id)` - Mark all messages as read
- `get_unread_message_counts(p_user_id)` - Get unread count per load

---

## Dispatch & Logistics Tables

### `dispatch_blasts`

**BLAST dispatch system** — Broadcast loads to multiple drivers.

**Purpose**: Notify all available drivers of new load opportunities

**Columns**:
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
load_id           UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE
priority          TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
status            TEXT NOT NULL CHECK (status IN ('active', 'accepted', 'expired', 'cancelled'))
expires_at        TIMESTAMPTZ NOT NULL  -- Auto-expire after 15 minutes
created_by        UUID NOT NULL REFERENCES profiles(id)
created_at        TIMESTAMPTZ DEFAULT now()
hub_filter        TEXT  -- Target specific hub
```

**Indexes**:
```sql
CREATE INDEX idx_blasts_load ON dispatch_blasts(load_id);
CREATE INDEX idx_blasts_status ON dispatch_blasts(status);
CREATE INDEX idx_blasts_expires ON dispatch_blasts(expires_at);
```

**Realtime**: Enabled (drivers receive instant notifications)

---

### `blast_responses`

**Driver responses to BLASTs** — Track who's interested/declined.

**Purpose**: Dispatcher can see which drivers responded

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
blast_id        UUID NOT NULL REFERENCES dispatch_blasts(id) ON DELETE CASCADE
driver_id       UUID NOT NULL REFERENCES drivers(id)
status          TEXT NOT NULL CHECK (status IN ('pending', 'viewed', 'interested', 'declined', 'expired'))
viewed_at       TIMESTAMPTZ
responded_at    TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
```

**Indexes**:
```sql
CREATE INDEX idx_blast_responses_blast ON blast_responses(blast_id);
CREATE INDEX idx_blast_responses_driver ON blast_responses(driver_id);
```

**Business Rule**: "interested" means driver expressed interest, but dispatcher still manually assigns

---

### `companies`

**Customer/client companies** — Billing entities.

**Purpose**: Client management, invoicing, portal access

**Columns**:
```sql
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                    TEXT NOT NULL
address                 TEXT
phone                   TEXT
email                   TEXT
website                 TEXT
company_tracking_token  TEXT UNIQUE  -- For Client Portal access
billing_email           TEXT
payment_terms           TEXT  -- 'net-30', 'net-15', 'prepaid'
rate_card               JSONB  -- Customer-specific pricing
notes                   TEXT
active                  BOOLEAN DEFAULT true
created_at              TIMESTAMPTZ DEFAULT now()
updated_at              TIMESTAMPTZ DEFAULT now()
```

**Indexes**:
```sql
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_tracking_token ON companies(company_tracking_token);
```

**Relationships**:
- One company → Many loads (`daily_loads.client_name`)
- One company → Many contacts (`contacts.company_id`)

---

### `contacts`

**Contact persons at companies** — For communication.

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
company_id      UUID REFERENCES companies(id)
first_name      TEXT NOT NULL
last_name       TEXT NOT NULL
email           TEXT
phone           TEXT
title           TEXT
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

## Driver & Fleet Tables

### `drivers`

**Driver profiles** — Personnel information.

**Purpose**: Driver management, assignment, performance tracking

**Columns**:
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id             UUID UNIQUE REFERENCES auth.users(id)  -- For driver app login
full_name           TEXT NOT NULL
phone               TEXT NOT NULL
email               TEXT
hub                 TEXT  -- 'Miami', 'Fort Lauderdale', etc.
status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave'))
license_number      TEXT
hourly_rate         NUMERIC
device_token        TEXT  -- For push notifications (OneSignal)
notification_preference TEXT DEFAULT 'push' CHECK (notification_preference IN ('push', 'sms', 'both'))
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

**Indexes**:
```sql
CREATE INDEX idx_drivers_hub ON drivers(hub);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_user_id ON drivers(user_id);
```

**Relationship**:
- One driver → Many loads (`daily_loads.driver_id`)
- One driver → One auth user (`auth.users.id`)

---

### `driver_locations`

**GPS tracking breadcrumbs** — Real-time driver positions.

**Purpose**: Live fleet tracking, route history

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
driver_id       UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE
lat             NUMERIC NOT NULL
lng             NUMERIC NOT NULL
accuracy        NUMERIC  -- GPS accuracy in meters
heading         NUMERIC  -- Direction (0-360 degrees)
speed           NUMERIC  -- Speed in km/h
altitude        NUMERIC
battery_level   INTEGER  -- Device battery %
timestamp       TIMESTAMPTZ DEFAULT now()
```

**Indexes**:
```sql
CREATE INDEX idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_timestamp ON driver_locations(timestamp);
```

**Realtime**: Enabled (updates every 30 seconds from mobile app)

**Data Retention**: Archive locations older than 30 days (via `gps-cleanup` Edge Function)

---

### `driver_shifts`

**Time clock / shift tracking** — Driver work hours.

**Purpose**: Payroll, availability tracking, BLAST targeting

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
driver_id       UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE
shift_start     TIMESTAMPTZ NOT NULL
shift_end       TIMESTAMPTZ
break_start     TIMESTAMPTZ
break_end       TIMESTAMPTZ
status          TEXT NOT NULL CHECK (status IN ('on-duty', 'on-break', 'off-duty'))
total_hours     NUMERIC GENERATED ALWAYS AS (
                  EXTRACT(EPOCH FROM (shift_end - shift_start)) / 3600
                ) STORED
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

**Indexes**:
```sql
CREATE INDEX idx_driver_shifts_driver ON driver_shifts(driver_id);
CREATE INDEX idx_driver_shifts_start ON driver_shifts(shift_start);
CREATE INDEX idx_driver_shifts_status ON driver_shifts(status);
```

**Business Logic**:
- Only drivers with `status='on-duty'` receive BLASTs
- Used for payroll calculations

---

### `vehicles`

**Fleet vehicles** — Trucks, vans, etc.

**Columns**:
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                TEXT NOT NULL  -- 'Truck 1', 'Van A', etc.
type                TEXT  -- 'box-truck', 'van', 'sprinter', 'pickup'
plate_number        TEXT UNIQUE
vin                 TEXT UNIQUE
status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired'))
hub                 TEXT
year                INTEGER
make                TEXT
model               TEXT
current_mileage     INTEGER
last_service_date   DATE
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

**Relationship**:
- One vehicle → Many loads (`daily_loads.vehicle_id`)

---

## CRM Tables

### `leads`

**Sales leads** — Prospective customers.

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
company_name    TEXT
contact_name    TEXT NOT NULL
email           TEXT
phone           TEXT
status          TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'))
source          TEXT  -- 'website', 'referral', 'cold-call', etc.
score           INTEGER  -- AI-generated lead score (0-100)
assigned_to     UUID REFERENCES profiles(id)
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

### `deals`

**Sales pipeline** — Active deal tracking.

**Columns**:
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
lead_id             UUID REFERENCES leads(id)
account_id          UUID REFERENCES companies(id)
deal_name           TEXT NOT NULL
deal_value          NUMERIC
probability         INTEGER  -- 0-100%
stage               TEXT NOT NULL CHECK (stage IN ('prospect', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'))
expected_close_date DATE
actual_close_date   DATE
close_reason        TEXT  -- Win/loss reason
assigned_to         UUID REFERENCES profiles(id)
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

---

### `tasks`

**Task management** — To-dos linked to entities.

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
title           TEXT NOT NULL
description     TEXT
due_date        DATE
priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed'))
assigned_to     UUID REFERENCES profiles(id)
created_by      UUID REFERENCES profiles(id)
related_to_type TEXT  -- 'load', 'lead', 'deal', 'company'
related_to_id   UUID
completed_at    TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

**Indexes**:
```sql
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
```

---

## Authentication & Users

### `auth.users`

**Supabase Auth table** — User accounts (managed by Supabase).

**Note**: This is a Supabase system table, not directly modifiable

**Key Columns**:
- `id` (UUID)
- `email` (TEXT, unique)
- `encrypted_password` (TEXT)
- `email_confirmed_at` (TIMESTAMPTZ)
- `last_sign_in_at` (TIMESTAMPTZ)
- `user_metadata` (JSONB) - Custom fields:
  - `force_password_change` (boolean)
  - `role` (text)

---

### `profiles`

**User profile extensions** — Additional user metadata.

**Purpose**: Extend auth.users with app-specific fields

**Columns**:
```sql
id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
full_name       TEXT
phone           TEXT
role            TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'dispatcher', 'driver'))
hub             TEXT
avatar_url      TEXT
active          BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

**Trigger**: Automatically creates profile row when user signs up

**RLS**: Users can read all profiles, update only their own

---

## System Tables

### `notifications`

**System notifications** — Alerts and messages.

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID NOT NULL REFERENCES profiles(id)
type            TEXT NOT NULL  -- 'blast', 'load-assigned', 'load-delivered', etc.
title           TEXT NOT NULL
message         TEXT
read            BOOLEAN DEFAULT false
action_url      TEXT
related_id      UUID
created_at      TIMESTAMPTZ DEFAULT now()
```

**Realtime**: Enabled (live notification feed)

---

### `pod_submissions`

**Proof of delivery submissions** — Photos, signatures, notes.

**Columns**:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
load_id         UUID NOT NULL REFERENCES daily_loads(id) ON DELETE CASCADE
driver_id       UUID NOT NULL REFERENCES drivers(id)
photo_urls      JSONB  -- Array of Storage URLs
signature_url   TEXT  -- Storage URL
notes           TEXT
signer_name     TEXT
signed_at       TIMESTAMPTZ
submitted_at    TIMESTAMPTZ DEFAULT now()
lat             NUMERIC
lng             NUMERIC
```

**Storage**: Files stored in Supabase Storage bucket `pod-photos`

---

## Database Functions (RPCs)

### `get_driver_positions()`

**Get latest GPS position for all drivers**

```sql
CREATE OR REPLACE FUNCTION get_driver_positions()
RETURNS TABLE(
  driver_id UUID,
  lat NUMERIC,
  lng NUMERIC,
  timestamp TIMESTAMPTZ
) AS $$
  SELECT DISTINCT ON (driver_id)
    driver_id, lat, lng, timestamp
  FROM driver_locations
  ORDER BY driver_id, timestamp DESC;
$$ LANGUAGE SQL STABLE;
```

**Use**: Fleet map (avoid loading all GPS history)

---

### `confirm_blast_assignment(p_blast_id UUID, p_driver_id UUID)`

**Assign load from BLAST response**

```sql
CREATE OR REPLACE FUNCTION confirm_blast_assignment(
  p_blast_id UUID,
  p_driver_id UUID
) RETURNS VOID AS $$
DECLARE
  v_load_id UUID;
BEGIN
  -- Get load_id from blast
  SELECT load_id INTO v_load_id
  FROM dispatch_blasts
  WHERE id = p_blast_id;

  -- Update load with driver
  UPDATE daily_loads
  SET driver_id = p_driver_id, status = 'assigned'
  WHERE id = v_load_id;

  -- Mark blast as accepted
  UPDATE dispatch_blasts
  SET status = 'accepted'
  WHERE id = p_blast_id;

  -- Mark response as accepted
  UPDATE blast_responses
  SET status = 'interested'
  WHERE blast_id = p_blast_id AND driver_id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### `calculate_driver_score(p_driver_id UUID)`

**Calculate driver performance score**

**Business Logic**: See `src/test/driver-scoring.test.ts`

---

### `has_role(p_user_id UUID, p_role TEXT)`

**Check if user has specific role**

```sql
CREATE OR REPLACE FUNCTION has_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND role = p_role
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

**Use**: RLS policies

---

### `set_user_metadata(p_user_id UUID, p_metadata JSONB)`

**Update user metadata (Supabase Auth)**

**Security**: DEFINER (runs with elevated privileges)

---

### `mark_messages_read(p_load_id UUID, p_user_id UUID)`

**Mark all messages for a load as read**

---

### `get_unread_message_counts(p_user_id UUID)`

**Get unread message count per load**

---

## Row Level Security (RLS)

### Policy Structure

All user-facing tables have RLS enabled with standard patterns:

**SELECT Policies** (Read):
```sql
CREATE POLICY {table}_select ON {table}
  FOR SELECT TO authenticated
  USING (true);  -- All authenticated users can read
```

**INSERT Policies** (Create):
```sql
CREATE POLICY {table}_insert ON {table}
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- All authenticated users can create
```

**UPDATE Policies** (Edit):
```sql
CREATE POLICY {table}_update ON {table}
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
```

**DELETE Policies** (Delete):
```sql
CREATE POLICY {table}_delete ON {table}
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));  -- Only admins
```

### Security Fix (CHUNK7)

Migration `_CHUNK7_RLS_SECURITY_FIX.sql` tightened RLS policies:
- Added role-based DELETE restrictions
- Fixed user-scoped policies
- Enforced hub-level data isolation (optional)

---

## Indexes & Performance

### Critical Indexes

**Loads**:
- `idx_loads_date` - Filter by date (most common query)
- `idx_loads_status` - Filter by status
- `idx_loads_driver` - Join to drivers
- `idx_loads_tracking_token` - Public tracking lookups

**GPS Tracking**:
- `idx_driver_locations_driver` - Per-driver queries
- `idx_driver_locations_timestamp` - Chronological queries

**Dispatch**:
- `idx_blasts_load` - BLAST → Load relationship
- `idx_blasts_status` - Active BLAST queries

### Performance Tips

1. **Use indexes for filters**: Always include indexed columns in WHERE clauses
2. **Limit GPS queries**: Use `get_driver_positions()` instead of full `driver_locations` scan
3. **Realtime subscriptions**: Filter by specific columns to reduce payload
4. **Pagination**: Use `LIMIT` and `OFFSET` for large result sets

---

## Migration History

### Migration Files

**Location**: `supabase/migrations/`

**Naming Convention**:
- `_CHUNK{N}.sql` - Major schema changes (applied in chunks)
- `{timestamp}_{description}.sql` - Supabase auto-generated
- `00{N}_{description}.sql` - Manual numbered migrations

### Key Migrations

| File | Purpose | Date |
|------|---------|------|
| `_CHUNK1.sql` | RLS policies, POD schema, load messages | 2026-02-24 |
| `_CHUNK2.sql` | Core tables (loads, drivers, vehicles) | 2026-02-11 |
| `_CHUNK3.sql` | BLAST dispatch system | 2026-02-13 |
| `_CHUNK4_HOTFIX.sql` | Production bug fixes | 2026-02-14 |
| `_CHUNK5_FLEET_RPCS.sql` | Fleet management functions | 2026-02-15 |
| `_CHUNK6_TIMECLOCK_AND_RPCS.sql` | Time clock system | 2026-02-19 |
| `_CHUNK7_RLS_SECURITY_FIX.sql` | Security tightening | 2026-02-28 |
| `005_driver_gps_tracking.sql` | GPS tracking tables | 2026-02-11 |
| `006_customer_tracking.sql` | Customer tracking tokens | 2026-02-11 |
| `20260219_time_clock.sql` | Time clock enhancements | 2026-02-19 |

### Applying Migrations

```bash
# Apply all pending migrations
npx supabase db push

# Create new migration
npx supabase migration new your_migration_name

# Reset database (DANGER - dev only)
npx supabase db reset
```

---

## ER Diagram

### Core Relationships

```
auth.users (1) ──┬── (1) profiles
                 │
                 └── (1) drivers
                       │
                       ├── (*) driver_locations
                       ├── (*) driver_shifts
                       └── (*) daily_loads (driver_id)

companies (1) ──┬── (*) contacts
                │
                └── (*) daily_loads (client_name)

daily_loads (1) ──┬── (*) load_status_events
                  ├── (*) load_messages
                  ├── (*) pod_submissions
                  ├── (1) dispatch_blasts
                  ├── (0..1) drivers
                  └── (0..1) vehicles

dispatch_blasts (1) ─── (*) blast_responses
                              │
                              └── (1) drivers

leads (1) ──┬── (*) deals
            └── (*) tasks (related_to)

profiles (1) ──┬── (*) tasks (assigned_to)
               ├── (*) deals (assigned_to)
               ├── (*) leads (assigned_to)
               └── (*) notifications
```

### Visual ER Diagram

```
┌─────────────┐
│ auth.users  │
└──────┬──────┘
       │ 1:1
       ▼
┌─────────────┐       ┌──────────────┐
│  profiles   │       │   drivers    │◀─┐
└──────┬──────┘       └──────┬───────┘  │ 1:*
       │                     │          │
       │ 1:*            1:*  │          │
       ▼                     ▼          │
┌─────────────┐       ┌──────────────┐ │
│    tasks    │       │ daily_loads  │─┘
└─────────────┘       └──────┬───────┘
                             │ 1:*
                             ▼
                      ┌──────────────────┐
                      │ load_status_     │
                      │    events        │
                      └──────────────────┘
```

---

## Database Backup & Recovery

### Automated Backups

**Supabase manages backups automatically**:
- Daily backups (retained 7 days)
- Point-in-time recovery (PITR) enabled
- Geographic redundancy

### Manual Backup

```bash
# Export full database dump
pg_dump $DATABASE_URL > backup.sql

# Restore from backup
psql $DATABASE_URL < backup.sql
```

---

## Database Monitoring

### Query Performance

**Slow queries** tracked via `pg_stat_statements`:

```sql
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Known Issues & Limitations

### 1. TypeScript Mapping
- **Issue**: Some JSONB columns don't have TypeScript types
- **Fix**: Phase 2 - Add Zod schemas for all JSONB fields

### 2. Soft Delete
- **Issue**: Hard deletes used (no soft delete pattern)
- **Fix**: Add `deleted_at` column to critical tables

### 3. Audit Trail
- **Issue**: Limited user action logging
- **Fix**: Add `audit_log` table for all CRUD operations

### 4. Data Retention
- **Issue**: GPS data grows unbounded
- **Fix**: ✅ Implemented via `gps-cleanup` Edge Function (archive >30 days)

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Edge Functions using this schema
- **[FEATURES.md](./FEATURES.md)** - Features using this data model
- **[gemini.md](./gemini.md)** - Schema design decisions

---

**Last Updated**: March 13, 2026
**Schema Version**: 65 migrations
**Status**: Production-Ready ✅
