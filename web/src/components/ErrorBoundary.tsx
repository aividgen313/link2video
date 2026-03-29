"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, showDetails } = this.state;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.95rem",
              color: "#888888",
              marginBottom: "1.5rem",
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred. Please try reloading the page.
          </p>

          <button
            onClick={this.handleReload}
            style={{
              padding: "0.625rem 1.5rem",
              fontSize: "0.9rem",
              fontWeight: 500,
              color: "#ffffff",
              backgroundColor: "#2563eb",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#1d4ed8")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#2563eb")
            }
          >
            Reload page
          </button>

          {error && (
            <div style={{ marginTop: "2rem" }}>
              <button
                onClick={this.toggleDetails}
                style={{
                  background: "none",
                  border: "none",
                  color: "#555555",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                {showDetails ? "Hide error details" : "Show error details"}
              </button>

              {showDetails && (
                <pre
                  style={{
                    marginTop: "0.75rem",
                    padding: "1rem",
                    backgroundColor: "#141414",
                    border: "1px solid #262626",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    color: "#999999",
                    textAlign: "left",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: "200px",
                    overflow: "auto",
                  }}
                >
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
