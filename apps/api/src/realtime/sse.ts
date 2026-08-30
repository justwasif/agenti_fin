import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import { events } from "../db/schema.js";
import { eq, gt, and } from "drizzle-orm";

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

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  const history = await db
    .select()
    .from(events)
    .where(eq(events.jobId, jobId))
    .orderBy(events.createdAt);

  for (const e of history) {
    await send({ id: e.id, type: e.type, payload: e.payloadJson, createdAt: e.createdAt });
  }

  const lastCreated = history.length > 0 ? history[history.length - 1]!.createdAt : new Date(0);

  const interval = setInterval(async () => {
    try {
      const newEvents = await db
        .select()
        .from(events)
        .where(and(eq(events.jobId, jobId), gt(events.createdAt, lastCreated)));

      for (const e of newEvents) {
        await send({ id: e.id, type: e.type, payload: e.payloadJson, createdAt: e.createdAt });
      }
      keepalive();
    } catch {
      clearInterval(interval);
      await writer.close().catch(() => {});
    }
  }, 1500);

  c.req.raw.signal.addEventListener("abort", () => {
    clearInterval(interval);
    writer.close().catch(() => {});
  });

  return c.body(readable);
});

export default app;
