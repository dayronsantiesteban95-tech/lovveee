import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

// Noise patterns to filter from Sentry
const IGNORED_ERRORS: RegExp[] = [
  /Loading chunk \d+ failed/i,
  /Loading CSS chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /NetworkError when attempting to fetch resource/i,
  /The operation was aborted/i,
  /Load failed/i,
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i,
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
  ],

  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,

  initialScope: {
    tags: {
      app: "dispatcher",
      company: "anika-logistics",
    },
  },

  beforeSend(event, hint) {
    const error = hint?.originalException;

    if (error instanceof Error) {
      for (const pattern of IGNORED_ERRORS) {
        if (pattern.test(error.message)) {
          return null;
        }
      }
    }

    if (typeof error === "string") {
      for (const pattern of IGNORED_ERRORS) {
        if (pattern.test(error)) {
          return null;
        }
      }
    }

    const frames = event.exception?.values?.[0]?.stacktrace?.frames;
    if (frames && frames.length === 0) {
      return null;
    }

    return event;
  },

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
        Something went wrong
      </h2>
      <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
        The app encountered an error. Check the browser console (F12) for details.
      </p>
      <p style={{ color: "#64748b", fontSize: "0.75rem" }}>
        Error ID has been reported to our team.
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
        Reload Page
      </button>
    </div>
  );
}

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </Sentry.ErrorBoundary>
);
