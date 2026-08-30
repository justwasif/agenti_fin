import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import { submissions } from "../db/index.js";
import { eq, desc } from "drizzle-orm";

const app = new Hono();
const pool = createPool();
const db = createDb(pool);

/**
 * POST /api/jobs/:id/verify
 * -------------------------
 * Dispute replay. Re-runs the deterministic verifier on an existing
 * deliverable:
 *
 *   - `body.deliverable` present  → replay THAT deliverable (deterministic —
 *     same input → identical verdict).
 *   - no body / no deliverable    → replay the LATEST stored submission's
 *     deliverable. Because the verifier is deterministic, the re-run verdict
 *     must be byte-identical to the original (same evidenceHash).
 */
app.post("/api/jobs/:id/verify", async (c) => {
  const jobId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  let deliverable: string | undefined =
    typeof body.deliverable === "string" ? body.deliverable : undefined;

  if (!deliverable) {
    const rows = await db
      .select()
      .from(submissions)
      .where(eq(submissions.jobId, jobId))
      .orderBy(desc(submissions.attemptNo))
      .limit(1);
    const latest = rows[0];
    if (!latest) {
      return c.json({ error: "no submission to replay" }, 404);
    }
    const stored = latest.deliverableJson as { deliverable?: string } | null;
    deliverable = stored?.deliverable;
    if (!deliverable) {
      return c.json({ error: "stored deliverable is empty" }, 400);
    }
  }

  const { verifyJob } = await import("../verifier/verify.js");
  const verdict = await verifyJob(jobId, deliverable);

  return c.json({ verdict, replayed: true });
});

export default app;
