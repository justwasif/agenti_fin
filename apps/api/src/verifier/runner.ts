import ivm from "isolated-vm";
import { createHash } from "node:crypto";
import type { TestSuite, TestResult, Verdict } from "@powp/shared";

/**
 * Canonical JSON over a value (keys sorted recursively, no whitespace).
 * Mirrors @powp/shared.canonicalJson so the evidence hash is stable and
 * reproducible — same results array in any order → same hash.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}

/**
 * Sandboxed structural deep-equality helper. Injected into the isolate so the
 * comparison itself runs inside the sandbox and never needs host globals.
 */
const deepEqualSource = `
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}
`;

/**
 * The DETERMINISTIC verifier. No LLM, no network, no filesystem, no timers.
 *
 * `deliverable` is a JS module string that assigns functions onto `module.exports`.
 * Each test in `suite.tests` names an exported function (`function`) to call with
 * `input`; the result is structurally compared against `expected`.
 *
 * The deliverable runs inside a fresh isolated-vm isolate with a 64MB memory cap
 * and a 5s execution timeout. Only `testsJson` and `deliverableSource` are exposed —
 * `require`, `process`, `fetch`, `fs`, `timers`, `Math.random` and `Date` are NOT
 * available, so a malicious deliverable cannot reach the host or leave the sandbox.
 */
export async function runTests(
  deliverable: string,
  suite: TestSuite
): Promise<Verdict> {
  const isolate = new ivm.Isolate({ memoryLimit: 64 });
  const context = await isolate.createContext();
  const results: TestResult[] = [];

  try {
    const host = context.global;
    await host.set("testsJson", JSON.stringify(suite.tests));
    await host.set("deliverableSource", deliverable);

    const harness = `
      ${deepEqualSource}
      const deliverable = (() => {
        const module = { exports: {} };
        const fn = new Function("module", "exports", deliverableSource);
        fn(module, module.exports);
        return module.exports || {};
      })();
      const tests = JSON.parse(testsJson);
      const results = [];
      for (const t of tests) {
        try {
          const actual = deliverable[t.function](t.input);
          results.push({ testId: t.id, pass: deepEqual(actual, t.expected), input: t.input, expected: t.expected, actual });
        } catch (e) {
          results.push({ testId: t.id, pass: false, input: t.input, expected: t.expected, actual: undefined, error: String(e && e.message || e) });
        }
      }
      results;
    `;

    const script = await isolate.compileScript(harness, { filename: "harness.js" });
    // `copy: true` deep-copies the returned array out of the isolate; without it,
    // a plain object/array is not a transferable return value and run() yields undefined.
    const json = (await script.run(context, {
      timeout: 5000,
      copy: true,
    })) as unknown as TestResult[];

    if (Array.isArray(json)) {
      for (const r of json) {
        results.push({
          testId: String(r?.testId ?? "?"),
          pass: Boolean(r?.pass),
          input: r?.input,
          expected: r?.expected,
          actual: r?.actual,
          error: typeof r?.error === "string" ? r.error : undefined,
        });
      }
    } else {
      throw new Error("harness returned a non-array value");
    }
  } catch (e) {
    // A thrown error here means the isolate itself failed — e.g. a cheat attempt
    // (require('fs')), a syntax error, or a timeout. Surface it as a failing
    // result instead of crashing the caller.
    const msg = String((e as Error)?.message ?? e);
    results.push({
      testId: "__harness__",
      pass: false,
      input: undefined,
      expected: undefined,
      actual: undefined,
      error: msg,
    });
  } finally {
    isolate.dispose();
  }

  const passed = results.filter((r) => r.pass).length;
  const verdict: Verdict = {
    result:
      passed === suite.tests.length && results.length === suite.tests.length
        ? "pass"
        : "fail",
    testsRun: results.length,
    testsPassed: passed,
    results,
    evidenceHash: createHash("sha256").update(canonicalJson(results)).digest("hex"),
  };
  return verdict;
}
