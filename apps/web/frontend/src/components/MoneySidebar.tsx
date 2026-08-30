import { useEffect, useState } from "react";
import type { DemoState } from "../App";
import { loadJobContext } from "./RequestBuilder";

interface Props {
  state: DemoState;
}

const STEP_LABELS: Record<DemoState, { step: number; total: number; label: string }> = {
  idle:     { step: 0, total: 4, label: "Idle" },
  draft:    { step: 1, total: 4, label: "Draft created" },
  frozen:   { step: 2, total: 4, label: "Tests frozen" },
  running:  { step: 3, total: 4, label: "Agent working" },
  done:     { step: 4, total: 4, label: "Funds released" },
};

const DEFAULT_BUDGET_CENTS = 100; // fallback only — actual value comes from RequestBuilder

function formatDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function readBudgetCents(): number {
  try {
    const ctx = loadJobContext();
    if (ctx && typeof ctx.budget === "number" && ctx.budget > 0) {
      return ctx.budget;
    }
  } catch {
    // ignore
  }
  return DEFAULT_BUDGET_CENTS;
}

export default function MoneySidebar({ state }: Props) {
  const { step, total, label } = STEP_LABELS[state];
  const progressPct = (step / total) * 100;

  // Read the budget the user actually typed in Step 1. Re-read on every
  // render and on the `powp-job-context` storage event so the sidebar
  // updates as soon as they create the draft.
  const [budgetCents, setBudgetCents] = useState<number>(readBudgetCents);

  useEffect(() => {
    function refresh() {
      setBudgetCents(readBudgetCents());
    }
    refresh();
    window.addEventListener("storage", refresh);
    // Same-tab update: listen for a custom event we dispatch from RequestBuilder.
    window.addEventListener("powp-job-context-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("powp-job-context-changed", refresh);
    };
  }, []);

  // Money state
  const locked   = state === "frozen" || state === "running";
  const released = state === "done";
  const draft    = state === "draft";

  const dollars = formatDollars(budgetCents);
  const captured = released ? dollars : "$0.00";
  const inEscrow = released ? "$0.00" : dollars;

  return (
    <aside className="money-sidebar">
      {/* Status pill */}
      <div className="money-status-row">
        <span className={`money-status-dot ${state}`} />
        <span className="money-status-label">{label}</span>
      </div>

      {/* Big balance card */}
      <div className="money-balance-card">
        <span className="money-balance-eyebrow">Escrow balance</span>
        <div className="money-balance-amount">
          <span className="money-balance-currency">$</span>
          <span className="money-balance-value">{dollars}</span>
        </div>
        <div className="money-balance-sub">
          {released ? (
            <span className="status-green">Released to agent</span>
          ) : locked ? (
            <span className="status-amber">Held in escrow</span>
          ) : draft ? (
            <span className="status-indigo">Authorized · pre-flight</span>
          ) : (
            <span className="text-muted">Awaiting draft</span>
          )}
        </div>
      </div>

      {/* Step progress */}
      <div className="money-progress">
        <div className="money-progress-head">
          <span className="money-progress-title">Workflow</span>
          <span className="money-progress-count">
            {step} / {total}
          </span>
        </div>
        <div className="money-progress-bar">
          <div
            className="money-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <ul className="money-step-list">
          {[
            { id: 1, name: "Lock", desc: "Authorize hold", color: "var(--indigo)" },
            { id: 2, name: "Criteria", desc: "Freeze tests", color: "var(--teal)" },
            { id: 3, name: "Work", desc: "Agent delivers", color: "var(--amber)" },
            { id: 4, name: "Verify", desc: "Capture payment", color: "var(--green)" },
          ].map((s) => {
            const isDone = step >= s.id;
            const isActive = step + 1 === s.id;
            return (
              <li
                key={s.id}
                className={`money-step ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}
              >
                <span
                  className="money-step-num"
                  style={{
                    background: isDone ? s.color : "transparent",
                    borderColor: isDone ? s.color : "var(--border-2)",
                    color: isDone ? "#fff" : "var(--text-subtle)",
                  }}
                >
                  {isDone ? "✓" : s.id}
                </span>
                <div className="money-step-body">
                  <span className="money-step-name">{s.name}</span>
                  <span className="money-step-desc">{s.desc}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Money flow ledger */}
      <div className="money-ledger">
        <div className="money-ledger-head">
          <span>Money flow</span>
          <span className="money-ledger-tag">Test mode</span>
        </div>
        <div className="money-ledger-row">
          <span>Authorized</span>
          <span className="font-mono">${dollars}</span>
        </div>
        <div className="money-ledger-row">
          <span>Captured</span>
          <span className="font-mono">{captured}</span>
        </div>
        <div className="money-ledger-row total">
          <span>In escrow</span>
          <span className="font-mono">{inEscrow}</span>
        </div>
      </div>
    </aside>
  );
}
