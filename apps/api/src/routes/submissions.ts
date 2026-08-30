import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import { jobs, submissions } from "../db/index.js";
import { randomUUID } from "node:crypto";
import { emitEvent } from "../realtime/publish.js";

const app = new Hono();
const pool = createPool();
const db = createDb(pool);

app.post("/api/jobs/:id/run", async (c) => {
  const jobId = c.req.param("id");
  const [job] = await db.select().from(jobs).where(jobs.id.eq(jobId));
  if (!job) return c.json({ error: "job not found" }, 404);
  if (!job.testSuiteHash) return c.json({ error: "tests not frozen" }, 400);

  // Load frozen suite
  const suites = await db.select().from(jobs).where(jobs.id.eq(jobId)); // placeholder
  // For now, we hard-wire a simple path; real implementation would join test_suites
  // Dynamic import to avoid circular type issues during build
  const { verifyJob } = await import("../verifier/verify.js");

  // For the demo we expect the worker to be called by the frontend or here.
  // To keep this self-contained, we accept a deliverable in the body if provided.
  const body = await c.req.json().catch(() => ({}));
  const deliverable = body.deliverable || "module.exports.dedupe = (e) => [...new Set(e.map(x=>x.toLowerCase()))]";

  const verdict = await verifyJob(jobId, deliverable);

  return c.json({ verdict });
});

app.get("/api/jobs/:id/submissions", async (c) => {
  const jobId = c.req.param("id");
  // placeholder query
  return c.json([]);
});

export default app;
