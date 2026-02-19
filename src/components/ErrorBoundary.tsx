import React from "react";
import * as Sentry from "@sentry/react";

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        Sentry.captureException(error, { extra: { errorInfo } });
    }

    render() {
        if (this.state.hasError) {
            const isDev = import.meta.env.DEV;
            return (
                <div style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0a0f1c",
                    color: "#f1f5f9",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    padding: "2rem",
                }}>
                    <div style={{
                        maxWidth: "600px",
                        width: "100%",
                        background: "#1e293b",
                        borderRadius: "12px",
                        padding: "2rem",
                        border: "1px solid #334155",
                    }}>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem", color: "#f87171" }}>
                            ⚠️ Something went wrong
                        </h1>
                        <p style={{ color: "#94a3b8", marginBottom: "1rem", fontSize: "0.875rem" }}>
                            The app encountered an error. Check the browser console (F12) for details.
                        </p>
                        {isDev ? (
                            <pre style={{
                                background: "#0f172a",
                                padding: "1rem",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                overflow: "auto",
                                maxHeight: "300px",
                                color: "#fbbf24",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                            }}>
                                {this.state.error?.message}
                                {"\n\n"}
                                {this.state.error?.stack}
                            </pre>
                        ) : (
                            <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                                Error ID has been reported to our team.
                            </p>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                marginTop: "1rem",
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
                </div>
            );
        }

        return this.props.children;
    }
}
