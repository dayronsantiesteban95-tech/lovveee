import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

// ─── Noise patterns to filter from Sentry ───────────────────────────────────
const IGNORED_ERRORS: RegExp[] = [
  // Vite / webpack lazy-chunk load failures — not actionable, user just needs to refresh
  /Loading chunk \d+ failed/i,
  /Loading CSS chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  // Generic network errors that aren't app bugs
  /NetworkError when attempting to fetch resource/i,
  /The operation was aborted/i,
  /Load failed/i,
  // Browser extension noise
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  // Safari-specific non-errors
  /Non-Error promise rejection captured with value: undefined/i,
];

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.httpClientIntegration(),
    Sentry.browserProfilingIntegration(),
  ],

  // ── Sampling — keep billing low, signal high ──────────────────────────────
  tracesSampleRate: 0.1,           // 10% of transactions traced
  profilesSampleRate: 0.1,         // 10% of traced transactions profiled
  replaysSessionSampleRate: 0.05,  // 5% of sessions recorded (was 10%)
  replaysOnErrorSampleRate: 1.0,   // 100% on error — always capture crashes

  // ── Environment & release ─────────────────────────────────────────────────
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,

  // ── Global tags applied to every event ───────────────────────────────────
  initialScope: {
    tags: {
      app: "dispatcher",
      company: "anika-logistics",
    },
  },

  // ── Noise filter ─────────────────────────────────────────────────────────
  beforeSend(event, hint) {
    const error = hint?.originalException;

    // Filter by error message regex
    if (error instanceof Error) {
      for (const pattern of IGNORED_ERRORS) {
        if (pattern.test(error.message)) {
          return null; // Drop the event
        }
      }
    }

    // Filter string rejections that match noise patterns
    if (typeof error === "string") {
      for (const pattern of IGNORED_ERRORS) {
        if (pattern.test(error)) {
          return null;
        }
      }
    }

    // Drop events with no useful stack (browser extension garbage, etc.)
    const frames = event.exception?.values?.[0]?.stacktrace?.frames;
    if (frames && frames.length === 0) {
      return null;
    }

    return event;
  },

  // ── Trace propagation ─────────────────────────────────────────────────────
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/dispatch\.anikalogistics\.com/,
    /^https:\/\/[a-z]+\.supabase\.co/,
  ],
});

function ErrorFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "16px",
        background: "#0a0f1c",
        color: "#f1f5f9",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f87171" }}>
        ⚠️ Something went wrong
      </h2>
      <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
        Our team has been notified. Please refresh the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: "0.5rem 1.5rem",
          background: "#f97316",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Refresh
      </button>
    </div>
  );
}

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </Sentry.ErrorBoundary>
);
