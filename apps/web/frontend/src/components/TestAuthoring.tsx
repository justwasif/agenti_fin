import { useState } from "react";
import type { DemoState } from "../App";
import { proposeTests, type ProposedTest } from "../api";
import { loadJobContext } from "./RequestBuilder";

interface Props {
  demoState: DemoState;
  onFreeze: (tests: ProposedTest[]) => void;
}

type ProposalState = "idle" | "working" | "proposed" | "frozen" | "error";

export const FROZEN_TESTS_KEY = "powp-frozen-tests";

export function loadFrozenTests(): ProposedTest[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FROZEN_TESTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveFrozenTests(tests: ProposedTest[]) {
  try {
    sessionStorage.setItem(FROZEN_TESTS_KEY, JSON.stringify(tests));
  } catch {
    // ignore
  }
}

export default function TestAuthoring({ demoState, onFreeze }: Props) {
  const [requirements, setRequirements] = useState("");
  const [proposalState, setProposalState] = useState<ProposalState>("idle");
  const [tests, setTests] = useState<ProposedTest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"gemini" | "fallback" | null>(null);

  const isLocked =
    demoState === "frozen" || demoState === "running" || demoState === "done";

  async function handlePropose() {
    setProposalState("working");
    setError(null);
    try {
      const ctx = loadJobContext();
      const res = await proposeTests(ctx.title, ctx.request);
      setTests(res.tests);
      setSource(res.source);
      setProposalState("proposed");
    } catch (err) {
      setError((err as Error).message);
      setProposalState("error");
    }
  }

  function handleFreeze() {
    saveFrozenTests(tests);
    setProposalState("frozen");
    onFreeze(tests);
  }

  function formatJson(val: unknown): string {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }

  const stepDone = isLocked || proposalState === "frozen";

  return (
    <section className="card fade-in">
      {/* Step header */}
      <div className="step-label" style={{ marginBottom: 16 }}>
        <span
          className={`step-num ${stepDone ? "done" : proposalState !== "idle" ? "active" : ""}`}
        >
          {stepDone ? "✓" : "2"}
        </span>
        <span>Author Test Suite</span>
        {source === "gemini" && proposalState === "proposed" && !isLocked && (
          <span className="badge badge-indigo" style={{ marginLeft: 8 }}>
            Gemini
          </span>
        )}
        {source === "fallback" && proposalState === "proposed" && !isLocked && (
          <span
            className="badge"
            style={{
              marginLeft: 8,
              background: "var(--amber-soft)",
              color: "var(--amber)",
            }}
          >
            Fallback
          </span>
        )}
        {stepDone && (
          <span className="badge badge-green" style={{ marginLeft: "auto" }}>
            Suite frozen
          </span>
        )}
      </div>

      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        The test-authoring agent reads your job request and proposes
        deterministic, re-runnable test cases. Review and freeze them
        before the worker agent starts.
      </p>

      {/* Requirements textarea */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-subtle)",
            marginBottom: 6,
          }}
        >
          Requirements for the test-authoring agent
        </label>
        <textarea
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          disabled={proposalState !== "idle" || isLocked}
          rows={5}
          style={{ opacity: proposalState !== "idle" || isLocked ? 0.55 : 1 }}
        />
      </div>

      {/* Propose button */}
      {proposalState === "idle" && !isLocked && (
        <button onClick={handlePropose} className="btn">
          Propose tests →
        </button>
      )}

      {/* Error state */}
      {proposalState === "error" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 0",
          }}
        >
          <span className="status-red text-sm">⚠ {error}</span>
          <button
            onClick={handlePropose}
            className="btn btn-ghost"
            style={{ padding: "4px 10px", fontSize: 12 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Working state */}
      {proposalState === "working" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 0",
          }}
        >
          <span className="dot-pulse" />
          <span className="status-amber font-semibold text-sm">Working…</span>
          <span className="text-muted text-sm">Generating test cases</span>
        </div>
      )}

      {/* Proposed test cases */}
      {(proposalState === "proposed" ||
        proposalState === "frozen" ||
        isLocked) && (
        <div className="fade-in">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}
            >
              Proposed test cases
            </span>
            <span className="text-muted text-xs">{tests.length} cases</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tests.map((tc) => (
              <div key={tc.id} className="test-pill pass">
                <span className="badge badge-green">PASS</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span className="font-mono text-xs text-muted">{tc.id}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {tc.name}
                    </span>
                  </div>
                  <div
                    className="font-mono text-xs"
                    style={{ color: "var(--text-muted)", lineHeight: 1.6 }}
                  >
                    <div>
                      <span style={{ opacity: 0.6 }}>in: </span>
                      <span style={{ color: "var(--text)" }}>
                        {formatJson(tc.input)}
                      </span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.6 }}>→ </span>
                      <span className="status-green">
                        {formatJson(tc.expected)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Freeze button */}
          {proposalState === "proposed" && !isLocked && (
            <button
              onClick={handleFreeze}
              className="btn"
              style={{ marginTop: 16 }}
            >
              Freeze suite →
            </button>
          )}
        </div>
      )}
    </section>
  );
}
