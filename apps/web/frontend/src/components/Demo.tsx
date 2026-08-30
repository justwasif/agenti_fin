import { useState } from "react";
import { useNavigate } from "react-router-dom";
import RequestBuilder from "./RequestBuilder";
import TestAuthoring from "./TestAuthoring";
import LiveJobView from "./LiveJobView";
import type { DemoState } from "../App";

const STORAGE_KEY = "powp-demo-state";

function loadState(): DemoState {
  if (typeof window === "undefined") return "idle";
  const s = sessionStorage.getItem(STORAGE_KEY);
  if (s === "idle" || s === "draft" || s === "frozen" || s === "running" || s === "done") {
    return s;
  }
  return "idle";
}

export default function Demo() {
  const navigate = useNavigate();
  const [state, setStateRaw] = useState<DemoState>(loadState);

  function setState(next: DemoState) {
    sessionStorage.setItem(STORAGE_KEY, next);
    setStateRaw(next);
  }

  function handleCreate(_title: string, _request: string, _budget: number) {
    setState("draft");
  }

  function handleFreeze() {
    setState("frozen");
  }

  return (
    <div className="app-content">
      {/* Header with back button */}
      <header className="header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/")}
            className="back-btn"
            title="Back to landing"
            aria-label="Back to landing"
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>←</span>
          </button>
          <div className="logo">
            Proof<span className="logo-accent">Of</span>WorkPay
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="badge badge-amber"
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}
          >
            Demo mode
          </span>
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            No proof, no pay.
          </span>
        </div>
      </header>

      {/* Body */}
      <main className="main-layout">
        {/* Step 1: Request Builder — always shown */}
        <RequestBuilder demoState={state} onCreate={handleCreate} />

        {/* Step 2: Test Authoring — shown after draft created */}
        {(state === "draft" ||
          state === "frozen" ||
          state === "running" ||
          state === "done") && (
          <TestAuthoring demoState={state} onFreeze={handleFreeze} />
        )}

        {/* Step 3: Live Job View — shown once suite is frozen */}
        {(state === "frozen" || state === "running" || state === "done") && (
          <LiveJobView demoState={state} onStateChange={setState} />
        )}
      </main>
    </div>
  );
}
