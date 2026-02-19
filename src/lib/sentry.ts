/**
 * sentry.ts — Anika Dispatcher: Scoped error capture helpers
 *
 * Usage:
 *   import { captureLoadError, captureBillingError, captureQBError } from '@/lib/sentry';
 *
 * Each helper attaches a feature tag + relevant context so Sentry issues are
 * automatically bucketed by domain (loads / billing / quickbooks) and
 * actionable without digging through raw stack traces.
 */

import * as Sentry from "@sentry/react";

// ─── Loads ────────────────────────────────────────────────────────────────────

/**
 * Capture an error that occurred while processing a load / shipment.
 *
 * @param loadId   The internal load/shipment ID
 * @param error    The caught error (any type)
 * @param context  Optional additional context fields (driver, route, etc.)
 */
export function captureLoadError(
  loadId: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "loads");
    scope.setContext("load", { loadId, ...context });
    Sentry.captureException(error);
  });
}

// ─── Billing ──────────────────────────────────────────────────────────────────

/**
 * Capture a billing / invoice error.
 *
 * @param invoiceId  The invoice ID that caused the error
 * @param error      The caught error
 */
export function captureBillingError(invoiceId: string, error: unknown): void {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "billing");
    scope.setContext("invoice", { invoiceId });
    Sentry.captureException(error);
  });
}

// ─── QuickBooks ───────────────────────────────────────────────────────────────

/**
 * Capture a QuickBooks API / OAuth error.
 *
 * @param operation  Human-readable operation name (e.g. "token-exchange", "create-invoice")
 * @param error      The caught error
 */
export function captureQBError(operation: string, error: unknown): void {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "quickbooks");
    scope.setContext("qb_operation", { operation });
    Sentry.captureException(error);
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Capture an authentication error (login, session refresh, etc.).
 *
 * @param action  What auth action was being attempted
 * @param error   The caught error
 */
export function captureAuthError(action: string, error: unknown): void {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "auth");
    scope.setContext("auth_action", { action });
    Sentry.captureException(error);
  });
}

// ─── Driver / Fleet ───────────────────────────────────────────────────────────

/**
 * Capture an error related to fleet tracking or driver operations.
 *
 * @param driverId  Driver ID (if known)
 * @param error     The caught error
 * @param context   Optional additional context
 */
export function captureFleetError(
  driverId: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "fleet");
    scope.setContext("fleet", { driverId, ...context });
    Sentry.captureException(error);
  });
}

// ─── Generic scoped capture ───────────────────────────────────────────────────

/**
 * Generic scoped error capture for features not covered by the helpers above.
 *
 * @param feature  Feature name (used as Sentry tag)
 * @param context  Key/value context to attach
 * @param error    The caught error
 */
export function captureScopedError(
  feature: string,
  context: Record<string, unknown>,
  error: unknown
): void {
  Sentry.withScope((scope) => {
    scope.setTag("feature", feature);
    scope.setContext(feature, context);
    Sentry.captureException(error);
  });
}

// ─── Performance helpers ──────────────────────────────────────────────────────

/**
 * Wrap an async operation in a Sentry performance span.
 * Returns the result of the callback.
 *
 * @example
 *   const result = await withSpan('billing.createInvoice', { invoiceId }, () => createInvoice(data));
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      attributes,
    },
    fn
  );
}
