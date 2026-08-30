import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import * as schema from "../db/schema.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TestCase, createTestSuiteHash } from "@powp/shared";
import { emitEvent } from "../realtime/publish.js";
import { generateTests } from "../agents/test-authoring.js";
import { eq } from "drizzle-orm";
import { authorizePayment, type PaymentState } from "./payment-helper.js";

const app = new Hono();
const pool = createPool();
const db = createDb(pool);
const { jobs, testSuites } = schema;

const FreezeBody = z.object({
  tests: z.array(TestCase),
});

app.post("/api/jobs/:id/tests", async (c) => {
  const jobId = c.req.param("id");
  const body = await c.req.json();

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return c.json({ error: "job not found" }, 404);

  if (body.mode === "agent") {
    const proposed = await generateTests(job.requestText, body.requirements || "");
    const hash = createTestSuiteHash(proposed);
    return c.json({ proposed, hash, mode: "agent" });
  }

  const tests = body.tests || [];
  const parsed = z.array(TestCase).parse(tests);
  const hash = createTestSuiteHash(parsed);

  const suiteId = randomUUID();
  await db.insert(testSuites).values({
    id: suiteId,
    jobId,
    version: 1,
    testsJson: parsed,
    suiteHash: hash,
    authorMode: "manual",
    frozenAt: new Date(),
  });

  await db.update(jobs).set({ testSuiteHash: hash, state: "LOCKED", updatedAt: new Date() }).where(eq(jobs.id, jobId));
  await emitEvent(jobId, "TESTS_FROZEN", { suiteHash: hash, version: 1 });

  const payment = await authorizePayment(jobId, job.amountCents);
  return c.json({ suiteId, hash, frozen: true, payment });
});

app.post("/api/jobs/:id/tests/freeze", async (c) => {
  const jobId = c.req.param("id");
  const body = await c.req.json();
  const { tests } = FreezeBody.parse(body);

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return c.json({ error: "job not found" }, 404);

  const hash = createTestSuiteHash(tests);
  const suiteId = randomUUID();

  await db.insert(testSuites).values({
    id: suiteId,
    jobId,
    version: 1,
    testsJson: tests,
    suiteHash: hash,
    authorMode: "manual",
    frozenAt: new Date(),
  });

  await db.update(jobs).set({ testSuiteHash: hash, state: "LOCKED", updatedAt: new Date() }).where(eq(jobs.id, jobId));
  await emitEvent(jobId, "TESTS_FROZEN", { suiteHash: hash });

  const payment = await authorizePayment(jobId, job.amountCents);
  return c.json({ suiteId, hash, frozen: true, payment });
});

export default app;
