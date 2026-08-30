import { useEffect, useRef, useState } from "react";
import type { DemoState } from "../App";

interface Props {
  demoState: DemoState;
  onStateChange: (s: DemoState) => void;
}

// ─── Test case definitions ──────────────────────────────────────────────────

interface TestCase {
  id: string;
  name: string;
}

const ALL_TESTS: TestCase[] = [
  { id: "t1", name: "normal + case + trim" },
  { id: "t2", name: "empty array" },
  { id: "t3", name: "blank-only values ignored" },
  { id: "t4", name: "order preservation" },
  { id: "t5", name: "duplicate/case normalization" },
];

// Attempt 1: t2, t3 PASS — t1, t4, t5 FAIL (2/5)
const ATTEMPT1_PASS = new Set(["t2", "t3"]);

// ─── Activity feed event ────────────────────────────────────────────────────

type EventKind = "working" | "fail" | "pass" | "capture" | "info";

interface FeedEvent {
  id: number;
  kind: EventKind;
  message: string;
}

// ─── Step indicator ─────────────────────────────────────────────────────────

type Step = "Authoring" | "Verifying" | "Capturing" | "Done";
const STEPS: Step[] = ["Authoring", "Verifying", "Capturing", "Done"];

// ─── Component ──────────────────────────────────────────────────────────────

export default function LiveJobView({ demoState, onStateChange }: Props) {
  const startedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const counterRef = useRef(0);

  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>("Authoring");
  const [doneSteps, setDoneSteps] = useState<Set<Step>>(new Set());
  const [isDone, setIsDone] = useState(false);

  const [attempt1Done, setAttempt1Done] = useState(false);
  const [attempt1Results, setAttempt1Results] = useState<
    { id: string; name: string; pass: boolean }[]
  >([]);
  const [attempt2Done, setAttempt2Done] = useState(false);

  // ─── Helpers ────────────────────────────────────────────────────────────

  function addEvent(kind: EventKind, message: string) {
    const id = ++counterRef.current;
    setFeedEvents((prev) => [{ id, kind, message }, ...prev]);
  }

  function markStepDone(step: Step) {
    setDoneSteps((prev) => new Set([...prev, step]));
  }

  // ─── Scripted sequence ──────────────────────────────────────────────────

  useEffect(() => {
    // Only start when state becomes "frozen" and we haven't started yet.
    // Note: demoState is intentionally NOT in the dep array — App re-renders
    // this component with demoState="running" then "done", which would
    // re-fire this effect and reset the timeline.
    if (startedRef.current) return;
    if (demoState !== "frozen") return;
    startedRef.current = true;

    onStateChange("running");

    // ── Timeline: { at: ms, fn } entries ──────────────────────────────────
    // t=0s: Start authoring attempt 1
    // t=4s: Deliverable written, start verifier
    // t=7s: Verification FAILED — 2/5
    // t=9s: Retrying, start attempt 2
    // t=14s: Attempt 2 deliverable written
    // t=17s: Verification PASSED — 5/5
    // t=18s: Payment captured + Done
    const timeline: { at: number; fn: () => void }[] = [
      {
        at: 0,
        fn: () => {
          addEvent("working", "Authoring deliverable…");
          setCurrentStep("Authoring");
        },
      },
      {
        at: 4000,
        fn: () => {
          addEvent("info", "Deliverable written");
          addEvent("working", "Running verifier…");
          setCurrentStep("Verifying");
        },
      },
      {
        at: 7000,
        fn: () => {
          addEvent("fail", "Verification failed — 2/5 tests passed");
          const results = ALL_TESTS.map((tc) => ({
            id: tc.id,
            name: tc.name,
            pass: ATTEMPT1_PASS.has(tc.id),
          }));
          setAttempt1Results(results);
          setAttempt1Done(true);
        },
      },
      {
        at: 9000,
        fn: () => {
          addEvent("working", "Retrying…");
          addEvent("working", "Authoring deliverable… (attempt 2)");
          setCurrentStep("Authoring");
        },
      },
      {
        at: 14000,
        fn: () => {
          addEvent("info", "Deliverable written");
          addEvent("working", "Running verifier…");
          setCurrentStep("Verifying");
        },
      },
      {
        at: 17000,
        fn: () => {
          addEvent("pass", "Verification passed — 5/5 tests passed ✓");
          setAttempt2Done(true);
          markStepDone("Authoring");
          markStepDone("Verifying");
          setCurrentStep("Capturing");
        },
      },
      {
        at: 18000,
        fn: () => {
          addEvent("capture", "Payment captured ✓");
          markStepDone("Capturing");
          setCurrentStep("Done");
          setIsDone(true);
          onStateChange("done");
        },
      },
    ];

    // ── RAF loop — fires entries by wall-clock elapsed time ───────────────
    const startTime = Date.now();
    const fired = new Set<number>();

    function tick() {
      const elapsed = Date.now() - startTime;
      timeline.forEach((entry, idx) => {
        if (!fired.has(idx) && elapsed >= entry.at) {
          fired.add(idx);
          entry.fn();
        }
      });
      if (fired.size < timeline.length) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Derived UI values ───────────────────────────────────────────────────

  const statusLabel = isDone
    ? "Complete"
    : currentStep === "Authoring"
    ? "Agent working…"
    : currentStep === "Verifying"
    ? "Verifying…"
    : currentStep === "Capturing"
    ? "Capturing payment…"
    : "Done";

  // ─── Dot colours per kind ─────────────────────────────────────────────

  function dotStyle(kind: EventKind): React.CSSProperties {
    const colors: Record<EventKind, string> = {
      working: "var(--amber)",
      fail: "var(--red)",
      pass: "var(--green)",
      capture: "var(--green)",
      info: "var(--text-subtle)",
    };
    return {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: colors[kind],
      flexShrink: 0,
      marginTop: 5,
    };
  }

  function textColor(kind: EventKind): string {
    const colors: Record<EventKind, string> = {
      working: "var(--amber)",
      fail: "var(--red)",
      pass: "var(--green)",
      capture: "var(--green)",
      info: "var(--text-muted)",
    };
    return colors[kind];
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <section className="card fade-in">
      {/* Step header */}
      <div className="step-label" style={{ marginBottom: 16 }}>
        <span className={`step-num ${isDone ? "done" : "active"}`}>
          {isDone ? "✓" : "3"}
        </span>
        <span>Live Job Execution</span>

        {/* Status pill */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {!isDone && <span className="dot-pulse" />}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isDone ? "var(--green)" : "var(--amber)",
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
        Agent authors a deliverable — verifier checks it against the frozen test
        suite. Payment is captured automatically on pass.
      </p>

      {/* ── Step indicator ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 28,
          overflowX: "auto",
        }}
      >
        {STEPS.map((step, i) => {
          const done = doneSteps.has(step);
          const active = currentStep === step && !done;
          return (
            <div
              key={step}
              style={{ display: "flex", alignItems: "center", flex: 1 }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    border: `1.5px solid ${
                      done
                        ? "var(--green)"
                        : active
                        ? "var(--amber)"
                        : "var(--border)"
                    }`,
                    background: done
                      ? "var(--green-soft)"
                      : active
                      ? "var(--amber-soft)"
                      : "var(--surface-2)",
                    color: done
                      ? "var(--green)"
                      : active
                      ? "var(--amber)"
                      : "var(--text-muted)",
                    animation: active ? "pulse-dot 1.4s ease-in-out infinite" : undefined,
                    transition: "all 0.4s ease",
                  }}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    marginTop: 6,
                    fontWeight: 600,
                    color: done
                      ? "var(--green)"
                      : active
                      ? "var(--amber)"
                      : "var(--text-muted)",
                  }}
                >
                  {step}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    margin: "0 6px",
                    marginBottom: 18,
                    background: doneSteps.has(step)
                      ? "var(--green)"
                      : "var(--border)",
                    transition: "background 0.6s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Layout: activity feed + verdict panels ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        {/* Left: Live activity feed */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 10,
            }}
          >
            Live activity{" "}
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              (newest first)
            </span>
          </div>
          <div className="feed">
            {feedEvents.length === 0 && (
              <p className="text-muted text-sm">Waiting for first event…</p>
            )}
            {feedEvents.map((ev) => (
              <div key={ev.id} className="feed-item fade-in">
                <div style={dotStyle(ev.kind)} />
                <span style={{ fontSize: 13, color: textColor(ev.kind) }}>
                  {ev.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Verdict panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Attempt 1 verdict */}
          {attempt1Done && (
            <div
              className="fade-in"
              style={{
                borderRadius: 10,
                border: "1px solid var(--red)",
                background: "var(--red-soft)",
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--red)",
                  }}
                >
                  Attempt 1 — 2/5 passed
                </span>
                <span className="badge badge-red">FAIL</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {attempt1Results.map((r) => (
                  <div
                    key={r.id}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      className={`badge ${r.pass ? "badge-green" : "badge-red"}`}
                      style={{ minWidth: 40, justifyContent: "center" }}
                    >
                      {r.pass ? "PASS" : "FAIL"}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {r.id}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {r.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attempt 2 verdict */}
          {attempt2Done && (
            <div
              className="fade-in"
              style={{
                borderRadius: 10,
                border: "1px solid var(--green)",
                background: "var(--green-soft)",
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--green)",
                  }}
                >
                  Attempt 2 — 5/5 passed
                </span>
                <span className="badge badge-green">PASS</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ALL_TESTS.map((tc) => (
                  <div
                    key={tc.id}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      className="badge badge-green"
                      style={{ minWidth: 40, justifyContent: "center" }}
                    >
                      PASS
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {tc.id}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {tc.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!attempt1Done && !attempt2Done && (
            <p className="text-muted text-sm">
              Verdicts will appear here as the verifier runs…
            </p>
          )}
        </div>
      </div>

      {/* ── Done banner ── */}
      {isDone && (
        <div className="success-banner fade-in" style={{ marginTop: 28 }}>
          <h2>✓ Complete — all testcases passed</h2>
          <p
            className="text-muted text-sm"
            style={{ marginBottom: 20 }}
          >
            testsRun:&nbsp;5&nbsp;&nbsp;·&nbsp;&nbsp;testsPassed:&nbsp;5
          </p>

          <div style={{ textAlign: "left", display: "inline-block", maxWidth: 480, width: "100%" }}>
            <p
              className="text-muted text-xs"
              style={{ marginBottom: 8, fontWeight: 600 }}
            >
              Deliverable output
            </p>
            <pre
              style={{
                background: "var(--green-soft)",
                border: "1px solid var(--green)",
                color: "var(--green)",
                borderRadius: 10,
                padding: "14px 18px",
                fontSize: 13,
              }}
            >
              {`["alice@example.com", "bob@example.com"]`}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
