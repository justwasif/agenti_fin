import { Hono } from "hono";
import { serve } from "@hono/node-server";

import jobs from "./routes/jobs.js";
import tests from "./routes/tests.js";
import submissions from "./routes/submissions.js";
import verify from "./routes/verify.js";
import sse from "./realtime/sse.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

// Mount route groups
app.route("/", jobs);
app.route("/", tests);
app.route("/", submissions);
app.route("/", verify);
app.route("/", sse);

// Stripe webhook. W2's webhook.ts constructs `new Stripe(secret)` at module
// load and throws if the secret is empty, so we dynamic-import it inside a
// try/catch — the API must still boot (for the verifier/SSE demo) even when no
// Stripe key is configured. When a key IS present, the real webhook mounts at
// POST /api/stripe/webhook.
try {
  const { webhook: stripeWebhook } = await import("./stripe/webhook.js");
  app.route("/api/stripe", stripeWebhook);
  console.log("[powp-api] stripe webhook mounted at POST /api/stripe/webhook");
} catch (err) {
  console.warn(
    "[powp-api] stripe webhook NOT mounted (no STRIPE_SECRET_KEY):",
    err instanceof Error ? err.message : err
  );
  app.post("/api/stripe/webhook", (c) =>
    c.json({ received: false, error: "stripe not configured" }, 503)
  );
}

export default app;

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[powp-api] listening on http://localhost:${info.port}`);
});
