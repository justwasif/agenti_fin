/**
 * Test-Authoring Agent (Agent #1)
 *
 * Reads the buyer's natural-language job request and proposes
 * 3–7 executable test cases. Each test is a (name, input, expected) triple.
 *
 * Output: { tests: Array<{ id, name, input, expected }> }
 */
import { generate } from "./gemini.js";

export interface ProposedTest {
  id: string;        // "t1".."t7"
  name: string;      // short human label
  input: unknown;    // JSON value
  expected: unknown; // JSON value
}

export interface ProposeTestsResult {
  tests: ProposedTest[];
  reasoning?: string;
  source: "gemini" | "fallback";
}

const SYSTEM_PROMPT = `You are a senior QA engineer that writes deterministic, re-runnable test cases for a buyer request.
- Each test must be a pure function of its input (no network, no randomness).
- Inputs and expected outputs are JSON-serializable values.
- Cover: a normal/happy case, edge cases (empty, blank, duplicates, case variants), and order preservation where relevant.
- Use 3 to 7 tests, no more, no less.
- Do NOT include any prose, commentary, or markdown. Output only valid JSON.`;

function userPrompt(jobTitle: string, jobRequest: string): string {
  return `Job title: ${jobTitle}

Job request (verbatim from buyer):
"""${jobRequest}"""

Return JSON in EXACTLY this shape:
{
  "reasoning": "one short sentence on the coverage strategy",
  "tests": [
    { "id": "t1", "name": "short human label", "input": <any JSON>, "expected": <any JSON> },
    ...
  ]
}`;
}

export async function proposeTests(
  jobTitle: string,
  jobRequest: string
): Promise<ProposeTestsResult> {
  try {
    const { json, text } = await generate({
      system: SYSTEM_PROMPT,
      user: userPrompt(jobTitle, jobRequest),
      json: true,
      temperature: 0.4,
    });

    const data = (json as any) ?? safeParse(text);
    if (!data || !Array.isArray(data.tests)) {
      throw new Error("No `tests` array in model response");
    }

    const tests: ProposedTest[] = data.tests
      .slice(0, 7)
      .map((t: any, i: number) => ({
        id: typeof t.id === "string" ? t.id : `t${i + 1}`,
        name: String(t.name ?? `Test ${i + 1}`).slice(0, 60),
        input: t.input,
        expected: t.expected,
      }));

    if (tests.length < 3) {
      throw new Error("Model returned fewer than 3 tests");
    }

    return { tests, reasoning: data.reasoning, source: "gemini" };
  } catch (err) {
    console.warn("[proposeTests] Gemini failed, using fallback:", (err as Error).message);
    return { tests: fallbackTests(), source: "fallback" };
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

function fallbackTests(): ProposedTest[] {
  // used only if GEMINI_API_KEY is missing or the model returns bad output
  return [
    { id: "t1", name: "normal + case + trim", input: [" Alice@Example.com ", "alice@example.com", "BOB@example.com", " "], expected: ["alice@example.com", "bob@example.com"] },
    { id: "t2", name: "empty array", input: [], expected: [] },
    { id: "t3", name: "blank-only values ignored", input: ["  ", "\t", " ", ""], expected: [] },
    { id: "t4", name: "order preservation", input: ["b@x.com", "A@X.com", "b@x.com", "C@X.com"], expected: ["b@x.com", "a@x.com", "c@x.com"] },
    { id: "t5", name: "duplicate/case normalization", input: ["a@b.com", "A@B.COM", "a@b.com", "  A@B.com  "], expected: ["a@b.com"] },
  ];
}
