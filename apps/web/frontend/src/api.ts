/**
 * Frontend API client. All requests go to the local Express backend,
 * which proxies them to Gemini. The Vite dev server forwards /api to
 * http://localhost:8787.
 */

export interface ProposedTest {
  id: string;
  name: string;
  input: unknown;
  expected: unknown;
}

export interface VerifierAttempt {
  attempt: number;
  testsPassed: number;
  totalTests: number;
  passed: boolean;
  failingTestIds?: string[];
}

export interface VerifierPlan {
  attempts: VerifierAttempt[];
  totalTests: number;
  finalPassed: boolean;
}

export interface WorkerResult {
  kind: "code" | "json" | "markdown";
  language?: string;
  output: string;
  notes?: string;
  source: "gemini" | "fallback";
}

export interface RunJobResponse {
  tests: ProposedTest[];
  testsSource: "gemini" | "fallback";
  worker: WorkerResult;
  plan: VerifierPlan;
}

export interface ProposeTestsResponse {
  tests: ProposedTest[];
  source: "gemini" | "fallback";
  reasoning?: string;
}

const API_BASE = "/api";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function proposeTests(
  jobTitle: string,
  jobRequest: string
): Promise<ProposeTestsResponse> {
  return postJson<ProposeTestsResponse>("/propose-tests", { jobTitle, jobRequest });
}

export async function runJob(
  jobTitle: string,
  jobRequest: string
): Promise<RunJobResponse> {
  return postJson<RunJobResponse>("/run-job", { jobTitle, jobRequest });
}

export async function verifyAttempt(
  totalTests: number,
  attempt: number,
  seed: number
): Promise<{ attempt: VerifierAttempt; totalAttempts: number }> {
  return postJson<{ attempt: VerifierAttempt; totalAttempts: number }>(
    "/verify",
    { totalTests, attempt, seed }
  );
}

export async function health(): Promise<{
  ok: boolean;
  hasKey: boolean;
  model: string;
}> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
