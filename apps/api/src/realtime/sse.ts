import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import { events } from "../db/index.js";
import { and, eq, gt } from "drizzle-orm";

const app = new Hono();
const pool = createPool();
const db = createDb(pool);

/**
 * GET /api/jobs/:id/stream — Server-Sent Events (standalone offline fallback).
 *
 * On open:
 *   1. Replay every existing event for the job as `data: {json}\n\n`.
 *   2. Poll the events table every ~1.5s for THIS job's events with
 *      `created_at > lastSeen` and stream new ones, advancing the watermark
 *      each batch so no event is skipped or duplicated.
 *   3. Write a `: keepalive\n\n` comment every 15s to hold the connection open.
 *
 * Client disconnect is handled via the raw Request's `abort` signal, which is
 * the Node-compatible path (Hono's streamSSE only auto-wires abort for old
 * Bun versions).
 *
 * IMPORTANT: the response is returned FIRST and the replay/poll loop runs in a
 * fire-and-forget async IIFE. If we `await` a `writer.write()` before returning,
 * the TransformStream applies backpressure (no reader is attached yet) and the
 * second write would hang forever — the client would never even see headers.
 */
app.get("/api/jobs/:id/stream", (c) => {
  const jobId = c.req.param("id");

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = (data: unknown) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  const sendKeepalive = () =>
    writer.write(encoder.encode(`: keepalive\n\n`));

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  let lastSeen: Date = new Date(0);
  let keepaliveCount = 0;
  let poll: ReturnType<typeof setInterval> | null = null;

  // Per-connection guard: event ids already emitted to THIS client. Prevents a
  // duplicate when the initial replay and the 1.5s poll race on an event with
  // an identical `created_at` (or when history and the first poll overlap).
  const emittedIds = new Set<string>();

  const emitOnce = async (e: {
    id: string;
    type: string;
    payloadJson: unknown;
    createdAt: Date | null;
  }) => {
    if (emittedIds.has(e.id)) return;
    emittedIds.add(e.id);
    await sendEvent({
      id: e.id,
      type: e.type,
      payload: e.payloadJson,
      createdAt: e.createdAt,
    });
  };

  const run = async () => {
    // 1. Replay existing events (each id sent at most once).
    try {
      const history = await db
        .select()
        .from(events)
        .where(eq(events.jobId, jobId))
        .orderBy(events.createdAt);

      for (const e of history) {
        await emitOnce(e);
        if (e.createdAt && e.createdAt > lastSeen) lastSeen = e.createdAt;
      }
    } catch {
      // DB hiccup on open: keep the connection alive; polling will retry.
    }

    // 2. Poll for events strictly newer than the last one streamed,
    //    filtered by BOTH jobId and timestamp, de-duplicated by id.
    poll = setInterval(async () => {
      try {
        const fresh = await db
          .select()
          .from(events)
          .where(and(eq(events.jobId, jobId), gt(events.createdAt, lastSeen)))
          .orderBy(events.createdAt);

        for (const e of fresh) {
          await emitOnce(e);
          if (e.createdAt) lastSeen = e.createdAt;
        }
      } catch {
        // DB hiccup: keep the stream alive; the next tick will retry.
      }

      // 3. Keepalive every 15s (poll runs every 1.5s → every 10th tick).
      keepaliveCount += 1;
      if (keepaliveCount % 10 === 0) {
        await sendKeepalive();
      }
    }, 1500);
  };

  c.req.raw.signal.addEventListener("abort", () => {
    if (poll) clearInterval(poll);
    writer.close().catch(() => {});
  });

  // Kick off replay+poll without blocking the response return.
  run();

  return c.body(readable);
});

export default app;
