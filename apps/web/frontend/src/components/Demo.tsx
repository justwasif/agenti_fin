import { useState } from "react";
import { useNavigate } from "react-router-dom";
import RequestBuilder from "./RequestBuilder";
import TestAuthoring from "./TestAuthoring";
import LiveJobView from "./LiveJobView";
import MoneySidebar from "./MoneySidebar";
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
      {/* Sub-nav */}
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
        <div className="header-right">
          <span className="badge badge-amber">Demo mode</span>
          <span className="header-tagline">No proof, no pay.</span>
        </div>
      </header>

      {/* Two-column workspace */}
      <div className="demo-workspace">
        {/* Left: stacked step cards */}
        <main className="demo-main">
          <RequestBuilder demoState={state} onCreate={handleCreate} />

          {(state === "draft" ||
            state === "frozen" ||
            state === "running" ||
            state === "done") && (
            <TestAuthoring demoState={state} onFreeze={() => handleFreeze()} />
          )}

          {(state === "frozen" || state === "running" || state === "done") && (
            <LiveJobView demoState={state} onStateChange={setState} />
          )}
        </main>

        {/* Right: sticky money sidebar */}
        <MoneySidebar state={state} />
      </div>
    </div>
  );
}
