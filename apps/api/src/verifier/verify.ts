import { createPool, createDb } from "../db/index.js";
import { jobs, testSuites, submissions, verdicts, events } from "../db/index.js";
import { runTests } from "./runner.js";
import {
  createTestSuiteHash,
  type TestCase,
  type TestSuite,
  type Verdict,
} from "@powp/shared";
import { eq, desc, sql } from "drizzle-orm";

/**
 * Orchestrates a full job verification. This is the deterministic "no proof, no
 * pay" core:
 *
 *  1. Load the FROZEN test suite (highest version) and the job row.
 *  2. Tamper-guard: re-hash the stored tests and require it to equal
 *     `jobs.test_suite_hash` — if the buyer's tests changed after lock, fail.
 *  3. Run the deliverable through the sandboxed deterministic runner.
 *  4. Persist a submission + verdict + event, and advance the job state.
 *
 * `verifyJob` never reaches the network for adjudication and never uses an LLM.
 * It returns the same Verdict shape the frontend renders.
 */
export async function verifyJob(
  jobId: string,
  deliverable: string
): Promise<Verdict> {
  const pool = createPool();
  const db = createDb(pool);

  try {
    const jobRows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    const job = jobRows[0];

    if (!job) {
      return failVerdict([{ testId: "__job__", pass: false, error: "job not found" }]);
    }

    const suiteRows = await db
      .select()
      .from(testSuites)
      .where(eq(testSuites.jobId, jobId))
      .orderBy(desc(testSuites.version))
      .limit(1);
    const suiteRow = suiteRows[0];

    if (!suiteRow) {
      return failVerdict([{ testId: "__suite__", pass: false, error: "test suite not found" }]);
    }

    // tests_json is jsonb → pg returns it already parsed (array of TestCase).
    const tests = suiteRow.testsJson as unknown as TestCase[];

    // TAMPER GUARD: the suite's content must still hash to what the job froze.
    const recomputedHash = createTestSuiteHash(tests);
    if (recomputedHash !== job.testSuiteHash) {
      return failVerdict([
        { testId: "__tamper__", pass: false, error: "suite hash mismatch" },
      ]);
    }

    const suite: TestSuite = {
      jobId,
      version: suiteRow.version,
      tests,
      hash: recomputedHash,
      frozenAt: suiteRow.frozenAt ? String(suiteRow.frozenAt) : undefined,
    };

    const verdict = await runTests(deliverable, suite);

    // attempt_no = 1 + count of existing submissions for this job.
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(submissions)
      .where(eq(submissions.jobId, jobId));
    const attemptNo = (countRows[0]?.count ?? 0) + 1;

    const submissionId = `sub-${jobId}-${attemptNo}-${Date.now()}`;
    await db.insert(submissions).values({
      id: submissionId,
      jobId,
      attemptNo,
      deliverableJson: { deliverable },
      status: verdict.result,
      submittedAt: new Date(),
    });

    const verdictId = `verdict-${submissionId}`;
    await db.insert(verdicts).values({
      id: verdictId,
      submissionId,
      jobId,
      result: verdict.result,
      testsRun: verdict.testsRun,
      testsPassed: verdict.testsPassed,
      resultsJson: verdict.results,
      evidenceHash: verdict.evidenceHash,
      createdAt: new Date(),
    });

    const nextState = verdict.result === "pass" ? "CAPTURED" : "FAILED";
    await db
      .update(jobs)
      .set({ state: nextState, updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await db.insert(events).values({
      id: `evt-${verdictId}`,
      jobId,
      type: verdict.result === "pass" ? "VERIFIED" : "VERIFY_FAILED",
      payloadJson: {
        evidenceHash: verdict.evidenceHash,
        testsPassed: verdict.testsPassed,
        testsRun: verdict.testsRun,
      },
      createdAt: new Date(),
    });

    return verdict;
  } finally {
    await pool.end();
  }
}

function failVerdict(results: Verdict["results"]): Verdict {
  return {
    result: "fail",
    testsRun: results.length,
    testsPassed: 0,
    results,
    evidenceHash: "",
  };
}
