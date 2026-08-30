import type {
  CreateJobInput,
  Job,
  JobDetail,
  FreezeResult,
  ProposedTests,
  TestCase,
  RunResult,
  TestsRequest,
} from "./types";

const EXTERNAL_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/**
 * Browser calls use Next's same-origin rewrite, avoiding a CORS dependency in
 * the Hono demo. Server-side callers retain the configured external base.
 */
const API_BASE = typeof window === "undefined" ? EXTERNAL_API_BASE : "/backend";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

export const api = {
  /** POST /api/jobs {title, requestText, amountCents, buyerId} */
  createJob: (input: CreateJobInput) =>
    request<Job>("/api/jobs", { method: "POST", body: JSON.stringify(input) }),

  /** GET /api/jobs */
  listJobs: () => request<Job[]>("/api/jobs"),

  /** GET /api/jobs/:id -> {job, verdicts, events} */
  getJob: (id: string) => request<JobDetail>(`/api/jobs/${id}`),

  /** POST /api/jobs/:id/tests {mode, tests?, requirements?} */
  authorTests: (id: string, body: TestsRequest) =>
    request<ProposedTests | FreezeResult>(`/api/jobs/${id}/tests`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** POST /api/jobs/:id/tests/freeze {tests} */
  freezeTests: (id: string, tests: TestCase[]) =>
    request<FreezeResult>(`/api/jobs/${id}/tests/freeze`, {
      method: "POST",
      body: JSON.stringify({ tests }),
    }),

  /** POST /api/jobs/:id/run {deliverable} -> {verdict} */
  runJob: (id: string, deliverable: string) =>
    request<RunResult>(`/api/jobs/${id}/run`, {
      method: "POST",
      body: JSON.stringify({ deliverable }),
    }),

  /** POST /api/jobs/:id/verify {deliverable} -> verdict replay */
  verifyJob: (id: string, deliverable: string) =>
    request<RunResult>(`/api/jobs/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({ deliverable }),
    }),
};

export { API_BASE };
