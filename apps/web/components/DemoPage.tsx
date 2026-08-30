"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { RequestBuilder } from "@/components/RequestBuilder";
import { TestAuthoring } from "@/components/TestAuthoring";
import { LiveJobView } from "@/components/LiveJobView";
import type { Job, JobState, TestCase } from "@/lib/types";

const ProofGate3D = dynamic<{ state: JobState }>(
  () => import("@/components/three/ProofGate3D"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[340px] w-full items-center justify-center rounded-2xl border border-ink/5 bg-gradient-to-br from-[#eef2ff] to-[#f6f7f9] text-sm text-muted sm:h-[400px]">
        Loading 3D proof chain…
      </div>
    ),
  },
);

export function DemoPage() {
  const [job, setJob] = useState<Job | null>(null);
  const [tests, setTests] = useState<TestCase[]>([]);

  const demoState: JobState = job?.state ?? "DRAFT";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      {/* Hero */}
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          ProofOfWorkPay
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted sm:text-base">
          No proof, no pay. Escrow releases only when a deterministic verifier
          proves the work against a frozen test suite.
        </p>
      </header>

      {/* 3D state machine hero */}
      <section className="mb-8">
        <div className="relative">
          <ProofGate3D state={demoState} />
        </div>
      </section>

      {/* Main columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <RequestBuilder onCreated={(j) => setJob(j)} />
          {job && (
            <TestAuthoring jobId={job.id} onFrozen={(t) => setTests(t)} />
          )}
        </div>
        <div className="space-y-6">
          {job ? (
            <LiveJobView jobId={job.id} />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-ink/15 bg-surface/50 p-8 text-center text-sm text-muted">
              Post a request to open the live job view.
            </div>
          )}
          {tests.length > 0 && (
            <div className="rounded-2xl border border-ink/5 bg-surface px-5 py-4 text-xs text-muted">
              <span className="font-medium text-ink">{tests.length}</span> tests
              frozen for this job.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
