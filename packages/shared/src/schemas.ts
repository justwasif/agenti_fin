import { z } from "zod";
import { createHash } from "node:crypto";

/**
 * JobState — the full state machine for a job.
 * Single source of truth for the whole app (imported by API + web).
 */
export const JobState = z.enum([
  "DRAFT",
  "LOCKED",
  "IN_PROGRESS",
  "SUBMITTED",
  "VERIFYING",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
]);
export type JobState = z.infer<typeof JobState>;

/**
 * One deterministic test case.
 * `function` names the entrypoint the verifier calls;
 * `input` / `expected` are arbitrary JSON (unknown until the verifier narrows them).
 */
export const TestCase = z.object({
  id: z.string(),
  name: z.string(),
  function: z.string(),
  input: z.unknown(),
  expected: z.unknown(),
});
export type TestCase = z.infer<typeof TestCase>;

/**
 * A frozen set of tests attached to a job.
 * `hash` is the canonical content hash (see createTestSuiteHash) — it is what
 * makes a test suite immutable/frozen for a given job version.
 */
export const TestSuite = z.object({
  jobId: z.string(),
  version: z.number(),
  tests: z.array(TestCase),
  hash: z.string(),
  frozenAt: z.string().optional(),
});
export type TestSuite = z.infer<typeof TestSuite>;

/**
 * A single test result inside a verdict.
 */
export const TestResult = z.object({
  testId: z.string(),
  pass: z.boolean(),
  input: z.unknown(),
  expected: z.unknown(),
  actual: z.unknown(),
  error: z.string().optional(),
});
export type TestResult = z.infer<typeof TestResult>;

/**
 * The deterministic verifier's verdict over a submission.
 */
export const Verdict = z.object({
  result: z.enum(["pass", "fail"]),
  testsRun: z.number(),
  testsPassed: z.number(),
  results: z.array(TestResult),
  evidenceHash: z.string(),
});
export type Verdict = z.infer<typeof Verdict>;

/**
 * Canonical JSON: keys sorted recursively, no whitespace.
 * Two arrays with the same tests (in any key order) hash to the same value.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * sha256 over the canonical JSON of the tests array.
 * Used to freeze a test_suite (stored in `test_suites.suite_hash` and
 * `jobs.test_suite_hash`) so the buyer's tests cannot change after lock.
 */
export function createTestSuiteHash(tests: TestCase[]): string {
  return createHash("sha256").update(canonicalJson(tests), "utf8").digest("hex");
}
