/**
 * test-authoring.ts — the "buyer's lawyer" agent.
 *
 * `generateTests(requestText, requirements)` asks an LLM to author a set of
 * executable, deterministic test cases, then validates the output against the
 * shared `TestCase` zod schema. It is defensive by design:
 *
 *   - JSON is fenced/trimmed/parsed defensively
 *   - the parsed array is validated with zod (z.array(TestCase))
 *   - ids/names/functions are normalised so the verifier gets well-formed data
 *   - ANY failure (model down, timeout, invalid JSON, schema mismatch) returns
 *     a built-in deterministic fallback suite (the "dedupe" example) instead of
 *     throwing — this function NEVER throws.
 */
import { generateText } from "ai";
import { TestCase, type TestCase as TestCaseT } from "@powp/shared";
import { testAuthoringModel, callWithTimeout } from "./provider.js";

const SYSTEM_PROMPT = [
  "You are a test-authoring agent for a proof-of-work marketplace.",
  "Generate executable test cases as STRICT JSON matching this schema:",
  '[{ "id": string, "name": string, "function": string, "input": any, "expected": any }]',
  "Each test is a pure function of its input: no network, no randomness, no time, no filesystem.",
  "Output ONLY the JSON array — no markdown fences, no explanation, no trailing commas.",
].join("\n");

/** Deterministic built-in suite returned when the model fails or misbehaves. */
const FALLBACK_TESTS: TestCaseT[] = [
  {
    id: "t1",
    name: "dedupe case-insensitive",
    function: "dedupe",
    input: ["A", "a", "b"],
    expected: ["a", "b"],
  },
  {
    id: "t2",
    name: "empty list",
    function: "dedupe",
    input: [],
    expected: [],
  },
];

/** Strip ```json / ``` / ```js fences and any surrounding whitespace. */
function stripFences(text: string): string {
  let out = text.trim();
  out = out.replace(/^```(?:json|js|javascript|ts)?\s*/i, "");
  out = out.replace(/\s*```\s*$/, "");
  return out.trim();
}

/** Extract the first balanced JSON array from a string that may have prose around it. */
function extractJsonArray(text: string): string {
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No JSON array found in model output");
  }
  return text.slice(first, last + 1);
}

/** Normalise a raw test case into a well-formed TestCase. */
function normaliseTest(raw: unknown, index: number): TestCaseT {
  const obj = raw as Record<string, unknown>;
  return {
    id: typeof obj.id === "string" && obj.id ? obj.id : `gen-test-${index + 1}`,
    name:
      typeof obj.name === "string" && obj.name ? obj.name : `test ${index + 1}`,
    function:
      typeof obj.function === "string" && obj.function
        ? obj.function
        : "solve",
    input: "input" in obj ? obj.input : undefined,
    expected: "expected" in obj ? obj.expected : undefined,
  };
}

export async function generateTests(
  requestText: string,
  requirements: string
): Promise<TestCaseT[]> {
  try {
    const model = testAuthoringModel();
    const { text } = await callWithTimeout(() =>
      generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: [
          `Request: ${requestText}`,
          `Requirements: ${requirements || "(none provided)"}`,
        ].join("\n"),
      })
    );

    const cleaned = stripFences(text);
    const parsed: unknown = JSON.parse(extractJsonArray(cleaned));

    if (!Array.isArray(parsed)) {
      throw new Error("Model output is not an array");
    }

    const normalised = parsed.map(normaliseTest);
    // Validate the whole array with the shared schema. Throws on mismatch.
    const validated = TestCase.array().parse(normalised);

    if (validated.length === 0) {
      throw new Error("Model returned an empty test suite");
    }
    return validated;
  } catch (err) {
    console.warn(
      "[test-authoring] model failed, returning fallback suite:",
      err instanceof Error ? err.message : err
    );
    return FALLBACK_TESTS;
  }
}
