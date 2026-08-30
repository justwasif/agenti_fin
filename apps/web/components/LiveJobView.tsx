"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { subscribeToJob } from "@/lib/realtime";
import type { JobDetail, JobState, Verdict } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StateTimeline } from "@/components/StateTimeline";

function money(amountCents: number) {
  return `$${(amountCents / 100).toFixed(2)}`;
}

export function LiveJobView({ jobId }: { jobId: string }) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setDetail(await api.getJob(jobId));
    } catch {
      /* backend not up yet */
    }
  }, [jobId]);

  useEffect(() => {
    refresh();
    return subscribeToJob(jobId, (u) => {
      if ("job" in u && u.job) {
        setDetail(u as JobDetail);
      } else {
        // partial SSE event frame — refetch the full record.
        refresh();
      }
    });
  }, [jobId, refresh]);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const { verdict } = await api.runJob(jobId);
      setDetail((d) => (d ? { ...d, verdicts: [...d.verdicts, verdict] } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  async function replay() {
    setRunning(true);
    setError(null);
    try {
      const { verdict } = await api.verifyJob(jobId);
      setDetail((d) => (d ? { ...d, verdicts: [...d.verdicts, verdict] } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Replay failed");
    } finally {
      setRunning(false);
    }
  }

  if (!detail) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-muted">
          Loading job {jobId}… (start the API on :8787 to see live data)
        </CardBody>
      </Card>
    );
  }

  const latest: Verdict | undefined = detail.verdicts[detail.verdicts.length - 1];
  const state: JobState = detail.job.state;

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
          action={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={run} disabled={running}>
                {running ? "Running…" : "Run verifier"}
              </Button>
              <Button variant="ghost" size="sm" onClick={replay} disabled={running}>
                Replay this run
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <StateTimeline current={state} />
          <p className="text-sm leading-relaxed text-muted">{detail.job.requestText}</p>
        </CardBody>
      </Card>

      {latest && <VerdictCard verdict={latest} />}

      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}
    </div>
  );
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const pass = verdict.result === "pass";
  return (
    <Card>
      <CardHeader
        title={
          <span
            className={`text-sm font-bold ${pass ? "text-success" : "text-danger"}`}
          >
            {pass ? "VERIFIED — PASS" : "VERIFIED — FAIL"}
          </span>
        }
        subtitle={`${verdict.testsPassed}/${verdict.testsRun} passed · evidence ${verdict.evidenceHash.slice(0, 12)}…`}
      />
      <CardBody className="space-y-2">
        {verdict.results.map((r) => (
          <div
            key={r.testId}
            className={`rounded-xl border px-3 py-2.5 ${
              r.pass
                ? "border-success/20 bg-success/[0.04]"
                : "border-danger/20 bg-danger/[0.04]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-xs font-medium text-ink">
                {r.testId}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  r.pass ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                }`}
              >
                {r.pass ? "PASS" : "FAIL"}
              </span>
            </div>
            {!r.pass && (
              <dl className="mt-2 grid grid-cols-1 gap-1.5 font-mono text-[11px]">
                <Diff label="expected" value={r.expected} tone="text-success" />
                <Diff label="actual" value={r.actual} tone="text-danger" />
                {r.error ? (
                  <div className="rounded-lg bg-danger/10 px-2 py-1 text-danger">
                    {r.error}
                  </div>
                ) : null}
              </dl>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
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
      <dd className={`min-w-0 break-all ${tone}`}>
        {JSON.stringify(value, null, 0)}
      </dd>
    </div>
  );
}
