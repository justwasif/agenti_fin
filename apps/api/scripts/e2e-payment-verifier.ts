/**
 * e2e-payment-verifier.ts
 * -----------------------
 * Full "no proof, no pay" money-moment proof, end to end:
 *
 *   1. Create a TEMP job + frozen test_suite in Supabase (unique, env-only IDs
 *      so we never collide with or pollute the seed data).
 *   2. Stripe: create a manual-capture PaymentIntent, confirm with pm_card_visa
 *      → assert status `requires_capture` (money held, NOT charged).
 *   3. Verify a deliberately BAD `dedupe` deliverable → assert `fail`.
 *   4. Verify a CORRECT deliverable → assert `pass` (flips job to CAPTURED,
 *      writes VERIFIED event).
 *   5. ONLY THEN capture the PaymentIntent → assert `succeeded`.
 *
 * Secrets are read from process.env only — STRIPE_SECRET_KEY and DB_* vars.
 * No secret is ever printed.
 *
 * Run (from apps/api):
 *   set -a; source ../../test_env.env; set +a
 *   export DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... DB_SSL=true
 *   export STRIPE_SECRET_KEY="$strip_secret_key"
 *   node --import tsx scripts/e2e-payment-verifier.ts
 */
import { createPool } from "../src/db/index.js";
import { createTestSuiteHash, type TestCase } from "@powp/shared";
import {
  createPaymentIntent,
  confirmPaymentIntent,
  capturePaymentIntent,
} from "../src/stripe/payment.js";
import { verifyJob } from "../src/verifier/verify.js";

// Unique, identifiable IDs for this run's temp data (timestamp + random suffix).
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const JOB_ID = `e2e-job-${stamp}`;
const SUITE_ID = `e2e-suite-${stamp}`;

const dedupeTests: TestCase[] = [
  {
    id: "e2e-t1",
    name: "dedupe mixed case",
    function: "dedupe",
    input: ["A", "a", "b"],
    expected: ["a", "b"],
  },
  {
    id: "e2e-t2",
    name: "dedupe empty",
    function: "dedupe",
    input: [],
    expected: [],
  },
];

const suiteHash = createTestSuiteHash(dedupeTests);

const BAD = "module.exports.dedupe = (emails) => emails"; // does NOT dedupe
const GOOD =
  "module.exports.dedupe = (emails) => [...new Set(emails.map(e=>e.toLowerCase()))]";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

const pool = createPool();

async function main() {
  console.log(`[e2e] job=${JOB_ID} suite=${SUITE_ID} suiteHash=${suiteHash}`);

  // 0. Seed a temp job + frozen suite (unique ids).
  await pool.query(
    `INSERT INTO jobs (id, state, buyer_id, request_text, title, amount_cents, test_suite_hash)
     VALUES ($1, 'LOCKED', $2, $3, $4, $5, $6)`,
    [JOB_ID, "e2e-buyer", "dedupe an email list", "e2e dedupe", 2500, suiteHash]
  );
  await pool.query(
    `INSERT INTO test_suites (id, job_id, version, tests_json, suite_hash, author_mode, frozen_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, 'manual', now())`,
    [SUITE_ID, JOB_ID, 1, JSON.stringify(dedupeTests), suiteHash]
  );

  // 1. Create a manual-capture PaymentIntent (authorization hold = native escrow).
  const pi = await createPaymentIntent(2500);
  console.log(
    `[stripe] created   id=${pi.id} status=${pi.status} amount=${pi.amount} capture_method=${pi.capture_method}`
  );

  // 2. Confirm with the canonical test card → authorized but NOT charged.
  const confirmed = await confirmPaymentIntent(pi.id, "pm_card_visa");
  console.log(`[stripe] confirmed id=${confirmed.id} status=${confirmed.status}`);
  assert(
    confirmed.status === "requires_capture",
    `confirm should be requires_capture, got ${confirmed.status}`
  );

  // 3. Verify a BAD deliverable → must fail (no capture yet).
  const badVerdict = await verifyJob(JOB_ID, BAD);
  console.log(
    `[verify] bad  result=${badVerdict.result} testsRun=${badVerdict.testsRun} testsPassed=${badVerdict.testsPassed} evidenceHash=${badVerdict.evidenceHash}`
  );
  assert(badVerdict.result === "fail", "bad deliverable must yield fail verdict");

  // 4. Verify the CORRECT deliverable → must pass.
  const goodVerdict = await verifyJob(JOB_ID, GOOD);
  console.log(
    `[verify] good result=${goodVerdict.result} testsRun=${goodVerdict.testsRun} testsPassed=${goodVerdict.testsPassed} evidenceHash=${goodVerdict.evidenceHash}`
  );
  assert(goodVerdict.result === "pass", "good deliverable must yield pass verdict");

  // 5. Only after a PASS verdict do we capture (the actual charge).
  const captured = await capturePaymentIntent(pi.id);
  console.log(`[stripe] captured id=${captured.id} status=${captured.status}`);
  assert(captured.status === "succeeded", `capture should be succeeded, got ${captured.status}`);

  console.log("\n[e2e-payment-verifier] OK — hold → verify(fail) → verify(pass) → capture, all green");
}

main()
  .catch((err) => {
    console.error("[e2e-payment-verifier] FAILED:", (err as Error).message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Best-effort cleanup of the temp rows we created (unique ids).
    try {
      await pool.query(`DELETE FROM events WHERE job_id = $1`, [JOB_ID]);
      await pool.query(`DELETE FROM verdicts WHERE job_id = $1`, [JOB_ID]);
      await pool.query(`DELETE FROM submissions WHERE job_id = $1`, [JOB_ID]);
      await pool.query(`DELETE FROM test_suites WHERE id = $1`, [SUITE_ID]);
      await pool.query(`DELETE FROM jobs WHERE id = $1`, [JOB_ID]);
      console.log(`[e2e] cleaned up temp rows for ${JOB_ID}`);
    } catch (cleanupErr) {
      console.error("[e2e] cleanup warning:", (cleanupErr as Error).message ?? cleanupErr);
    } finally {
      await pool.end();
    }
  });
