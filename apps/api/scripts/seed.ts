/**
 * seed.ts
 * -------
 * Inserts demo data: one DRAFT job + its frozen test_suite.
 * Mock/test-mode data only.
 *
 * Usage:
 *   DB_PASSWORD='...' node --import tsx apps/api/scripts/seed.ts
 *   # or from repo root: pnpm db:seed
 *
 * Idempotent-ish: uses ON CONFLICT DO NOTHING so re-running won't duplicate
 * the same rows (keys are stable demo ids).
 */
import pg from "pg";
import { createTestSuiteHash, type TestCase } from "@powp/shared";

const pool = new pg.Pool({
  host: process.env.DB_HOST ?? "aws-0-ap-southeast-1.pooler.supabase.com",
  port: Number(process.env.DB_PORT ?? 6543),
  user: process.env.DB_USER ?? "postgres.dllsfylmavamgctbjtoz",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "postgres",
  ssl:
    process.env.DB_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
});

const DEMO_JOB_ID = "demo-job-0001";
const DEMO_SUITE_ID = "demo-suite-0001";

const demoTests: TestCase[] = [
  {
    id: "demo-test-0001",
    name: "capitalize first letter",
    function: "capitalize",
    input: "hello world",
    expected: "Hello world",
  },
  {
    id: "demo-test-0002",
    name: "sum of two numbers",
    function: "add",
    input: { a: 2, b: 3 },
    expected: 5,
  },
];

async function main() {
  const client = await pool.connect();
  try {
    const suiteHash = createTestSuiteHash(demoTests);

    await client.query(
      `INSERT INTO jobs
         (id, state, buyer_id, request_text, title, amount_cents, test_suite_hash)
       VALUES
         ($1, 'DRAFT', $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        DEMO_JOB_ID,
        "demo-buyer-0001",
        "Write a pure TypeScript utility module with `capitalize` and `add` functions.",
        "Demo: pure utility functions",
        5000,
        suiteHash,
      ]
    );

    await client.query(
      `INSERT INTO test_suites
         (id, job_id, version, tests_json, suite_hash, author_mode, frozen_at)
       VALUES
         ($1, $2, $3, $4::jsonb, $5, 'manual', now())
       ON CONFLICT (id) DO NOTHING`,
      [
        DEMO_SUITE_ID,
        DEMO_JOB_ID,
        1,
        JSON.stringify(demoTests),
        suiteHash,
      ]
    );

    const { rows } = await client.query(
      `SELECT id, state, title, test_suite_hash FROM jobs WHERE id = $1`,
      [DEMO_JOB_ID]
    );
    console.log("[seed] job row:", JSON.stringify(rows[0]));

    const suiteRes = await client.query(
      `SELECT id, job_id, version, suite_hash, author_mode FROM test_suites WHERE id = $1`,
      [DEMO_SUITE_ID]
    );
    console.log("[seed] test_suite row:", JSON.stringify(suiteRes.rows[0]));
    console.log("[seed] OK — seeded 1 DRAFT job + frozen test_suite.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error("[seed] FAILED:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
