import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import { jobs, testSuites, submissions } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { runWorker } from "../agents/worker.js";
import { emitEvent } from "../realtime/publish.js";
import { capturePayment, type PaymentState } from "./payment-helper.js";
import type { TestCase, TestSuite } from "@powp/shared";

const app = new Hono();
const pool = createPool();
const db = createDb(pool);

/**
 * POST /api/jobs/:id/run
 * ----------------------
 * Runs the worker + deterministic verifier over the frozen test suite.
 *
 *   - If `body.deliverable` is present, use it directly (deterministic demo
 *     path — lets a caller submit an explicit deliverable to test PASS/FAIL).
 *   - Otherwise, ask the worker agent (`runWorker`) to author a deliverable
 *     that passes the frozen suite, then verify that.
 *
 * `verifyJob` persists the submission (attempt_no), the verdict, and emits the
 * VERIFIED / VERIFY_FAILED event; this route only stages the deliverable.
 */
app.post("/api/jobs/:id/run", async (c) => {
  const jobId = c.req.param("id");

  const jobRows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  const job = jobRows[0];
  if (!job) return c.json({ error: "job not found" }, 404);
  if (!job.testSuiteHash) {
    return c.json({ error: "tests not frozen" }, 400);
  }

  const body = await c.req.json().catch(() => ({}));

  let deliverable: string;
  if (typeof body.deliverable === "string" && body.deliverable.trim() !== "") {
    // Explicit deliverable (deterministic demo / manual re-submission).
    deliverable = body.deliverable;
  } else {
    // Agent path: load the frozen suite and ask the worker to satisfy it.
    const suiteRows = await db
      .select()
      .from(testSuites)
      .where(eq(testSuites.jobId, jobId))
      .orderBy(desc(testSuites.version))
      .limit(1);
    const suiteRow = suiteRows[0];
    if (!suiteRow) return c.json({ error: "test suite not found" }, 400);

    const suite: TestSuite = {
      jobId,
      version: suiteRow.version,
      tests: suiteRow.testsJson as unknown as TestCase[],
      hash: suiteRow.suiteHash,
      frozenAt: suiteRow.frozenAt ? String(suiteRow.frozenAt) : undefined,
    };
    deliverable = await runWorker(job.requestText, suite);
  }

  await emitEvent(jobId, "RUN_STARTED", { deliverable: Boolean(deliverable) });

  const { verifyJob } = await import("../verifier/verify.js");
  const verdict = await verifyJob(jobId, deliverable);

  // verifyJob sets CAPTURED on pass and FAILED on fail. On pass, stage the
  // state IN_PROGRESS and always call capturePayment (demo mode emits
  // PAYMENT_CAPTURED {demo:true}; in a future Stripe path it would move money).
  let payment: PaymentState;
  if (verdict.result === "pass") {
    await db
      .update(jobs)
      .set({ state: "IN_PROGRESS", updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    payment = await capturePayment(jobId, job.stripePaymentIntentId ?? null);
  } else {
    // Failure: leave the job FAILED so the worker can retry.
    await db
      .update(jobs)
      .set({ state: "FAILED", updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
    payment = {
      status: "unavailable",
      paymentIntentId: null,
    };
  }

  return c.json({ verdict, deliverable, payment });
});

/** GET /api/jobs/:id/submissions — list all submissions for a job. */
app.get("/api/jobs/:id/submissions", async (c) => {
  const jobId = c.req.param("id");
  const list = await db
    .select()
    .from(submissions)
    .where(eq(submissions.jobId, jobId))
    .orderBy(desc(submissions.attemptNo));
  return c.json(list);
});

export default app;
