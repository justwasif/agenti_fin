import { useEffect, useRef, useState } from "react";
import type { DemoState } from "../App";
import {
  runJob,
  type ProposedTest,
  type VerifierAttempt,
  type WorkerResult,
} from "../api";
import { loadJobContext } from "./RequestBuilder";

interface Props {
  demoState: DemoState;
  onStateChange: (s: DemoState) => void;
}

// ─── Activity feed event ──────────────────────────────────────────────────
type EventKind = "working" | "fail" | "pass" | "capture" | "info";

interface FeedEvent {
  id: number;
  kind: EventKind;
  message: string;
}

// ─── Step indicator ───────────────────────────────────────────────────────
type Step = "Authoring" | "Verifying" | "Capturing" | "Done";
const STEPS: Step[] = ["Authoring", "Verifying", "Capturing", "Done"];

// ─── Component ────────────────────────────────────────────────────────────
export default function LiveJobView({ demoState, onStateChange }: Props) {
  const startedRef = useRef(false);
  const counterRef = useRef(0);

  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>("Authoring");
  const [doneSteps, setDoneSteps] = useState<Set<Step>>(new Set());
  const [isDone, setIsDone] = useState(false);

  const [tests, setTests] = useState<ProposedTest[]>([]);
  const [worker, setWorker] = useState<WorkerResult | null>(null);
  const [attempts, setAttempts] = useState<VerifierAttempt[]>([]);
  const [attemptsDone, setAttemptsDone] = useState(0);
  const [currentAttempt, setCurrentAttempt] = useState<VerifierAttempt | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // ─── Helpers ───────────────────────────────────────────────────────────
  function addEvent(kind: EventKind, message: string) {
    const id = ++counterRef.current;
    setFeedEvents((prev) => [{ id, kind, message }, ...prev]);
  }

  function markStepDone(step: Step) {
    setDoneSteps((prev) => new Set([...prev, step]));
  }

  // ─── Scripted sequence (driven by API + randomized plan) ───────────────
  useEffect(() => {
    if (startedRef.current) return;
    if (demoState !== "frozen") return;
    startedRef.current = true;

    onStateChange("running");

    let cancelled = false;
    const timeouts: number[] = [];

    function t(fn: () => void, ms: number) {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timeouts.push(id);
    }

    async function start() {
      setCurrentStep("Authoring");
      addEvent("working", "Worker agent is starting…");
      t(() => addEvent("info", "Reading the frozen test suite"), 800);
      t(() => addEvent("info", "Drafting deliverable…"), 1800);

      let jobRes: Awaited<ReturnType<typeof runJob>>;
      try {
        const ctx = loadJobContext();
        jobRes = await runJob(ctx.title, ctx.request);
      } catch (err) {
        setError((err as Error).message);
        addEvent("fail", `API error: ${(err as Error).message}`);
        return;
      }
      if (cancelled) return;

      setTests(jobRes.tests);
      setWorker(jobRes.worker);
      setAttempts(jobRes.plan.attempts);

      const workerNote = jobRes.worker.source === "fallback" ? " (fallback)" : "";
      addEvent("info", `Deliverable written${workerNote}`);
      addEvent("working", "Running verifier…");
      setCurrentStep("Verifying");

      // Run attempts sequentially
      for (let i = 0; i < jobRes.plan.attempts.length; i++) {
        if (cancelled) return;
        const a = jobRes.plan.attempts[i];
        const isFinal = i === jobRes.plan.attempts.length - 1;
        const isRetry = i > 0;

        if (isRetry) {
          t(() => {
            addEvent("info", "Worker is fixing the failing cases…");
            addEvent("working", "Re-authoring deliverable…");
            setCurrentStep("Authoring");
          }, 900);
          t(() => {
            addEvent("info", "Re-submitted to verifier");
            addEvent("working", "Running verifier…");
            setCurrentStep("Verifying");
          }, 2400);
        }

        // Wait a beat for the activity to read naturally
        t(() => {
          setCurrentAttempt(a);
          setAttemptsDone(i + 1);

          if (a.passed) {
            addEvent(
              "pass",
              `Verification passed — ${a.testsPassed}/${a.totalTests} tests passed ✓`
            );
          } else {
            const failing = (a.failingTestIds ?? []).join(", ");
            addEvent(
              "fail",
              `Verification failed — ${a.testsPassed}/${a.totalTests} tests passed · failing: ${failing}`
            );
          }
        }, isRetry ? 3600 : 1600);

        if (isFinal) {
          // Mark Authoring/Verifying done and move to capture
          t(() => {
            markStepDone("Authoring");
            markStepDone("Verifying");
            setCurrentStep("Capturing");
            addEvent("capture", "Payment captured ✓");
            markStepDone("Capturing");
            setCurrentStep("Done");
            setIsDone(true);
            onStateChange("done");
          }, isRetry ? 4400 : 2200);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      for (const id of timeouts) clearTimeout(id);
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Derived UI ────────────────────────────────────────────────────────
  const statusLabel = isDone
    ? "Complete"
    : currentStep === "Authoring"
    ? "Agent working…"
    : currentStep === "Verifying"
    ? "Verifying…"
    : currentStep === "Capturing"
    ? "Capturing payment…"
    : "Done";

  // ─── Visual helpers ────────────────────────────────────────────────────
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

  // Render deliverable output
  function renderWorkerOutput() {
    if (!worker) return null;
    if (worker.kind === "code") {
      return (
        <pre
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--ink)",
            borderRadius: 10,
            padding: "14px 18px",
            fontSize: 12.5,
            overflowX: "auto",
            margin: 0,
          }}
        >
          <code>{worker.output}</code>
        </pre>
      );
    }
    if (worker.kind === "json") {
      return (
        <pre
          style={{
            background: "var(--green-soft)",
            border: "1px solid var(--green)",
            color: "var(--green)",
            borderRadius: 10,
            padding: "14px 18px",
            fontSize: 13,
            margin: 0,
          }}
        >
          {worker.output}
        </pre>
      );
    }
    return (
      <pre
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: 10,
          padding: "14px 18px",
          fontSize: 13,
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {worker.output}
      </pre>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <section className="card fade-in">
      {/* Step header */}
      <div className="step-label" style={{ marginBottom: 16 }}>
        <span className={`step-num ${isDone ? "done" : "active"}`}>
          {isDone ? "✓" : "3"}
        </span>
        <span>Live Job Execution</span>

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

      {error && (
        <div
          style={{
            background: "var(--red-soft)",
            border: "1px solid var(--red)",
            color: "var(--red)",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
        Worker agent authors a deliverable — verifier checks it against the
        frozen test suite. Payment is captured automatically on pass.
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
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
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
                    animation: active
                      ? "pulse-dot 1.4s ease-in-out infinite"
                      : undefined,
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
            <span
              style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}
            >
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

        {/* Right: Verdict panels — one per attempt */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {attempts.slice(0, attemptsDone).map((a) => {
            const isPass = a.passed;
            return (
              <div
                key={a.attempt}
                className="fade-in"
                style={{
                  borderRadius: 10,
                  border: `1px solid ${
                    isPass ? "var(--green)" : "var(--red)"
                  }`,
                  background: isPass ? "var(--green-soft)" : "var(--red-soft)",
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
                      color: isPass ? "var(--green)" : "var(--red)",
                    }}
                  >
                    Attempt {a.attempt} — {a.testsPassed}/{a.totalTests}{" "}
                    passed
                  </span>
                  <span
                    className={`badge ${
                      isPass ? "badge-green" : "badge-red"
                    }`}
                  >
                    {isPass ? "PASS" : "FAIL"}
                  </span>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {tests.map((tc) => {
                    const failed = !isPass && (a.failingTestIds ?? []).includes(tc.id);
                    return (
                      <div
                        key={tc.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          className={`badge ${
                            failed ? "badge-red" : "badge-green"
                          }`}
                          style={{ minWidth: 40, justifyContent: "center" }}
                        >
                          {failed ? "FAIL" : "PASS"}
                        </span>
                        <span className="font-mono text-xs text-muted">
                          {tc.id}
                        </span>
                        <span
                          style={{ fontSize: 12, color: "var(--text-muted)" }}
                        >
                          {tc.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {attempts.length === 0 && attemptsDone === 0 && (
            <p className="text-muted text-sm">
              Verdicts will appear here as the verifier runs…
            </p>
          )}
        </div>
      </div>

      {/* ── Done banner ── */}
      {isDone && worker && (
        <div className="success-banner fade-in" style={{ marginTop: 28 }}>
          <h2>✓ Complete — all testcases passed</h2>
          <p
            className="text-muted text-sm"
            style={{ marginBottom: 20 }}
          >
            testsRun:&nbsp;{currentAttempt?.totalTests ?? tests.length}
            &nbsp;&nbsp;·&nbsp;&nbsp;testsPassed:&nbsp;
            {currentAttempt?.testsPassed ?? tests.length}
            {worker.source === "fallback" ? (
              <span style={{ marginLeft: 8 }}>
                <span
                  className="badge"
                  style={{
                    background: "var(--amber-soft)",
                    color: "var(--amber)",
                  }}
                >
                  Fallback output
                </span>
              </span>
            ) : (
              <span style={{ marginLeft: 8 }}>
                <span
                  className="badge"
                  style={{
                    background: "var(--indigo-soft)",
                    color: "var(--indigo)",
                  }}
                >
                  Gemini output
                </span>
              </span>
            )}
          </p>

          <div
            style={{
              textAlign: "left",
              display: "inline-block",
              maxWidth: 640,
              width: "100%",
            }}
          >
            <p
              className="text-muted text-xs"
              style={{ marginBottom: 8, fontWeight: 600 }}
            >
              {worker.kind === "code"
                ? `Deliverable source${
                    worker.language ? ` · ${worker.language}` : ""
                  }`
                : "Deliverable output"}
            </p>
            {renderWorkerOutput()}
            {worker.notes && (
              <p
                className="text-muted text-xs"
                style={{ marginTop: 8, fontStyle: "italic" }}
              >
                {worker.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
