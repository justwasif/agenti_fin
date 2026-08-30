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

export default app;

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[powp-api] listening on http://localhost:${info.port}`);
});
