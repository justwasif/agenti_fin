import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import { jobs, events } from "../db/index.js";
import { randomUUID } from "node:crypto";
import { emitEvent } from "../realtime/publish.js";

const app = new Hono();
const pool = createPool();
const db = createDb(pool);

app.post("/api/jobs", async (c) => {
  const body = await c.req.json();
  const id = randomUUID();
  const now = new Date();

  const [job] = await db
    .insert(jobs)
    .values({
      id,
      state: "DRAFT",
      buyerId: body.buyerId || "demo-buyer",
      requestText: body.requestText,
      title: body.title,
      amountCents: body.amountCents,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await emitEvent(id, "JOB_CREATED", { title: body.title, amountCents: body.amountCents });
  return c.json(job);
});

app.get("/api/jobs", async (c) => {
  const list = await db.select().from(jobs).orderBy(jobs.createdAt);
  return c.json(list);
});

app.get("/api/jobs/:id", async (c) => {
  const id = c.req.param("id");
  const [job] = await db.select().from(jobs).where(jobs.id.eq(id));
  if (!job) return c.json({ error: "not found" }, 404);

  const verdictsList = await db.select().from(jobs).where(jobs.id.eq(id)); // placeholder - real verdicts join later
  const evts = await db.select().from(events).where(events.jobId.eq(id)).orderBy(events.createdAt);

  return c.json({ job, verdicts: [], events: evts });
});

export default app;
