import {
  pgTable,
  text,
  integer,
  bigint,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema for ProofOfWorkPay — 5 tables.
 * This is the source of truth for the DB; scripts/apply-schema.ts mirrors it
 * in raw SQL because there is no drizzle-kit and no local Postgres.
 */

export const jobStateEnum = pgEnum("job_state", [
  "DRAFT",
  "LOCKED",
  "IN_PROGRESS",
  "SUBMITTED",
  "VERIFYING",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
]);

export const authorModeEnum = pgEnum("author_mode", ["manual", "agent"]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "pass",
  "fail",
]);

export const verdictResultEnum = pgEnum("verdict_result", ["pass", "fail"]);

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  state: jobStateEnum("state").notNull().default("DRAFT"),
  buyerId: text("buyer_id").notNull(),
  requestText: text("request_text").notNull(),
  title: text("title").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  testSuiteHash: text("test_suite_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const testSuites = pgTable("test_suites", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  version: integer("version").notNull(),
  testsJson: jsonb("tests_json").notNull(),
  suiteHash: text("suite_hash").notNull(),
  authorMode: authorModeEnum("author_mode").notNull().default("manual"),
  frozenAt: timestamp("frozen_at", { withTimezone: true }),
});

export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  attemptNo: integer("attempt_no").notNull(),
  deliverableJson: jsonb("deliverable_json").notNull(),
  status: submissionStatusEnum("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verdicts = pgTable("verdicts", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id")
    .notNull()
    .references(() => submissions.id),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  result: verdictResultEnum("result").notNull(),
  testsRun: integer("tests_run").notNull(),
  testsPassed: integer("tests_passed").notNull(),
  resultsJson: jsonb("results_json").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  type: text("type").notNull(),
  payloadJson: jsonb("payload_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type TestSuite = typeof testSuites.$inferSelect;
export type NewTestSuite = typeof testSuites.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type Verdict = typeof verdicts.$inferSelect;
export type NewVerdict = typeof verdicts.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
