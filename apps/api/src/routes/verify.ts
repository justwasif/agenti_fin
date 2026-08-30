import { Hono } from "hono";
import { verifyJob } from "../verifier/verify.js";

const app = new Hono();

app.post("/api/jobs/:id/verify", async (c) => {
  const jobId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const deliverable = body.deliverable; // optional; verifyJob can load from submissions if needed

  if (!deliverable) {
    return c.json({ error: "deliverable required for replay" }, 400);
  }

  const verdict = await verifyJob(jobId, deliverable);
  return c.json({ verdict });
});

export default app;
