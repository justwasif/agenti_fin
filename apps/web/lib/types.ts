import { JobState as JobStateSchema, TestCase as TestCaseSchema, TestSuite as TestSuiteSchema, TestResult as TestResultSchema, Verdict as VerdictSchema, createTestSuiteHash, canonicalJson } from "@powp/shared";
import type { z } from "zod";

export { createTestSuiteHash, canonicalJson };
export { JobState as JobStateEnum } from "@powp/shared";

export type JobState = z.infer<typeof JobStateSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestSuite = z.infer<typeof TestSuiteSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
export interface ApiVerdict {
  result: "pass" | "fail";
  testsRun: number;
  testsPassed: number;
  results?: TestResult[];
  resultsJson?: TestResult[];
  evidenceHash: string;
}

export interface Verdict extends Omit<ApiVerdict, "results" | "resultsJson"> {
  results: TestResult[];
}

export type AuthorMode = "manual" | "agent";

export interface Job {
  id: string;
  state: JobState;
  buyerId: string;
  title: string;
  requestText: string;
  amountCents: number;
  stripePaymentIntentId: string | null;
  testSuiteHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobEvent {
  id: string;
  jobId: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

export interface JobDetail {
  job: Job;
  verdicts: Verdict[];
  events: JobEvent[];
}

export interface CreateJobInput {
  title: string;
  requestText: string;
  amountCents: number;
  buyerId: string;
}

export interface TestsRequest {
  mode: AuthorMode;
  tests?: TestCase[];
  requirements?: string;
}

export interface ProposedTests {
  /** Agent-mode API response. */
  proposed?: TestCase[];
  /** Legacy / mock shape supported during local development. */
  tests?: TestCase[];
  hash?: string;
  mode?: "agent";
}

export interface FreezeResult {
  suiteId: string;
  hash: string;
  frozen: true;
}

export interface TestPreview {
  testId: string;
  name: string;
  pass: boolean;
  note?: string;
}

export interface RunResult {
  verdict: ApiVerdict;
}
