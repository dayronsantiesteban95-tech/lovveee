# Anika Control OS — Logistics Command Platform

**Production URL**: https://dispatch.anikalogistics.com
**Status**: ✅ Live & Production-Ready
**Stack**: React 18 + TypeScript + Vite + Supabase + shadcn/ui
**Last Updated**: March 2026

---

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Key Features](#key-features)
- [Documentation Index](#documentation-index)
- [Support](#support)

---

## Overview

Anika Control OS is a **premium logistics dispatch platform** built to replace OnTime 360 with real-time operational visibility, intelligent route optimization, and sub-2-minute dispatching. It provides:

- **Real-time GPS tracking** with Google Maps integration
- **BLAST dispatch system** for instant driver notifications
- **Proof of Delivery** management with photo capture
- **QuickBooks integration** for automated invoicing
- **Revenue analytics** and driver performance tracking
- **Time clock** and team management
- **Multi-platform**: Web (dispatchers) + Mobile (drivers via Expo)

### Project Philosophy

> "High-performance logistics command platform"
> Identity: Tesla + Uber + Palantir for courier operations

Design inspiration: **Linear.app** (clean, fast), **Stripe Dashboard** (premium), **Uber Driver App** (map-centric)

---

## Quick Start

### Prerequisites

- **Node.js**: v18+ (v20 recommended)
- **npm**: v9+
- **Git**: Latest stable
- **Supabase Account**: For database access
- **Google Maps API Key**: For maps/routing

### Local Development Setup (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/dayronsantiesteban95-tech/lovveee.git
cd lovveee

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Configure environment variables
# Edit .env.local with your credentials:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_PUBLISHABLE_KEY
# - VITE_GOOGLE_MAPS_KEY
# See ENVIRONMENT.md for complete reference

# 5. Start development server
npm run dev

# Application will open at http://localhost:8080
```

### First Login

**Admin Credentials**:
- Email: Contact project owner for credentials
- Password: Contact project owner for credentials

**Supabase Console**: Contact project owner for access

---

## System Architecture

### Multi-Platform Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Anika Control OS                      │
├─────────────────────┬───────────────────┬───────────────┤
│   Web Platform      │   Mobile App      │   CRM         │
│   (Dispatchers)     │   (Drivers)       │   (Sales)     │
├─────────────────────┼───────────────────┼───────────────┤
│ React + Vite        │ React Native      │ Next.js 14    │
│ TypeScript          │ Expo              │ TypeScript    │
│ shadcn/ui           │ iOS + Android     │ Supabase      │
│ Google Maps         │ Background GPS    │ i18n          │
└─────────────────────┴───────────────────┴───────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │      Supabase Backend          │
        ├────────────────────────────────┤
        │ PostgreSQL (65 migrations)     │
        │ Realtime (WebSockets)          │
        │ Authentication                 │
        │ Edge Functions (14 functions)  │
        │ Storage (POD photos)           │
        └────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │    Third-Party Integrations    │
        ├────────────────────────────────┤
        │ • Google Maps API (routing)    │
        │ • QuickBooks (invoicing)       │
        │ • Sentry (error tracking)      │
        │ • Vercel (hosting)             │
        │ • OneSignal (push - planned)   │
        └────────────────────────────────┘
```

### Data Flow

```
Dispatcher creates load → Supabase DB → Real-time sync
                                              ↓
                            BLAST sent to available drivers
                                              ↓
                         Driver responds → Dispatcher assigns
                                              ↓
                         GPS tracking starts → Live map updates
                                              ↓
                         Driver delivers → POD uploaded → QB invoice
```

---

## Tech Stack

### Frontend (Web)
- **React** 18.3.1 - UI framework
- **TypeScript** 5.8.3 - Type safety
- **Vite** 5.4.19 - Build tool (fast!)
- **React Router** 6.30.1 - Client-side routing
- **TanStack Query** 5.62.0 - Server state management
- **shadcn/ui** - Component library (Radix UI primitives)
- **Tailwind CSS** 3.4.17 - Utility-first styling
- **Recharts** 2.15.4 - Data visualization

### Backend
- **Supabase** - Postgres + Auth + Realtime + Storage
- **Edge Functions** - Deno-based serverless (14 functions)
- **PostgreSQL** - Primary database (65 migrations deployed)

### Mobile (Driver App)
- **React Native** 0.81.5
- **Expo** SDK 54 - Cross-platform framework
- **Expo Router** - File-based routing
- **Expo Location** - Background GPS tracking
- **Expo Notifications** - Push notifications

### DevOps & Monitoring
- **Vercel** - Hosting (auto-deploy from master)
- **Sentry** - Error tracking & performance monitoring
- **Vitest** - Unit testing (7 test files)
- **ESLint** - Code linting
- **TypeScript** - Static analysis

### Key Libraries
- `@react-google-maps/api` - Google Maps integration
- `jspdf` + `jspdf-autotable` - PDF generation
- `date-fns` - Date manipulation
- `zod` - Runtime validation
- `@sentry/react` - Error boundaries

---

## Project Structure

```
lovveee/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui primitives
│   │   ├── AppLayout.tsx   # Main app shell
│   │   ├── CommandBar.tsx  # Command palette
│   │   └── ...
│   ├── pages/              # Route components (30+ pages)
│   │   ├── Auth.tsx
│   │   ├── Dashboard.tsx
│   │   ├── CommandCenter.tsx
│   │   ├── dispatch/       # Dispatch subsystem
│   │   │   ├── LoadBoard.tsx
│   │   │   └── NewLoadForm.tsx
│   │   ├── legal/          # Terms/Privacy
│   │   └── ...
│   ├── hooks/              # Custom React hooks (15+)
│   │   ├── useAuth.ts
│   │   ├── useDispatchBlast.ts
│   │   ├── useDriverGPS.ts
│   │   └── ...
│   ├── lib/                # Utility libraries
│   │   ├── supabase.ts     # Supabase client
│   │   ├── constants.ts    # App constants
│   │   ├── rateCalculator.ts
│   │   ├── quickbooks.ts   # QB OAuth
│   │   └── ...
│   ├── test/               # Unit tests (7 files)
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
├── supabase/
│   ├── migrations/         # Database migrations (65 files)
│   └── functions/          # Edge Functions (14 functions)
│       ├── ai-chat/
│       ├── qb-token-refresh/
│       ├── send-push-notification/
│       └── ...
├── public/                 # Static assets
├── docs/                   # Documentation (YOU ARE HERE)
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API_REFERENCE.md
│   ├── ENVIRONMENT.md
│   └── ...
├── gemini.md               # Project constitution
├── findings.md             # Research & discoveries
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example            # Environment template
```

---

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server (localhost:8080)
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm run test             # Run unit tests
npm run test:watch       # Watch mode testing

# Type checking
npx tsc --noEmit         # Check TypeScript errors

# Utility
npm run check:encoding   # Verify file encoding
```

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes with hot reload**
   ```bash
   npm run dev
   ```

3. **Run tests**
   ```bash
   npm run test
   ```

4. **Type check**
   ```bash
   npx tsc --noEmit
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature-name
   ```

6. **Vercel auto-deploys** on merge to `master`

### Code Standards

- **TypeScript**: Prefer explicit types over `any`
- **Components**: Functional components with hooks
- **Styling**: Tailwind utility classes (avoid custom CSS)
- **Imports**: Use path alias `@/` for src imports
- **Error Handling**: Use Sentry error boundaries
- **Testing**: Unit test business logic and utilities

---

## Testing

### Test Coverage

- **7 test files** in `src/test/`
- **Focus areas**: Business logic, utilities, calculations
- **Framework**: Vitest + @testing-library/react

### Test Files

1. `dispatch-operations.test.ts` - BLAST dispatch logic
2. `driver-scoring.test.ts` - Driver performance calculations
3. `rate-calculator.test.ts` - Pricing engine
4. `status-transitions.test.ts` - Load status state machine
5. `tracking-token.test.ts` - Customer tracking tokens
6. `formatters.test.ts` - Data formatting utilities
7. `example.test.ts` - Test setup example

### Running Tests

```bash
# Run all tests
npm run test

# Watch mode (re-run on changes)
npm run test:watch

# Coverage report
npm run test -- --coverage
```

---

## Deployment

### Production Environment

- **Platform**: Vercel
- **URL**: https://dispatch.anikalogistics.com
- **Custom Domain**: Configured via Vercel
- **Auto-Deploy**: Enabled on `master` branch
- **Build Command**: `npm run build`
- **Output Directory**: `dist/`

### Deployment Process

1. **Merge to master** → Vercel auto-deploys
2. **Build time**: ~2-3 minutes
3. **Health Check**: Automated via Jarvis monitoring
4. **Rollback**: Via Vercel dashboard (instant)

### Environment Variables (Production)

All production secrets set via Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_GOOGLE_MAPS_KEY`
- `VITE_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `VITE_QB_CLIENT_ID`

**See**: [ENVIRONMENT.md](./ENVIRONMENT.md) for complete reference

### Supabase Deployment

Database migrations applied via Supabase CLI:

```bash
# Apply pending migrations
npx supabase db push

# Create new migration
npx supabase migration new your_migration_name
```

---

## Key Features

### Core Modules (30+)

1. **Command Center** (`/command-center`) - Main operations dashboard
2. **Dispatch Tracker** (`/dispatch`) - Real-time load management
3. **Fleet Tracker** (`/fleet`) - Live GPS tracking with Google Maps
4. **Driver Portal** (`/driver`) - Driver-facing interface
5. **BLAST Dispatch** - Broadcast loads to available drivers
6. **POD Manager** (`/pod-manager`) - Proof of delivery photos
7. **Time Clock** (`/time-clock`) - Driver time tracking
8. **Team Management** (`/team`) - User & role administration
9. **Revenue Analytics** (`/revenue`) - Financial reporting
10. **Billing** (`/billing`) - Invoice management + QuickBooks sync
11. **Rate Calculator** (`/rate-calculator`) - Pricing engine
12. **Calendar** (`/calendar`) - Schedule management
13. **Task Board** (`/tasks`) - Task management
14. **Client Portal** (`/portal/:token`) - Customer tracking
15. **Track Delivery** (`/track/:token`) - Public tracking page
16. **SOP Wiki** (`/sop-wiki`) - Standard operating procedures
17. **Driver Performance** (`/performance`) - Driver scorecards
18. **PDF Combiner** (`/pdf-combiner`) - Batch document processing

### BLAST Dispatch System

**What is BLAST?**
Broadcast Available Load to Simultaneous Targets - instantly notify all available drivers of a new load opportunity.

**How it works**:
1. Dispatcher creates load
2. Clicks "BLAST" → sends to all on-duty drivers
3. Drivers respond: interested / declined
4. Dispatcher reviews responses
5. Dispatcher assigns load to chosen driver

**Key Rule**: Dispatcher controls all assignments (not auto-assign)

### Real-time Features

- **Live GPS tracking** (updates every 30 seconds)
- **WebSocket subscriptions** for instant updates
- **Optimistic UI updates** (feels instant)
- **Auto-refresh** on new load/driver events
- **Push notifications** (planned via OneSignal)

---

## Documentation Index

### Essential Reading

1. **[gemini.md](./gemini.md)** - Project constitution (LAW)
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture deep-dive
3. **[DATABASE.md](./DATABASE.md)** - Database schema & migrations
4. **[API_REFERENCE.md](./API_REFERENCE.md)** - Edge Functions reference
5. **[ENVIRONMENT.md](./ENVIRONMENT.md)** - Environment variables guide

### Additional Docs

6. **[FEATURES.md](./FEATURES.md)** - Complete feature inventory
7. **[INTEGRATIONS.md](./INTEGRATIONS.md)** - Third-party integrations
8. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment procedures
9. **[KNOWN_ISSUES.md](./KNOWN_ISSUES.md)** - Known issues & workarounds
10. **[findings.md](./findings.md)** - Research & discoveries

### Handoff Documents

11. **[HANDOFF_CHECKLIST.md](./HANDOFF_CHECKLIST.md)** - Developer handoff checklist
12. **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Code contribution guide (Phase 2)

---

## Support

### Health Monitoring

Automated health checks run every 4 hours:
- ✅ Production URL: https://dispatch.anikalogistics.com
- ✅ Supabase connectivity
- ✅ TypeScript compilation (0 errors)
- ✅ Git repository status

Last health check: **2026-03-08 12:00 AM** - All systems operational

### Getting Help

1. **Check [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)** first
2. **Review [gemini.md](./gemini.md)** for architecture decisions
3. **Check Sentry** for production errors: https://sentry.io/organizations/anika-qi
4. **Supabase logs** for database issues
5. **Vercel logs** for deployment issues

### Key Contacts

- **Project Owner**: Contact repository owner for access
- **Supabase Project**: Contact project owner for credentials
- **Vercel Project**: lovveee.vercel.app
- **Sentry Organization**: anika-qi

---

## Related Projects

### Anika CRM
- **URL**: https://anika-crm.vercel.app
- **Repo**: https://github.com/dayronsantiesteban95-tech/anika-crm.git
- **Local**: `C:\Users\Ilove\CRM\`
- **Tech**: Next.js 14 + Supabase
- **Status**: 335 passing tests, 0 TS errors

### Anika Driver App
- **Platform**: iOS + Android
- **Local**: `C:\Users\Ilove\.openclaw\workspace\anika-driver-app\`
- **Tech**: React Native (Expo SDK 54)
- **Status**: Build-ready (see BUILDME.md)

---

## License

Proprietary - Anika Logistics © 2026

---

## Version History

- **v1.0.0** (Feb 2026) - Initial production release
- **Feb 18, 2026** - LoadDetailPanel optimization (632KB → 17KB)
- **Feb 19, 2026** - QuickBooks OAuth integration
- **Mar 7, 2026** - Client Portal feature launch
- **Mar 8, 2026** - Latest production deployment (feat: Client Portal)

---

**Last Updated**: March 13, 2026
**Status**: Production-Ready ✅
**Next Phase**: Phase 2 - Code Organization & Cleanup
