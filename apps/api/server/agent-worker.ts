/**
 * Worker Agent (Agent #2)
 *
 * Reads the buyer's job request and produces the actual deliverable.
 * The output is INDEPENDENT of the test cases (the worker doesn't grade
 * itself). The frontend's verifier will simulate pass/fail against the
 * test suite from Agent #1 — but the worker's output here is real.
 *
 * The shape of the output is inferred from the request:
 *   - If the request mentions a function, return a code block.
 *   - If the request mentions a list/dataset, return JSON array.
 *   - Default: return a short markdown answer.
 */
import { generate } from "./gemini.js";

export interface WorkerResult {
  kind: "code" | "json" | "markdown";
  language?: string;     // for kind=code
  output: string;        // the deliverable text
  notes?: string;        // short explanation
  source: "gemini" | "fallback";
}

const SYSTEM_PROMPT = `You are an expert AI worker that completes a buyer's job.
- Produce a complete, runnable deliverable.
- If the job is a function, return the function's source code (no surrounding prose).
- If the job produces data, return only the data as a JSON array.
- Otherwise, return a concise markdown answer.
- Do NOT include any meta-commentary or preambles.`;

function userPrompt(jobTitle: string, jobRequest: string, attempt: number): string {
  const attemptNote = attempt > 1 ? `\n\n(Attempt ${attempt}: the verifier found issues earlier — please re-deliver, considering typical edge cases like case-insensitivity, whitespace trimming, and dedup.)` : "";
  return `Job title: ${jobTitle}

Buyer's request (verbatim):
"""${jobRequest}"""${attemptNote}

Respond in EXACTLY this JSON shape:
{
  "kind": "code" | "json" | "markdown",
  "language": "javascript" | "python" | "typescript" | "json" | "markdown" | null,
  "output": "<the deliverable — function source / JSON array / short markdown>",
  "notes": "one short sentence on what you delivered"
}`;
}

export async function runWorker(
  jobTitle: string,
  jobRequest: string,
  attempt: number
): Promise<WorkerResult> {
  try {
    const { json, text } = await generate({
      system: SYSTEM_PROMPT,
      user: userPrompt(jobTitle, jobRequest, attempt),
      json: true,
      temperature: 0.6,
      maxOutputTokens: 1500,
    });

    const data = (json as any) ?? safeParse(text);
    if (!data || typeof data.output !== "string") {
      throw new Error("Worker returned no `output` field");
    }

    return {
      kind: (data.kind as any) ?? "markdown",
      language: data.language ?? undefined,
      output: String(data.output),
      notes: data.notes,
      source: "gemini",
    };
  } catch (err) {
    console.warn("[runWorker] Gemini failed, using fallback:", (err as Error).message);
    return { ...fallbackWorker(jobRequest), source: "fallback" };
  }
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}

function fallbackWorker(jobRequest: string): Omit<WorkerResult, "source"> {
  // very basic heuristic fallback: return a cleanEmails function if the
  // request looks like the demo's email-cleansing example
  const lower = jobRequest.toLowerCase();
  if (lower.includes("email")) {
    return {
      kind: "code",
      language: "javascript",
      output:
        "function cleanEmails(emails) {\n" +
        "  if (!Array.isArray(emails)) return [];\n" +
        "  const seen = new Set();\n" +
        "  const out = [];\n" +
        "  for (const raw of emails) {\n" +
        "    if (typeof raw !== 'string') continue;\n" +
        "    const trimmed = raw.trim();\n" +
        "    if (trimmed.length === 0) continue;\n" +
        "    const norm = trimmed.toLowerCase();\n" +
        "    if (seen.has(norm)) continue;\n" +
        "    seen.add(norm);\n" +
        "    out.push(norm);\n" +
        "  }\n" +
        "  return out;\n" +
        "}",
      notes: "Fallback deliverable (no Gemini key set).",
    };
  }
  return {
    kind: "markdown",
    output:
      "No Gemini API key configured. Set GEMINI_API_KEY in server/.env to get a real deliverable.",
    notes: "Fallback (no key).",
  };
}
