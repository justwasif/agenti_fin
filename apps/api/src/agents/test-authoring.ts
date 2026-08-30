/**
 * test-authoring.ts — the "buyer's lawyer" agent.
 *
 * `generateTests(requestText, requirements)` returns a deterministic, hardcoded
 * set of test cases for the scripted cleanEmails demo. It NEVER calls an LLM —
 * this is a scripted demo, so the same five tests are returned every time after
 * a short simulated "authoring" delay (so the UI shows "Working…").
 *
 * The returned array is still validated with the shared `TestCase` zod schema
 * (`TestCase.array().safeParse`) so the verifier always receives well-formed
 * data — exactly as the live LLM path did. This function NEVER throws: a
 * validation failure (impossible for the hardcoded suite, but defensive) falls
 * back to an empty array.
 */
import { TestCase, type TestCase as TestCaseT } from "@powp/shared";
import { z } from "zod";

/**
 * The five hardcoded cleanEmails tests used by the scripted demo.
 *
 * `cleanEmails(emails: string[])` should: trim each value, lowercase it,
 * ignore blank-only values, drop duplicates (case-insensitive), preserve
 * first-seen order, and return [] for an empty/blank-only input.
 */
const DEMO_TESTS: TestCaseT[] = [
  {
    id: "t1",
    name: "normal + case + trim",
    function: "cleanEmails",
    input: [" Alice@Example.com ", "alice@example.com", "BOB@example.com", " "],
    expected: ["alice@example.com", "bob@example.com"],
  },
  {
    id: "t2",
    name: "empty array",
    function: "cleanEmails",
    input: [],
    expected: [],
  },
  {
    id: "t3",
    name: "blank-only values ignored",
    function: "cleanEmails",
    input: ["  ", "\t", " ", ""],
    expected: [],
  },
  {
    id: "t4",
    name: "order preservation",
    function: "cleanEmails",
    input: ["b@x.com", "A@X.com", "b@x.com", "C@X.com"],
    expected: ["b@x.com", "a@x.com", "c@x.com"],
  },
  {
    id: "t5",
    name: "duplicate/case normalization",
    function: "cleanEmails",
    input: ["a@b.com", "A@B.COM", "a@b.com", "  A@B.com  "],
    expected: ["a@b.com"],
  },
];

export async function generateTests(
  requestText: string,
  requirements: string
): Promise<TestCaseT[]> {
  // Simulated authoring time so the UI shows "Working…".
  await new Promise((r) => setTimeout(r, 2000));

  // Validate the hardcoded suite against the shared schema (defensive — the
  // data is well-formed by construction, but we keep the same validation gate
  // the live LLM path used so the verifier gets identical guarantees).
  const result = z.array(TestCase).safeParse(DEMO_TESTS);
  if (!result.success) {
    console.warn(
      "[test-authoring] hardcoded demo suite failed schema validation:",
      result.error.message
    );
    return [];
  }
  return result.data;
}
