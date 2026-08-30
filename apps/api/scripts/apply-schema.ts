/**
 * apply-schema.ts
 * ---------------
 * Creates the 5 ProofOfWorkPay tables in Supabase using raw SQL
 * (CREATE TABLE IF NOT EXISTS). There is NO drizzle-kit and NO local
 * Postgres, so this script is what actually creates the tables.
 *
 * It mirrors apps/api/src/db/schema.ts exactly.
 *
 * Usage:
 *   node --import tsx apps/api/scripts/apply-schema.ts
 *   # or, from the repo root: pnpm db:apply
 *
 * Env (reads process.env, falling back to the verified Supabase pooler):
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL
 */
import pg from "pg";

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

const STATIC_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  state text NOT NULL DEFAULT 'DRAFT',
  buyer_id text NOT NULL,
  request_text text NOT NULL,
  title text NOT NULL,
  amount_cents bigint NOT NULL,
  stripe_payment_intent_id text,
  test_suite_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_suites (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id),
  version integer NOT NULL,
  tests_json jsonb NOT NULL,
  suite_hash text NOT NULL,
  author_mode text NOT NULL DEFAULT 'manual',
  frozen_at timestamptz
);

CREATE TABLE IF NOT EXISTS submissions (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id),
  attempt_no integer NOT NULL,
  deliverable_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verdicts (
  id text PRIMARY KEY,
  submission_id text NOT NULL REFERENCES submissions(id),
  job_id text NOT NULL REFERENCES jobs(id),
  result text NOT NULL,
  tests_run integer NOT NULL,
  tests_passed integer NOT NULL,
  results_json jsonb NOT NULL,
  evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id),
  type text NOT NULL,
  payload_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query(STATIC_SCHEMA_SQL);

    const res = await client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('jobs','test_suites','submissions','verdicts','events')
        ORDER BY table_name`
    );
    const tables = res.rows.map((r) => r.table_name);
    console.log("[apply-schema] tables present:", tables.join(", "));

    const expected = ["events", "jobs", "submissions", "test_suites", "verdicts"];
    const missing = expected.filter((t) => !tables.includes(t));
    if (missing.length > 0) {
      console.error("[apply-schema] MISSING TABLES:", missing.join(", "));
      process.exitCode = 1;
      return;
    }
    console.log("[apply-schema] OK — all 5 tables exist.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error("[apply-schema] FAILED:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
