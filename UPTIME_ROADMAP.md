# 99.99% Uptime Roadmap — Anika Control OS (Dispatcher)

> **Target:** 99.99% availability = max **52.6 minutes** of downtime per year  
> **Stack:** React + Vite + TypeScript → Vercel | Supabase (PostgreSQL + Auth + Storage)  
> **Production:** https://dispatch.anikalogistics.com

---

## Current State Assessment

### Infrastructure SLAs

| Layer | Plan | SLA | Max Downtime/Year |
|---|---|---|---|
| **Vercel** (hosting/CDN) | Pro | **99.99%** (Enterprise contract) / ~99.9% practical on Pro | ~52 min (contract) / ~8.7 hrs (practical) |
| **Supabase** (DB/Auth) | Pro | **No formal SLA** — SLA only on Enterprise plan | Unknown — target ~99.9% |
| **App code** (our layer) | — | Unmeasured | Unknown |
| **Composite (all layers)** | — | ~99.8% estimated | ~17.5 hrs/year |

### Current Estimated Uptime: **~99.8%**
### Gap to Close: **~17 hours/year → target 52 minutes/year**

> **Key insight:** Vercel alone gives 99.99% on Enterprise. On Pro, the CDN layer is reliable
> but no contractual SLA. Supabase Pro has **zero SLA** — this is the biggest risk to 99.99%.
> Achieving 99.99% composite requires either Supabase Enterprise **or** adding our own
> resilience layer around Supabase calls.

---

## Risk Register

| # | Risk | Severity | Current Mitigation |
|---|---|---|---|
| R1 | Supabase outage (no Pro SLA) | 🔴 Critical | None |
| R2 | Supabase cold start / connection pool exhaustion | 🔴 Critical | None |
| R3 | JS chunk load failures on deploy | 🟠 High | ErrorBoundary exists |
| R4 | No uptime monitoring → blind to outages | 🟠 High | None |
| R5 | No DB retry logic → single failure = user-facing error | 🟠 High | None — fixed in this PR |
| R6 | No circuit breaker → cascade failures | 🟡 Medium | None |
| R7 | Vercel deployment failure takes down prod | 🟡 Medium | No rollback automation |
| R8 | QuickBooks API outage (billing blocked) | 🟡 Medium | Error captured in Sentry |
| R9 | No health check endpoint | 🟡 Medium | None |
| R10 | CSP blocks Sentry ingest | 🟢 Low | CSP allows sentry.io? (verify) |

---

## 99.99% Uptime Roadmap

---

### ✅ Done (This PR — Feb 2026)

- [x] **Sentry production-grade config** — noise filtering, sampling tuned, profiling added
- [x] **Custom error helpers** — `captureLoadError`, `captureBillingError`, `captureQBError`, `captureAuthError`, `captureFleetError`, `withSpan`
- [x] **Route-level error boundaries** — dispatch, fleet, billing isolated; crash in one doesn't kill others
- [x] **QueryClient retry logic** — 3 retries with exponential back-off (1s → 2s → 4s, max 30s)
- [x] **Sentry `tracePropagationTargets`** — Supabase + production domain properly instrumented
- [x] **`beforeSend` noise filter** — chunk errors, network aborts, ResizeObserver dropped

---

### 🚨 Week 1 — Critical (Monitoring Blind Spot)

**Goal:** Know when we're down before users do.

- [ ] **Add uptime monitoring** (R4 → RESOLVED)
  - **Recommended: [Better Stack / Better Uptime](https://betterstack.com/uptime)** — free tier, 3-min checks, multi-location, Slack/SMS alerts
  - Alternative: UptimeRobot (free, 5-min checks)
  - Monitor: `https://dispatch.anikalogistics.com` + `https://dispatch.anikalogistics.com/auth` (login page)
  - Alert: Slack DM + SMS within 2 minutes of downtime

- [ ] **Configure Sentry alerts** (R4 partial)
  - Alert rule: Error rate > 5 errors/minute → page immediately
  - Alert rule: `feature:billing` errors → page immediately (revenue impact)
  - Alert rule: `feature:auth` errors → page immediately (access impact)
  - Alert rule: New issue spike (>10x baseline) → Slack channel

- [ ] **Verify CSP allows Sentry ingest** (R10)
  - Current CSP `connect-src` does NOT include `*.sentry.io` or `*.ingest.sentry.io`
  - **Fix:** Add to `vercel.json` CSP `connect-src`:
    ```
    https://*.sentry.io https://o*.ingest.sentry.io
    ```

- [ ] **Create a `/health` endpoint or canary check**
  - Since this is a pure SPA (no server), create a `public/health.json` with `{ "status": "ok", "version": "x.x.x" }`
  - Monitor this URL — if it 404s, Vercel deploy is broken
  - Uptime robot can check JSON content

---

### 🟠 Week 2–4 — High Priority (Reliability Fundamentals)

**Goal:** Eliminate silent failures and single-retry patterns.

- [ ] **Supabase retry wrapper** (R5 → RESOLVED)
  ```typescript
  // src/lib/supabase-retry.ts
  export async function withSupabaseRetry<T>(
    fn: () => Promise<{ data: T | null; error: unknown }>,
    maxRetries = 3
  ): Promise<{ data: T | null; error: unknown }> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await fn();
      if (!result.error) return result;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
    return fn(); // final attempt, let caller handle error
  }
  ```
  Apply to: auth calls, load mutations, billing mutations (highest impact first)

- [ ] **Supabase connection health check on app init**
  - Ping Supabase on app load; if unreachable, show maintenance banner instead of cryptic errors
  - Clears automatically when connection restores (poll every 30s)

- [ ] **Vercel deployment rollback automation** (R7)
  - Add `vercel.json` `"github": { "autoJobCancelation": false }` to prevent in-flight cancellations
  - Document manual rollback procedure: `vercel rollback [deployment-url]`
  - Consider: GitHub Actions health check after deploy — auto-rollback if health.json 404s

- [ ] **Error rate dashboards**
  - Sentry Performance dashboard: P95 page load, P95 DB query latency
  - Track: auth success rate, load creation success rate, billing success rate

- [ ] **Add `sentry-source-map-upload` to build** (if not configured)
  - Check `vite.config.ts` for `@sentry/vite-plugin` — source maps must be uploaded for readable stack traces
  - Without this, Sentry errors show minified code, making debugging 10x harder

---

### 🟡 Month 2–3 — Medium Priority (Resilience Patterns)

**Goal:** Graceful degradation; the app survives partial infrastructure failure.

- [ ] **Circuit breaker for Supabase** (R6)
  - Use [opossum](https://nodeshift.dev/opossum/) or a simple custom circuit breaker
  - Pattern: After 5 consecutive failures in 60s, open circuit → show "temporarily unavailable" banner instead of hammering a dead DB
  - Auto-close circuit after 30s timeout

- [ ] **Optimistic UI for critical paths**
  - Dispatch: Load status updates should be optimistic (update UI immediately, sync to DB async)
  - Reduces perceived downtime even during brief Supabase hiccups

- [ ] **Supabase upgrade to Enterprise (or plan for it)** (R1)
  - Supabase Pro has no SLA. Enterprise gives contractual 99.9% SLA per project
  - Until then: accept risk or add a Supabase backup/read-replica strategy
  - **Cost vs. risk:** Calculate monthly revenue × 0.1% downtime = cost of outages vs. Enterprise pricing

- [ ] **Real User Monitoring (RUM) baseline**
  - Sentry is now tracking transactions at 10% sample rate
  - After 30 days: export P95 latency baselines for auth, dispatch page, billing
  - Set alert thresholds at 2× baseline

- [ ] **Implement stale-while-revalidate for read-heavy pages**
  - Dashboard, fleet tracker: serve cached data while re-fetching
  - React Query `staleTime: 60_000` is set — tune per page based on RUM data

---

### 🟢 Long-Term — 99.99% Full Compliance

**Goal:** Close the final gap. Requires infrastructure investments.

- [ ] **Supabase Enterprise or self-hosted Postgres replica**
  - True 99.99% composite requires both Vercel Enterprise (already 99.99%) + Supabase Enterprise (99.9% SLA)
  - Math: 99.99% × 99.9% = 99.89% composite — still not 99.99%
  - To hit 99.99% composite: need Supabase at 99.99% + failover, OR build read replica with auto-failover

- [ ] **Multi-region failover strategy** (long-term)
  - Vercel deploys to edge globally — CDN layer is inherently multi-region
  - Supabase: consider read replicas in multiple regions (Supabase supports this on Enterprise)
  - Auth: Supabase GoTrue is the single point of failure for login — no easy workaround without Enterprise

- [ ] **Automated chaos testing**
  - Monthly: simulate Supabase outage (kill DB connection) — verify circuit breaker + maintenance banner trigger correctly
  - Quarterly: test Vercel rollback procedure under pressure

- [ ] **Incident response runbook**
  - Document: who gets paged, what they check first, how to manually roll back Vercel, how to switch Supabase to read-only mode
  - Store runbook in `docs/INCIDENT_RUNBOOK.md`
  - Practice quarterly

- [ ] **Status page for customers** (optional but professional)
  - Use [Statuspage.io](https://www.atlassian.com/software/statuspage) (free tier) or Better Stack's included status page
  - Public URL: `status.anikalogistics.com`
  - Reduces support tickets during incidents

---

## Uptime Math Summary

```
Current (estimated):  99.80%  =  ~17.5 hours downtime/year
After Week 1-4:       99.95%  =  ~4.4 hours downtime/year  (monitoring + retry)
After Month 2-3:      99.98%  =  ~1.7 hours downtime/year  (circuit breaker + resilience)
After Long-term:      99.99%  =  ~52 minutes/year          (Enterprise SLAs + failover)
```

---

## Quick Wins Checklist (Do This Week)

```bash
# 1. Fix CSP in vercel.json — add Sentry ingest domains
# 2. Sign up for Better Stack free tier → https://betterstack.com/uptime
#    Monitor: https://dispatch.anikalogistics.com
#    Alert: SMS + Slack, threshold: 2 minutes
# 3. Configure Sentry alerts:
#    - Error spike: >5 errors/min → immediate alert
#    - Billing feature tag: any new issue → immediate alert
# 4. Create public/health.json: { "status": "ok" }
# 5. Add *.sentry.io to CSP connect-src
```

---

*Generated by Anika Control OS DevOps subagent — Feb 19, 2026*
