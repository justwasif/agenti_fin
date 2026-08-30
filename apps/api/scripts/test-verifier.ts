/**
 * test-verifier.ts
 * ----------------
 * Standalone proof of the deterministic sandboxed verifier (runTests).
 * No DB, no Stripe — pure isolated-vm.
 *
 * Proves four things:
 *   1. PASS  — a correct `dedupe` deliverable passes every test.
 *   2. FAIL  — a deliverable that does NOT dedupe fails.
 *   3. CHEAT — a deliverable that calls require('fs') / process.exit(1)
 *              is rejected with a fail verdict (no host access, no crash).
 *   4. TIMEOUT — an infinite loop is killed by the 5000ms timeout (fail, no hang).
 *
 * Run: node --import tsx scripts/test-verifier.ts
 */
import { runTests } from "../src/verifier/runner.js";
import { createTestSuiteHash, type TestCase, type TestSuite } from "@powp/shared";

const dedupeTests: TestCase[] = [
  {
    id: "vt-dedupe-1",
    name: "dedupe mixed case",
    function: "dedupe",
    input: ["A", "a", "b"],
    expected: ["a", "b"],
  },
  {
    id: "vt-dedupe-2",
    name: "dedupe empty",
    function: "dedupe",
    input: [],
    expected: [],
  },
];

function makeSuite(tests: TestCase[]): TestSuite {
  return {
    jobId: "verifier-probe",
    version: 1,
    tests,
    hash: createTestSuiteHash(tests),
  };
}

// 1 — PASS
const passDeliverable =
  "module.exports.dedupe = (emails) => [...new Set(emails.map(e=>e.toLowerCase()))]";
const passVerdict = await runTests(passDeliverable, makeSuite(dedupeTests));
console.log("PASS   ", JSON.stringify(passVerdict));

// 2 — FAIL (no dedupe)
const failDeliverable = "module.exports.dedupe = (emails) => emails";
const failVerdict = await runTests(failDeliverable, makeSuite(dedupeTests));
console.log("FAIL   ", JSON.stringify(failVerdict));

// 3 — CHEAT (require + process at load time)
const cheatDeliverable =
  "const fs = require('fs'); process.exit(1); module.exports.dedupe = (emails) => emails";
const cheatVerdict = await runTests(cheatDeliverable, makeSuite(dedupeTests));
console.log("CHEAT  ", JSON.stringify(cheatVerdict));

// 4 — TIMEOUT (infinite loop inside the function body)
const loopDeliverable = "module.exports.dedupe = (emails) => { while(true){} }";
const loopVerdict = await runTests(loopDeliverable, makeSuite(dedupeTests));
console.log("TIMEOUT", JSON.stringify(loopVerdict));

// Assertions
const passOk = passVerdict.result === "pass" && passVerdict.testsPassed === dedupeTests.length;
const failOk = failVerdict.result === "fail";
const cheatOk =
  cheatVerdict.result === "fail" &&
  cheatVerdict.results.some((r) => /require|process/i.test(r.error ?? ""));
const loopOk =
  loopVerdict.result === "fail" &&
  loopVerdict.results.some((r) => /timed out/i.test(r.error ?? ""));

const allOk = passOk && failOk && cheatOk && loopOk;
console.log(
  allOk
    ? "\n[test-verifier] OK — pass/fail/cheat/timeout all behave deterministically"
    : "\n[test-verifier] FAILED"
);
if (!allOk) process.exit(1);
