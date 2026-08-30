import { createPool, createDb } from "../db/index.js";
import { events } from "../db/index.js";
import { randomUUID } from "node:crypto";

const pool = createPool();
const db = createDb(pool);

export async function emitEvent(
  jobId: string,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.insert(events).values({
    id: randomUUID(),
    jobId,
    type,
    payloadJson: payload,
  });
}
