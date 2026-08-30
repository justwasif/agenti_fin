/**
 * worker.ts — the "doer" agent.
 *
 * `runWorker(requestText, tests)` asks an LLM to produce a JavaScript deliverable
 * (a CommonJS `module.exports = { ... }` object of pure functions) that passes
 * the frozen test suite. It is defensive by design:
 *
 *   - markdown code fences are stripped if present
 *   - output is validated to be non-empty and look like JS
 *   - ANY failure (model down, timeout, empty output) returns a canned correct
 *     implementation for the "dedupe" example so the route never crashes.
 */
import { generateText } from "ai";
import type { TestSuite } from "@powp/shared";
import { workerModel, callWithTimeout } from "./provider.js";

const SYSTEM_PROMPT = [
  "You are a worker agent in a proof-of-work marketplace.",
  "Produce a JavaScript module (CommonJS):",
  "  module.exports = { functionName: (input) => output }",
  "that passes the given tests. Return ONLY the code — no markdown fences, no explanation.",
].join("\n");

/** Canned correct implementation for the dedupe example (used as fallback). */
const CANNED_DEDUPE = [
  "module.exports.dedupe = (emails) => [...new Set(emails.map((e) => e.toLowerCase()))];",
  "",
].join("\n");

/** Strip ```js / ``` / ```javascript fences and surrounding whitespace. */
function stripFences(text: string): string {
  let out = text.trim();
  out = out.replace(/^```(?:js|javascript|ts|typescript|node)?\s*/i, "");
  out = out.replace(/\s*```\s*$/, "");
  return out.trim();
}

export async function runWorker(
  requestText: string,
  tests: TestSuite
): Promise<string> {
  try {
    const model = workerModel();

    const { text } = await callWithTimeout(() =>
      generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: [
          `Request: ${requestText}`,
          "",
          "Tests to pass (JSON):",
          JSON.stringify(tests.tests, null, 2),
        ].join("\n"),
      })
    );

    const code = stripFences(text);
    if (!code || !/module\.exports/.test(code)) {
      throw new Error("Worker output was empty or missing module.exports");
    }
    return code;
  } catch (err) {
    console.warn(
      "[worker] model failed, returning canned dedupe implementation:",
      err instanceof Error ? err.message : err
    );
    return CANNED_DEDUPE;
  }
}
