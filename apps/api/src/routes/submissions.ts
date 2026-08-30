import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import { jobs } from "../db/schema.js";
import { eq } from "drizzle-orm";

const app = new Hono();
const pool = createPool();
const db = createDb(pool);

app.post("/api/jobs/:id/run", async (c) => {
  const jobId = c.req.param("id");
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return c.json({ error: "job not found" }, 404);
  if (!job.testSuiteHash) return c.json({ error: "tests not frozen" }, 400);

  const { verifyJob } = await import("../verifier/verify.js");
  const body = await c.req.json().catch(() => ({}));
  const deliverable = body.deliverable || "module.exports.dedupe = (e) => [...new Set(e.map(x=>x.toLowerCase()))]";

  const verdict = await verifyJob(jobId, deliverable);
  return c.json({ verdict });
});

app.get("/api/jobs/:id/submissions", async (c) => {
  return c.json([]);
});

export default app;
