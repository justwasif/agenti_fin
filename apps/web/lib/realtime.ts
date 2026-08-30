import { API_BASE } from "./api";
import type { JobDetail } from "./types";

export type JobUpdate = JobDetail | { events: unknown[]; job?: unknown };

/**
 * Subscribe to a job's event stream via SSE with a 2s polling fallback.
 * Returns an unsubscribe function.
 */
export function subscribeToJob(
  jobId: string,
  onUpdate: (update: JobUpdate) => void,
): () => void {
  let es: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let sseConnected = false;
  let closed = false;

  const poll = async () => {
    if (closed) return;
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      if (res.ok) {
        onUpdate((await res.json()) as JobDetail);
      }
    } catch {
      /* backend not up yet — keep polling silently */
    }
  };

  try {
    es = new EventSource(`${API_BASE}/api/jobs/${jobId}/stream`);
    es.onopen = () => {
      sseConnected = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    es.onmessage = (ev) => {
      try {
        onUpdate(JSON.parse(ev.data) as JobUpdate);
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => {
      if (!sseConnected && !pollTimer) {
        pollTimer = setInterval(poll, 2000);
      }
    };
  } catch {
    // EventSource unsupported / construction threw — fall back to polling.
    pollTimer = setInterval(poll, 2000);
  }

  // Safety: if SSE never opens within a beat, also poll.
  const safety = setTimeout(() => {
    if (!sseConnected && !pollTimer) {
      pollTimer = setInterval(poll, 2000);
    }
  }, 1500);

  return () => {
    closed = true;
    clearTimeout(safety);
    if (es) es.close();
    if (pollTimer) clearInterval(pollTimer);
  };
}
