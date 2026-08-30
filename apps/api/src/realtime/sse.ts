import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import { events } from "../db/index.js";
import { eq, gt, desc } from "drizzle-orm";

const app = new Hono();
const pool = createPool();
const db = createDb(pool);

app.get("/api/jobs/:id/stream", async (c) => {
  const jobId = c.req.param("id");
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (data: unknown) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  const keepalive = () => writer.write(encoder.encode(`: keepalive\n\n`));

  // Set headers
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  // Send all historical events first
  const history = await db
    .select()
    .from(events)
    .where(eq(events.jobId, jobId))
    .orderBy(events.createdAt);

  for (const e of history) {
    await send({ id: e.id, type: e.type, payload: e.payloadJson, createdAt: e.createdAt });
  }

  let lastSeen = history.length > 0 ? history[history.length - 1].createdAt : new Date(0);

  const interval = setInterval(async () => {
    try {
      const newEvents = await db
        .select()
        .from(events)
        .where(eq(events.jobId, jobId))
        .where(gt(events.createdAt, lastSeen))
        .orderBy(events.createdAt);

      for (const e of newEvents) {
        await send({ id: e.id, type: e.type, payload: e.payloadJson, createdAt: e.createdAt });
        lastSeen = e.createdAt;
      }
      keepalive();
    } catch (err) {
      clearInterval(interval);
      await writer.close();
    }
  }, 1500);

  // Cleanup on client disconnect
  c.req.raw.signal.addEventListener("abort", () => {
    clearInterval(interval);
    writer.close().catch(() => {});
  });

  return c.body(readable);
});

export default app;
