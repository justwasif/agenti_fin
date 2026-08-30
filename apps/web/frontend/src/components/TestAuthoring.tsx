import { useState } from "react";
import type { DemoState } from "../App";

interface Props {
  demoState: DemoState;
  onFreeze: () => void;
}

interface TestCase {
  id: string;
  name: string;
  input: unknown;
  expected: unknown;
}

const HARDCODED_TESTS: TestCase[] = [
  {
    id: "t1",
    name: "normal + case + trim",
    input: [" Alice@Example.com ", "alice@example.com", "BOB@example.com", " "],
    expected: ["alice@example.com", "bob@example.com"],
  },
  {
    id: "t2",
    name: "empty array",
    input: [],
    expected: [],
  },
  {
    id: "t3",
    name: "blank-only values ignored",
    input: ["  ", "\t", " ", ""],
    expected: [],
  },
  {
    id: "t4",
    name: "order preservation",
    input: ["b@x.com", "A@X.com", "b@x.com", "C@X.com"],
    expected: ["b@x.com", "a@x.com", "c@x.com"],
  },
  {
    id: "t5",
    name: "duplicate/case normalization",
    input: ["a@b.com", "A@B.COM", "a@b.com", "  A@B.com  "],
    expected: ["a@b.com"],
  },
];

type ProposalState = "idle" | "working" | "proposed" | "frozen";

export default function TestAuthoring({ demoState, onFreeze }: Props) {
  const [requirements, setRequirements] = useState("");
  const [proposalState, setProposalState] = useState<ProposalState>("idle");

  const isLocked =
    demoState === "frozen" || demoState === "running" || demoState === "done";

  function handlePropose() {
    setProposalState("working");
    setTimeout(() => {
      setProposalState("proposed");
    }, 2000);
  }

  function handleFreeze() {
    setProposalState("frozen");
    onFreeze();
  }

  function formatJson(val: unknown): string {
    return JSON.stringify(val);
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
        {stepDone && (
          <span className="badge badge-green" style={{ marginLeft: "auto" }}>
            Suite frozen
          </span>
        )}
      </div>

      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        AI proposes verifiable test cases — review and freeze them before the
        agent starts work.
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
            <span className="text-muted text-xs">
              {HARDCODED_TESTS.length} cases
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {HARDCODED_TESTS.map((tc) => (
              <div key={tc.id} className="test-pill pass">
                {/* PASS badge */}
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
                    <span className="font-mono text-xs text-muted">
                      {tc.id}
                    </span>
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
                      <span className="status-green">{formatJson(tc.expected)}</span>
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
