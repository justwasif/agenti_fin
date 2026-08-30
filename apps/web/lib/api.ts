import type {
  CreateJobInput,
  Job,
  JobDetail,
  ProposedTests,
  RunResult,
  TestsRequest,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

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
    request<ProposedTests | { tests: unknown[] }>(`/api/jobs/${id}/tests`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** POST /api/jobs/:id/tests/freeze */
  freezeTests: (id: string) =>
    request<{ ok: boolean }>(`/api/jobs/${id}/tests/freeze`, { method: "POST" }),

  /** POST /api/jobs/:id/run -> {verdict} */
  runJob: (id: string) =>
    request<RunResult>(`/api/jobs/${id}/run`, { method: "POST" }),

  /** POST /api/jobs/:id/verify -> dispute replay */
  verifyJob: (id: string) =>
    request<RunResult>(`/api/jobs/${id}/verify`, { method: "POST" }),
};

export { API_BASE };
