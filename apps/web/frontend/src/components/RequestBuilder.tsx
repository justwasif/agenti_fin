import { useState } from "react";
import type { DemoState } from "../App";

interface Props {
  demoState: DemoState;
  onCreate: (title: string, request: string, budget: number) => void;
}

const DEFAULT_TITLE = "Clean Customer Email List";

const DEFAULT_REQUEST = `Write a JavaScript function named cleanEmails(emails) that:
- Trims leading and trailing whitespace from each email
- Lowercases each email after trimming
- Removes duplicates after normalization (deduplication is case- and whitespace-insensitive)
- Preserves first-seen order (keep the first occurrence, discard later duplicates)
- Ignores blank or whitespace-only values entirely
- Returns an empty array [] when given an empty input array

Example:
  Input:  [" Alice@Example.com ", "alice@example.com", "BOB@example.com", " "]
  Output: ["alice@example.com", "bob@example.com"]

The function must handle all edge cases: mixed case, extra spaces, duplicate emails in different cases, and arrays containing only blank strings.`;

const DEFAULT_BUDGET = 100;

export const JOB_STORAGE_KEY = "powp-job-context";

export function loadJobContext(): { title: string; request: string; budget: number } {
  if (typeof window === "undefined") {
    return { title: DEFAULT_TITLE, request: DEFAULT_REQUEST, budget: DEFAULT_BUDGET };
  }
  try {
    const raw = sessionStorage.getItem(JOB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.title === "string" && typeof parsed.request === "string") {
        return {
          title: parsed.title || DEFAULT_TITLE,
          request: parsed.request || DEFAULT_REQUEST,
          budget: Number(parsed.budget) || DEFAULT_BUDGET,
        };
      }
    }
  } catch {
    // fall through
  }
  return { title: DEFAULT_TITLE, request: DEFAULT_REQUEST, budget: DEFAULT_BUDGET };
}

function saveJobContext(title: string, request: string, budget: number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(JOB_STORAGE_KEY, JSON.stringify({ title, request, budget }));
    window.dispatchEvent(new Event("powp-job-context-changed"));
  } catch {
    // ignore
  }
}

export default function RequestBuilder({ demoState, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [request, setRequest] = useState("");
  const [budget, setBudget] = useState<number | "">("");

  const isLocked = demoState !== "idle";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalTitle = title.trim() || DEFAULT_TITLE;
    const finalRequest = request.trim() || DEFAULT_REQUEST;
    const finalBudget =
      typeof budget === "number" && budget > 0 ? budget : DEFAULT_BUDGET;
    saveJobContext(finalTitle, finalRequest, finalBudget);
    onCreate(finalTitle, finalRequest, finalBudget);
  }

  return (
    <section className="card fade-in">
      {/* Step header */}
      <div className="step-label" style={{ marginBottom: 16 }}>
        <span className={`step-num ${isLocked ? "done" : ""}`}>
          {isLocked ? "✓" : "1"}
        </span>
        <span>Create Job Request</span>
        {isLocked && (
          <span className="badge badge-green" style={{ marginLeft: "auto" }}>
            Draft created
          </span>
        )}
      </div>

      <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
        Describe the work you need done and set your budget. Funds are held in
        escrow and released only on verified proof of delivery.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-subtle)",
              marginBottom: 6,
            }}
          >
            title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLocked}
            placeholder="e.g. Clean Customer Email List"
            style={{ opacity: isLocked ? 0.6 : 1 }}
          />
        </div>

        {/* Request body */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-subtle)",
              marginBottom: 6,
            }}
          >
            Request / specification
          </label>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            disabled={isLocked}
            rows={10}
            placeholder="Describe the function or task in detail…"
            style={{
              opacity: isLocked ? 0.6 : 1,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: 12.5,
              lineHeight: 1.7,
              resize: "none",
            }}
          />
        </div>

        {/* Budget */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-subtle)",
              marginBottom: 6,
            }}
          >
            Budget{" "}
            <span
              style={{ fontWeight: 400, color: "var(--text-muted)" }}
            >
              (cents · $1.00 = 100)
            </span>
          </label>
          <div style={{ position: "relative", maxWidth: 160 }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                fontSize: 13,
                pointerEvents: "none",
              }}
            >
              ¢
            </span>
            <input
              type="number"
              min={1}
              value={budget}
              onChange={(e) =>
                setBudget(e.target.value === "" ? "" : Number(e.target.value))
              }
              disabled={isLocked}
              style={{
                paddingLeft: 28,
                opacity: isLocked ? 0.6 : 1,
                maxWidth: 160,
              }}
            />
          </div>
          <p
            className="text-muted text-xs"
            style={{ marginTop: 4 }}
          >
            =${((typeof budget === "number" && budget > 0 ? budget : DEFAULT_BUDGET) / 100).toFixed(2)} — held in escrow, released only on
            proof
          </p>
        </div>

        {/* CTA */}
        {!isLocked && (
          <button
            type="submit"
            className="btn"
          >
            Create DRAFT job →
          </button>
        )}
      </form>
    </section>
  );
}
