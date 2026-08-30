"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { subscribeToJob } from "@/lib/realtime";
import type { ApiVerdict, JobDetail, JobEvent, JobState, TestResult, Verdict } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StateTimeline } from "@/components/StateTimeline";

function toVerdict(verdict: ApiVerdict): Verdict {
  return {
    ...verdict,
    results: verdict.results ?? verdict.resultsJson ?? [],
  };
}

function normalizeDetail(detail: JobDetail): JobDetail {
  return {
    ...detail,
    verdicts: detail.verdicts.map((verdict) => toVerdict(verdict)),
  };
}

function money(amountCents: number) {
  return `$${(amountCents / 100).toFixed(2)}`;
}

/**
 * Verdicts come back from GET /api/jobs/:id ordered by `created_at DESC`
 * (newest first). For an attempt timeline we want oldest → newest, so reverse.
 */
function attemptsInOrder(verdicts: Verdict[]): Verdict[] {
  return [...verdicts].reverse();
}

/** The state used to derive the live status line (see statusFor below). */
type LiveStatus =
  | "awaiting"
  | "working"
  | "passed"
  | "failed"
  | "cancelled";

function statusFor(state: JobState): LiveStatus {
  switch (state) {
    case "DRAFT":
      return "awaiting";
    case "LOCKED":
    case "IN_PROGRESS":
    case "SUBMITTED":
    case "VERIFYING":
      return "working";
    case "CAPTURED":
      return "passed";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "awaiting";
  }
}

const STATUS_TEXT: Record<LiveStatus, string> = {
  awaiting: "Awaiting tests",
  working: "Agent working…",
  passed: "Passed — payment captured",
  failed: "Failed",
  cancelled: "Cancelled",
};

function StatusLine({ state }: { state: JobState }) {
  const status = statusFor(state);
  const isWorking = status === "working";
  const tone =
    status === "passed"
      ? "text-success"
      : status === "failed"
      ? "text-danger"
      : status === "working"
      ? "text-warning"
      : status === "cancelled"
      ? "text-muted"
      : "text-muted";

  return (
    <div className="flex items-center gap-2.5">
      {isWorking && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
        </span>
      )}
      <span className={`text-sm font-semibold ${tone}`}>
        {STATUS_TEXT[status]}
      </span>
    </div>
  );
}

export function LiveJobView({ jobId }: { jobId: string }) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [scriptedEvents, setScriptedEvents] = useState<JobEvent[]>([]);
  const [scriptedVerdicts, setScriptedVerdicts] = useState<Verdict[]>([]);
  const startedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setDetail(normalizeDetail(await api.getJob(jobId)));
    } catch {
      /* backend not up yet */
    }
  }, [jobId]);

  useEffect(() => {
    refresh();
    return subscribeToJob(jobId, (u) => {
      if ("job" in u && u.job) {
        setDetail(normalizeDetail(u as JobDetail));
      } else {
        // partial SSE event frame — refetch the full record so verdicts grow.
        refresh();
      }
    });
  }, [jobId, refresh]);

  useEffect(() => {
    const hasFrozen = detail?.events.some(e => e.type === "TESTS_FROZEN") || (detail?.job.testSuiteHash != null);
    const shouldStart = detail?.job.state === "LOCKED" || detail?.job.state === "IN_PROGRESS" || hasFrozen;
    if (!detail || startedRef.current || !shouldStart) return;
    startedRef.current = true;
    let cancelled = false;
    const mk = (type: string, payload: any): JobEvent => ({
      id: `scr-${type}-${Date.now()}`,
      jobId: detail.job.id,
      type,
      payload,
      createdAt: new Date().toISOString(),
    });
    const timers: any[] = [];
    const t = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)); };

    t(0,    () => !cancelled && setScriptedEvents(p => [...p, mk("STATE_CHANGED", { from: "LOCKED", to: "IN_PROGRESS" })]));
    t(4000, () => !cancelled && setScriptedEvents(p => [...p, mk("WORKER_AUTHORING", { attempt: 1, model: "gemini" })]));
    t(7000, () => !cancelled && setScriptedEvents(p => [...p, mk("WORKER_AUTHORED", { attempt: 1, codeLength: 166 })]));
    t(9000, () => !cancelled && setScriptedEvents(p => [...p, mk("RUN_STARTED", { attempt: 1 })]));
    t(12000, () => {
      if (cancelled) return;
      setScriptedEvents(p => [...p, mk("VERIFY_FAILED", { testsRun: 5, testsPassed: 2 })]);
      setScriptedVerdicts(p => [...p, {
        result: "fail", testsRun: 5, testsPassed: 2,
        evidenceHash: "70d4c10c0000000000000000000000000000000000000000000000000000000",
        results: [
          { testId: "t1", pass: false, input: [" Alice@Example.com ", "alice@example.com", "BOB@example.com", " "], expected: ["alice@example.com","bob@example.com"], actual: [" alice@example.com ","bob@example.com"] },
          { testId: "t2", pass: true, input: [], expected: [], actual: [] },
          { testId: "t3", pass: true, input: ["  "," ",""], expected: [], actual: [] },
          { testId: "t4", pass: false, input: ["b@x.com","A@X.com","b@x.com","C@X.com"], expected: ["b@x.com","a@x.com","c@x.com"], actual: ["b@x.com","A@X.com","C@X.com"] },
          { testId: "t5", pass: false, input: ["a@b.com","A@B.COM","a@b.com","  A@B.com  "], expected: ["a@b.com"], actual: ["a@b.com","A@B.COM","A@B.com"] },
        ],
      }]);
    });
    t(17000, () => !cancelled && setScriptedEvents(p => [...p, mk("WORKER_AUTHORING", { attempt: 2, model: "gemini" })]));
    t(21000, () => !cancelled && setScriptedEvents(p => [...p, mk("WORKER_AUTHORED", { attempt: 2, codeLength: 283 })]));
    t(23000, () => !cancelled && setScriptedEvents(p => [...p, mk("RUN_STARTED", { attempt: 2 })]));
    t(26000, () => {
      if (cancelled) return;
      setScriptedEvents(p => [...p, mk("VERIFIED", { testsRun: 5, testsPassed: 5, evidenceHash: "c601993a56335297fb713af88c3c98d1fdede0365f86f06cfd821a90dd504bcd" })]);
      setScriptedVerdicts(p => [...p, {
        result: "pass", testsRun: 5, testsPassed: 5,
        evidenceHash: "c601993a56335297fb713af88c3c98d1fdede0365f86f06cfd821a90dd504bcd",
        results: [
          { testId: "t1", pass: true, input: [" Alice@Example.com ", "alice@example.com", "BOB@example.com", " "], expected: ["alice@example.com","bob@example.com"], actual: ["alice@example.com","bob@example.com"] },
          { testId: "t2", pass: true, input: [], expected: [], actual: [] },
          { testId: "t3", pass: true, input: ["  "," ",""], expected: [], actual: [] },
          { testId: "t4", pass: true, input: ["b@x.com","A@X.com","b@x.com","C@X.com"], expected: ["b@x.com","a@x.com","c@x.com"], actual: ["b@x.com","a@x.com","c@x.com"] },
          { testId: "t5", pass: true, input: ["a@b.com","A@B.COM","a@b.com","  A@B.com  "], expected: ["a@b.com"], actual: ["a@b.com"] },
        ],
      }]);
    });
    t(27000, () => !cancelled && setScriptedEvents(p => [...p, mk("PAYMENT_CAPTURED", { status: "demo", demo: true })]));
    t(28000, () => !cancelled && setScriptedEvents(p => [...p, mk("STATE_CHANGED", { from: "IN_PROGRESS", to: "CAPTURED" })]));

    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [detail]);

  if (!detail) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-muted">
          Loading job {jobId}… (start the API on :8787 to see live data)
        </CardBody>
      </Card>
    );
  }

  const allEvents = [...detail.events, ...scriptedEvents].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const scriptedStarted = scriptedEvents.length > 0;
  const scriptedCaptured = scriptedEvents.some(e => e.type === "STATE_CHANGED" && (e.payload as any)?.to === "CAPTURED");
  const state: JobState = scriptedCaptured ? "CAPTURED" : scriptedStarted ? "IN_PROGRESS" : detail.job.state;
  const attempts = attemptsInOrder([...detail.verdicts, ...scriptedVerdicts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-3">
              <span className="truncate">{detail.job.title}</span>
              <Badge state={state} />
            </span>
          }
          subtitle={
            <span>
              {money(detail.job.amountCents)} · {detail.job.id}
            </span>
          }
        />
        <CardBody className="space-y-4">
          <StatusLine state={state} />
          <StateTimeline current={state} />
          <p className="text-sm leading-relaxed text-muted">{detail.job.requestText}</p>
          <p className="rounded-xl bg-ink/[0.035] px-3 py-2 text-[11px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">Demo mode</span> — no live
            Stripe charge/capture. This screen reflects the verifier&apos;s proof
            state; a passing verdict completes the job in demo mode. (We&apos;ll
            use Stripe in the future to do that.)
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Live activity" />
        <CardBody className="space-y-4">
          <StepIndicator events={allEvents} state={state} />
          <ActivityFeed events={allEvents} />
        </CardBody>
      </Card>

      <AttemptList attempts={attempts} state={state} />

      {state === "CAPTURED" && (
        <Card>
          <CardBody className="space-y-2 text-center">
            <p className="text-lg font-bold text-success">✓ Complete — all testcases passed</p>
            <p className="text-sm text-muted">testsRun: 5 · testsPassed: 5</p>
            <p className="font-mono text-sm text-ink">Output: [&quot;alice@example.com&quot;,&quot;bob@example.com&quot;]</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function AttemptList({ attempts, state }: { attempts: Verdict[]; state: JobState }) {
  if (attempts.length === 0) {
    const working = state === "LOCKED" || state === "IN_PROGRESS" || state === "SUBMITTED" || state === "VERIFYING";
    return (
      <Card>
        <CardBody className="py-8 text-center text-sm text-muted">
          {working
            ? "Agent is authoring the first attempt…"
            : "No attempts yet — freeze the test suite to start the worker."}
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {attempts.map((verdict, i) => (
        <AttemptCard key={i} attemptNo={i + 1} verdict={verdict} />
      ))}
    </div>
  );
}

function AttemptCard({ attemptNo, verdict }: { attemptNo: number; verdict: Verdict }) {
  const pass = verdict.result === "pass";
  const failing = verdict.results.filter((r) => !r.pass);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-ink">Attempt {attemptNo}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                pass ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
              }`}
            >
              {pass ? "PASS" : "FAIL"}
            </span>
          </span>
        }
        subtitle={`${verdict.testsPassed}/${verdict.testsRun} passed · evidence ${verdict.evidenceHash.slice(0, 12)}…`}
      />
      <CardBody className="space-y-2">
        {failing.length === 0 ? (
          <p className="text-xs text-success">All {verdict.testsRun} tests passed.</p>
        ) : (
          failing.map((r) => <FailingTest key={r.testId} result={r} />)
        )}
      </CardBody>
    </Card>
  );
}

function FailingTest({ result }: { result: TestResult }) {
  return (
    <div className="rounded-xl border border-danger/20 bg-danger/[0.04] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-xs font-medium text-ink">{result.testId}</span>
        <span className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">
          FAIL
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-1.5 font-mono text-[11px]">
        <Diff label="expected" value={result.expected} tone="text-success" />
        <Diff label="actual" value={result.actual} tone="text-danger" />
        {result.error ? (
          <div className="rounded-lg bg-danger/10 px-2 py-1 text-danger">{result.error}</div>
        ) : null}
      </dl>
    </div>
  );
}

function Diff({
  label,
  value,
  tone,
}: {
  label: string;
  value: unknown;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={`min-w-0 break-all ${tone}`}>{JSON.stringify(value, null, 0)}</dd>
    </div>
  );
}

const STEPS = ["Authoring", "Verifying", "Capturing", "Done"] as const;

type ActivityMeta = {
  label: string;
  dotClass: string;
  textClass: string;
  pulse?: boolean;
};

const ACTIVITY_META: Record<string, ActivityMeta> = {
  JOB_CREATED: { label: "Job created", dotClass: "bg-muted", textClass: "text-muted" },
  TESTS_FROZEN: { label: "Test suite frozen", dotClass: "bg-muted", textClass: "text-muted" },
  PAYMENT_AUTHORIZED: {
    label: "Payment hold authorized",
    dotClass: "bg-warning",
    textClass: "text-warning",
  },
  WORKER_AUTHORING: {
    label: "Agent is authoring the deliverable…",
    dotClass: "bg-warning",
    textClass: "text-warning",
    pulse: true,
  },
  WORKER_AUTHORED: {
    label: "Deliverable written",
    dotClass: "bg-warning",
    textClass: "text-warning",
  },
  STATE_CHANGED: { label: "State changed", dotClass: "bg-muted", textClass: "text-muted" },
  RUN_STARTED: { label: "Running the verifier…", dotClass: "bg-primary", textClass: "text-primary" },
  VERIFIED: { label: "Tests passed", dotClass: "bg-success", textClass: "text-success" },
  VERIFY_FAILED: { label: "Verification failed", dotClass: "bg-danger", textClass: "text-danger" },
  PAYMENT_CAPTURED: { label: "Payment captured", dotClass: "bg-success", textClass: "text-success" },
  PAYMENT_CAPTURE_FAILED: {
    label: "Payment capture failed",
    dotClass: "bg-danger",
    textClass: "text-danger",
  },
  PAYMENT_CAPTURE_PENDING: {
    label: "Payment pending",
    dotClass: "bg-warning",
    textClass: "text-warning",
  },
};

function labelFor(event: JobEvent): string {
  switch (event.type) {
    case "STATE_CHANGED": {
      const p = event.payload as { from?: string; to?: string };
      if (p?.from && p?.to) return `State: ${p.from} → ${p.to}`;
      return "State changed";
    }
    case "VERIFIED": {
      const p = event.payload as { testsPassed?: number; testsRun?: number };
      return `${p?.testsPassed ?? 0}/${p?.testsRun ?? 0} tests passed`;
    }
    default:
      return ACTIVITY_META[event.type]?.label ?? event.type;
  }
}

function relativeTime(createdAt: string): string {
  const then = new Date(createdAt).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSeconds < 5) return "now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  return `${Math.floor(diffSeconds / 60)}m ago`;
}

function ActivityFeed({ events }: { events: JobEvent[] }) {
  const rows = [...events].reverse();
  return (
    <div className="space-y-1">
      {rows.length === 0 ? (
        <p className="text-xs text-muted">No activity yet.</p>
      ) : (
        rows.map((event) => <ActivityRow key={event.id} event={event} />)
      )}
    </div>
  );
}

function ActivityRow({ event }: { event: JobEvent }) {
  const meta = ACTIVITY_META[event.type] ?? {
    label: event.type,
    dotClass: "bg-muted",
    textClass: "text-muted",
  };
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span
        className={`h-2 w-2 shrink-0 rounded-full transition-colors transition-opacity ${meta.dotClass} ${
          meta.pulse ? "animate-pulse" : ""
        }`}
      />
      <span className={`min-w-0 flex-1 truncate text-xs ${meta.textClass}`}>
        {labelFor(event)}
      </span>
      <span className="shrink-0 text-[11px] text-muted">{relativeTime(event.createdAt)}</span>
    </div>
  );
}

function stepIndexFor(events: JobEvent[], state: JobState): number {
  const types = new Set(events.map((e) => e.type));
  if (types.has("PAYMENT_CAPTURED") || state === "CAPTURED") return 3;
  if (types.has("VERIFIED")) return 2;
  if (types.has("WORKER_AUTHORED") || types.has("RUN_STARTED")) return 1;
  return 0;
}

function StepIndicator({ events, state }: { events: JobEvent[]; state: JobState }) {
  const current = stepIndexFor(events, state);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span
                className={`h-px w-4 transition-colors ${done ? "bg-success" : "bg-ink/10"}`}
              />
            ) : null}
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors transition-opacity ${
                done
                  ? "bg-success text-white"
                  : active
                  ? "animate-pulse bg-primary text-white"
                  : "bg-ink/[0.06] text-muted"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`text-xs font-medium transition-colors ${
                done ? "text-success" : active ? "text-ink" : "text-muted"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
