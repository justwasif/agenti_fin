import { Hono } from "hono";
import { createPool, createDb } from "../db/index.js";
import * as schema from "../db/schema.js";
import { randomUUID } from "node:crypto";
import { emitEvent } from "../realtime/publish.js";
import { eq, desc } from "drizzle-orm";

const app = new Hono();
const pool = createPool();
const db = createDb(pool);
const { jobs, verdicts, events } = schema;

app.post("/api/jobs", async (c) => {
  const body = await c.req.json();
  const id = randomUUID();
  const now = new Date();

  const [job] = await db.insert(jobs).values({
    id,
    state: "DRAFT",
    buyerId: body.buyerId || "demo-buyer",
    requestText: body.requestText,
    title: body.title,
    amountCents: body.amountCents,
    createdAt: now,
    updatedAt: now,
  }).returning();

  await emitEvent(id, "JOB_CREATED", { title: body.title, amountCents: body.amountCents });
  return c.json(job);
});

app.get("/api/jobs", async (c) => {
  const list = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  return c.json(list);
});

app.get("/api/jobs/:id", async (c) => {
  const id = c.req.param("id");
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return c.json({ error: "not found" }, 404);

  const evts = await db.select().from(events).where(eq(events.jobId, id)).orderBy(events.createdAt);
  const vds = await db.select().from(verdicts).where(eq(verdicts.jobId, id)).orderBy(desc(verdicts.createdAt));

  return c.json({ job, verdicts: vds, events: evts });
});

export default app;
