/**
 * autopilot.ts — the autonomous worker loop.
 *
 * After a buyer freezes tests, the freeze route kicks off `runAutopilot(jobId)`
 * WITHOUT awaiting it. The autopilot then drives the whole "attempt → verify →
 * on-fail retry → on-pass capture" cycle with no manual /run call:
 *
 *   1. Load the frozen suite (highest version). If none, stop.
 *   2. Load the job row. If a Stripe PaymentIntent exists AND it was already
 *      captured (state CAPTURED), stop (nothing left to do).
 *   3. First attempt only: if state is LOCKED, advance to IN_PROGRESS.
 *   4. Pick a SCRIPTED deliverable (attempt 1 = known-failing, attempt 2 =
 *      known-passing). No LLM worker call — this is a scripted demo — but the
 *      deterministic verifier still genuinely runs the deliverable, so the
 *      verdict + evidence hash are real.
 *   5. Emit RUN_STARTED, then run the deterministic verifier.
 *   6. On pass: verifyJob already set CAPTURED — capture the held payment and
 *      stop.
 *   7. On fail: set state back to IN_PROGRESS (so the UI shows the agent is
 *      still working) and loop for the next attempt.
 *   8. If all MAX_ATTEMPTS fail: set state FAILED and emit a final VERIFY_FAILED.
 *
 * It is FIRE-AND-FORGET: the whole body is wrapped in try/catch so a throw
 * never rejects the HTTP response that spawned it. The verifier opens its OWN
 * pool per call, so we only hold this pool for our own DB writes.
 */
import { createPool, createDb, jobs, testSuites } from "./db/index.js";
import { eq, desc } from "drizzle-orm";
import { emitEvent } from "./realtime/publish.js";
import { capturePayment } from "./routes/payment-helper.js";
import type { TestCase, TestResult, TestSuite } from "@powp/shared";

// Predefined deliverables for the scripted demo. The verifier genuinely runs
// both, so the fail/pass verdicts + evidence hashes are real — only the LLM
// worker call is skipped.
const FAILING_DELIVERABLE = `module.exports = { cleanEmails(emails) { if (!Array.isArray(emails)) return []; return emails.filter(e => e && e.trim() !== '').map(e => e.trim().toLowerCase()); } };`;
// ↑ fails t1 (no dedupe → keeps dupes) and t5 (no dedupe). Should fail 2-3 tests.

const PASSING_DELIVERABLE = `module.exports = { cleanEmails(emails) { if (!Array.isArray(emails)) return []; const seen = new Set(); const out = []; for (const e of emails) { const v = String(e).trim().toLowerCase(); if (v === '') continue; if (seen.has(v)) continue; seen.add(v); out.push(v); } return out; } };`;
// ↑ correct: trim, lowercase, dedupe, order-preserving, blank-ignoring, []→[].

const MAX_ATTEMPTS = 2;

export async function runAutopilot(jobId: string): Promise<void> {
  const pool = createPool();
  const db = createDb(pool);

  try {
    // 1. Frozen suite (highest version).
    const suiteRows = await db
      .select()
      .from(testSuites)
      .where(eq(testSuites.jobId, jobId))
      .orderBy(desc(testSuites.version))
      .limit(1);
    const suiteRow = suiteRows[0];
    if (!suiteRow) return;

    const suite: TestSuite = {
      jobId,
      version: suiteRow.version,
      tests: suiteRow.testsJson as unknown as TestCase[],
      hash: suiteRow.suiteHash,
      frozenAt: suiteRow.frozenAt ? String(suiteRow.frozenAt) : undefined,
    };

    // 2. Job row (reloaded each iteration so we observe fresh state).
    let lastFailures: TestResult[] | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const jobRows = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      const job = jobRows[0];
      if (!job) return;

      // Already captured — nothing left to do.
      if (job.stripePaymentIntentId && job.state === "CAPTURED") return;

      // 3. First attempt: move out of LOCKED so the UI shows work in flight.
      if (attempt === 1 && job.state === "LOCKED") {
        await db
          .update(jobs)
          .set({ state: "IN_PROGRESS", updatedAt: new Date() })
          .where(eq(jobs.id, jobId));
        await emitEvent(jobId, "STATE_CHANGED", {
          from: "LOCKED",
          to: "IN_PROGRESS",
        });
      }

      // 3a. On retry: a visible "thinking about what went wrong" pause before
      //     the next authoring attempt so the UI doesn't look stuck.
      if (attempt === 2) await new Promise((r) => setTimeout(r, 4000));

      // 4. Scripted deliverable pick (no LLM worker call). The verifier
      //    genuinely runs the chosen deliverable, so the verdict + evidence
      //    hash are real — only the LLM authoring step is skipped.
      //    Emit progress BEFORE the (simulated) authoring so the UI/console
      //    don't look frozen during the authoring window.
      await new Promise((r) => setTimeout(r, 5000));
      await emitEvent(jobId, "WORKER_AUTHORING", {
        attempt,
        model: "gemini-3.6-flash",
      });
      const deliverable =
        attempt === 1 ? FAILING_DELIVERABLE : PASSING_DELIVERABLE;
      await emitEvent(jobId, "WORKER_AUTHORED", {
        attempt,
        codeLength: deliverable.length,
      });

      // 5. Signal a run, then verify.
      await new Promise((r) => setTimeout(r, 3000));
      await emitEvent(jobId, "RUN_STARTED", { attempt });

      const { verifyJob } = await import("./verifier/verify.js");
      const verdict = await verifyJob(jobId, deliverable);

      // 6. Pass: verifyJob set CAPTURED — now capture the held amount.
      //    Always call capturePayment (even in demo mode, where the PI id is
      //    null) so PAYMENT_CAPTURED is emitted and the flow completes.
      if (verdict.result === "pass") {
        await capturePayment(jobId, job.stripePaymentIntentId ?? null);
        return;
      }

      // 7. Fail: keep working (IN_PROGRESS) and carry the failures forward.
      const failing = verdict.results.filter((r) => !r.pass);
      await db
        .update(jobs)
        .set({ state: "IN_PROGRESS", updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
      lastFailures = failing;
    }

    // 8. Exhausted all attempts — terminal failure.
    await db
      .update(jobs)
      .set({ state: "FAILED", updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
    await emitEvent(jobId, "VERIFY_FAILED", {
      final: true,
      attempts: MAX_ATTEMPTS,
    });
  } catch (err) {
    // Fire-and-forget: never let a throw escape to the HTTP response.
    console.error("[autopilot] run failed:", err instanceof Error ? err : err);
    try {
      await db
        .update(jobs)
        .set({ state: "FAILED", updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
      await emitEvent(jobId, "VERIFY_FAILED", {
        final: true,
        error: err instanceof Error ? err.message : String(err),
      });
    } catch {
      /* ignore — the error event is best-effort only */
    }
  } finally {
    await pool.end();
  }
}
