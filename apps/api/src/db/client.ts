import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

/**
 * Build a pg Pool from env vars. Uses the Supabase connection pooler by
 * default (host aws-0-ap-southeast-1.pooler.supabase.com:6543) — the direct
 * 5432 host is IPv6-only and unreachable from this machine.
 *
 * DB_* vars are the raw connection pieces so the pooler stays explicit.
 * PASSWORD contains a literal @ and must be passed as a plain string (never
 * URL-encoded inside a connection string).
 */
export function createPool(): pg.Pool {
  const ssl =
    process.env.DB_SSL === "false"
      ? false
      : { rejectUnauthorized: false };

  return new pg.Pool({
    host: process.env.DB_HOST ?? "aws-0-ap-southeast-1.pooler.supabase.com",
    port: Number(process.env.DB_PORT ?? 6543),
    user: process.env.DB_USER ?? "postgres.dllsfylmavamgctbjtoz",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "postgres",
    ssl,
    max: 10,
  });
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { schema };
