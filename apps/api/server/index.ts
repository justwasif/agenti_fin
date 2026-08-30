/**
 * ProofOfWorkPay backend
 *
 * Endpoints:
 *   GET  /api/health
 *   POST /api/propose-tests   { jobTitle, jobRequest }  -> { tests, source }
 *   POST /api/run-job         { jobTitle, jobRequest }  -> { tests, worker, plan }
 *   POST /api/verify          { totalTests, attempt }   -> { attempt }
 */

import "dotenv/config";
import express from "express";
import cors from "cors";

import { proposeTests, type ProposedTest } from "./agent-testAuthor.js";
import { runWorker, type WorkerResult } from "./agent-worker.js";
import { planVerifierRuns, type VerifierPlan } from "./verifier.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ── Health
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
    ),
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  });
});

// ── Agent #1: propose tests
app.post("/api/propose-tests", async (req, res) => {
  try {
    const { jobTitle, jobRequest } = req.body || {};
    if (!jobTitle || !jobRequest) {
      return res.status(400).json({ error: "jobTitle and jobRequest are required" });
    }
    const result = await proposeTests(String(jobTitle), String(jobRequest));
    return res.json(result);
  } catch (err) {
    console.error("[/api/propose-tests]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── One-shot: tests + worker output + randomized plan
app.post("/api/run-job", async (req, res) => {
  try {
    const { jobTitle, jobRequest } = req.body || {};
    if (!jobTitle || !jobRequest) {
      return res.status(400).json({ error: "jobTitle and jobRequest are required" });
    }

    const titleStr = String(jobTitle);
    const requestStr = String(jobRequest);

    const [testsResult, workerResult] = await Promise.all([
      proposeTests(titleStr, requestStr),
      runWorker(titleStr, requestStr, 1),
    ]);

    const plan: VerifierPlan = planVerifierRuns(testsResult.tests.length);

    return res.json({
      tests: testsResult.tests,
      testsSource: testsResult.source,
      worker: workerResult,
      plan,
    });
  } catch (err) {
    console.error("[/api/run-job]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── Per-attempt verifier (used by the frontend's feedback loop)
app.post("/api/verify", (req, res) => {
  try {
    const { totalTests, attempt, seed } = req.body || {};
    if (typeof totalTests !== "number" || typeof attempt !== "number") {
      return res.status(400).json({ error: "totalTests and attempt are required" });
    }
    const plan = planVerifierRuns(totalTests, seededRng(Number(seed) + attempt));
    const a = plan.attempts[Math.min(attempt - 1, plan.attempts.length - 1)];
    return res.json({ attempt: a, totalAttempts: plan.attempts.length });
  } catch (err) {
    console.error("[/api/verify]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

function seededRng(seed: number): () => number {
  // simple LCG
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`[powp] backend listening on http://localhost:${PORT}`);
  const hasKey = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
  );
  console.log(
    `[powp] GEMINI_API_KEY: ${hasKey ? "configured" : "MISSING — using fallback results"}`
  );
});
