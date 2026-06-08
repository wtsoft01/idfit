import { createRoot } from "react-dom/client";
import { Component, ReactNode } from "react";
import App from "./App.tsx";
import "./index.css";

class RootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("IDFIT render error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-md rounded-md border border-border bg-card p-6 text-center">
            <h1 className="text-xl font-semibold">IDFIT을 불러오지 못했습니다</h1>
            <p className="mt-2 text-sm text-muted-foreground">잠시 후 새로고침하거나 관리자에게 문의해주세요.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

window.addEventListener("error", (event) => {
  console.error("IDFIT runtime error", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("IDFIT unhandled rejection", event.reason);
});

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>,
  );
}
