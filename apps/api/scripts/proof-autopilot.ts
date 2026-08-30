/**
 * proof-autopilot.ts
 *
 * Run this after the API is NOT running (it talks to DB directly).
 * It creates a job, freezes a simple non-dedupe test suite, then calls
 * runAutopilot exactly like the freeze route does.
 *
 * Usage (from repo root):
 *   set -a; source test_env.env; set +a
 *   export DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com \
 *          DB_PORT=6543 \
 *          DB_USER=postgres.dllsfylmavamgctbjtoz \
 *          DB_PASSWORD='LLIIVVEE@786w' \
 *          DB_NAME=postgres \
 *          DB_SSL=true \
 *          GEMINI_API_KEY=... \
 *          OPENROUTER_API_KEY=...
 *   node --import tsx apps/api/scripts/proof-autopilot.ts
 */
import { createPool, createDb } from "../src/db/index.js";
import { jobs, testSuites, submissions, verdicts, events } from "../src/db/index.js";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { runAutopilot } from "../src/autopilot.js";

const pool = createPool();
const db = createDb(pool);

(async () => {
  const jobId = randomUUID();
  console.log("=== AUTOPILOT PROOF ===");
  console.log("jobId:", jobId);

  try {
    // 1. Create job
    await db.insert(jobs).values({
      id: jobId,
      title: "Autopilot proof: reverse string",
      requestText: "Write a pure function reverse(str) that returns the reversed string.",
      amountCents: 100,
      buyerId: "demo-buyer",
      state: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Freeze a simple reverse test suite (not the dedupe example)
    const testList = [
      { id: "r1", name: "reverse abc", function: "reverse", input: "abc", expected: "cba" },
      { id: "r2", name: "reverse empty", function: "reverse", input: "", expected: "" },
    ];
    const hash = "proof-" + Date.now();

    await db.insert(testSuites).values({
      id: randomUUID(),
      jobId,
      version: 1,
      testsJson: testList,
      suiteHash: hash,
      authorMode: "manual",
      frozenAt: new Date(),
    });

    await db.update(jobs)
      .set({ testSuiteHash: hash, state: "LOCKED", updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    console.log("Job created + frozen (LOCKED). Starting autonomous loop...");

    // 3. Exactly what the /tests/freeze route does (fire-and-forget style)
    await runAutopilot(jobId);

    // 4. Inspect result
    const [finalJob] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    console.log("\nFINAL STATE:", finalJob.state);

    const evs = await db.select().from(events).where(eq(events.jobId, jobId)).orderBy(events.createdAt);
    console.log("\nEVENT CHAIN:");
    for (const e of evs) {
      console.log("  " + e.type, JSON.stringify(e.payloadJson));
    }

    const subs = await db.select().from(submissions).where(eq(submissions.jobId, jobId)).orderBy(submissions.attemptNo);
    console.log("\nSUBMISSIONS:", subs.length);

    const vds = await db.select().from(verdicts).where(eq(verdicts.jobId, jobId)).orderBy(verdicts.createdAt);
    console.log("VERDICTS:");
    for (const v of vds) {
      console.log(`  attempt ${v.attemptNo}: ${v.result} (${v.testsPassed}/${v.testsRun})`);
    }

    console.log("\n=== PROOF DONE ===");
    if (finalJob.state === "CAPTURED") {
      console.log("SUCCESS: agent autonomously reached CAPTURED");
    } else {
      console.log("ENDED IN:", finalJob.state, "(check model output or keys)");
    }
  } catch (err) {
    console.error("PROOF ERROR:", err && (err.stack || err.message || err));
  } finally {
    await pool.end();
  }
})();
