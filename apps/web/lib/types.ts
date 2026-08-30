import { JobState as JobStateSchema, TestCase as TestCaseSchema, TestSuite as TestSuiteSchema, TestResult as TestResultSchema, Verdict as VerdictSchema, createTestSuiteHash, canonicalJson } from "@powp/shared";
import type { z } from "zod";

export { createTestSuiteHash, canonicalJson };
export { JobState as JobStateEnum } from "@powp/shared";

export type JobState = z.infer<typeof JobStateSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestSuite = z.infer<typeof TestSuiteSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;

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
  tests: TestCase[];
  preview: TestPreview[];
}

export interface TestPreview {
  testId: string;
  name: string;
  pass: boolean;
  note?: string;
}

export interface RunResult {
  verdict: Verdict;
}
