/**
 * worker.ts — the "doer" agent.
 *
 * `runWorker(requestText, suite, failures?)` asks an LLM to produce a
 * JavaScript deliverable (a CommonJS `module.exports = { ... }` object of pure
 * functions) that passes the frozen test suite. It is self-correcting: when
 * `failures` is supplied (the failing `TestResult[]` from a previous verdict),
 * those exact failures — name, input, expected, actual, error — are fed back to
 * the model with an instruction to fix ONLY the failing functions while
 * preserving the passing ones.
 *
 * Defensive by design:
 *   - markdown code fences are stripped if present
 *   - output is validated to be non-empty and contain `module.exports`
 *   - ANY failure (model down, timeout, empty output, missing `module.exports`)
 *     throws a descriptive Error — there is NO hardcoded/canned fallback, so
 *     the autopilot can record the failure and retry, and the caller surfaces it
 *     honestly instead of silently shipping a wrong-but-valid-looking answer.
 */
import { generateText } from "ai";
import type { TestSuite, TestResult } from "@powp/shared";
import { workerModel, callWithTimeout } from "./provider.js";

const SYSTEM_PROMPT = [
  "You are a worker agent in a proof-of-work marketplace.",
  "Produce a JavaScript module (CommonJS):",
  "  module.exports = { functionName: (input) => output }",
  "that passes the given tests. Return ONLY the code — no markdown fences, no explanation.",
  "",
  "Rules:",
  "- Write pure, deterministic functions (no Math.random, no Date, no network, no require/process).",
  "- Handle edge cases implied by the tests (empty input, types, nulls).",
  "- Export EXACTLY the function names the tests call; use module.exports = { ... }.",
].join("\n");

/** Strip ```js / ``` / ```javascript / ```ts fences and surrounding whitespace. */
function stripFences(text: string): string {
  let out = text.trim();
  out = out.replace(/^```(?:js|javascript|ts|typescript|node)?\s*/i, "");
  out = out.replace(/\s*```\s*$/, "");
  return out.trim();
}

/** Render a single failing TestResult into a compact, model-friendly line. */
function formatFailure(r: TestResult, name?: string, fn?: string): string {
  const parts: string[] = [];
  if (name) parts.push(`name: ${name}`);
  if (fn) parts.push(`function: ${fn}`);
  parts.push(`input: ${JSON.stringify(r.input)}`);
  parts.push(`expected: ${JSON.stringify(r.expected)}`);
  parts.push(`actual: ${JSON.stringify(r.actual)}`);
  if (r.error) parts.push(`error: ${r.error}`);
  return parts.join("\n");
}

export async function runWorker(
  requestText: string,
  suite: TestSuite,
  failures?: TestResult[]
): Promise<string> {
  const failing = (failures ?? []).filter((r) => !r.pass);
  // Map test id -> test case so the feedback can name the failing function.
  const testById = new Map(suite.tests.map((t) => [t.id, t]));

  const promptParts: string[] = [];
  promptParts.push(`Request: ${requestText}`);
  promptParts.push("");
  promptParts.push("The FULL frozen test suite you must pass (JSON):");
  promptParts.push(JSON.stringify(suite.tests, null, 2));

  if (failing.length > 0) {
    promptParts.push("");
    promptParts.push("=== Previous attempt failed these tests ===");
    promptParts.push(
      "Fix ONLY the failing functions below. Preserve the passing functions " +
        "exactly as they are — do not regress them."
    );
    for (const r of failing) {
      const t = testById.get(r.testId);
      promptParts.push("");
      promptParts.push(`- ${formatFailure(r, t?.name, t?.function)}`);
    }
    promptParts.push("");
    promptParts.push("Re-read the full test suite above, then return the corrected module.exports.");

    console.log(
      `[worker] retry feedback for job ${suite.jobId} — failing tests:`,
      failing.map((r) => r.testId).join(", ")
    );
  }

  console.log(
    `[worker] authoring deliverable for job ${suite.jobId} — attempt ${(failures?.length ?? 0) + 1}`
  );

  const { text } = await callWithTimeout(() =>
    generateText({
      model: workerModel(),
      system: SYSTEM_PROMPT,
      prompt: promptParts.join("\n"),
    })
  );

  const code = stripFences(text);
  if (!code) {
    throw new Error("Worker produced empty output");
  }
  if (!/module\.exports/.test(code)) {
    throw new Error("Worker output was missing module.exports");
  }
  return code;
}
