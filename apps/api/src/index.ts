import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ ok: true });
});

export default app;

const port = Number(process.env.PORT ?? 8787);

// Only start the server when this file is run directly (not when imported).
// W2/W3 will mount their routes onto `app` before this entry is executed, or
// import { app } from this module in their own entry.
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[powp-api] listening on http://localhost:${info.port}`);
});
