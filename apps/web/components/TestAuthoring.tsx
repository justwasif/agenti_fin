"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AuthorMode, TestCase, TestPreview } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Tabs } from "@/components/ui/Tabs";

const SAMPLE_INPUTS: Record<string, unknown> = {
  add: { a: 2, b: 3 },
  clamp: { value: 42, min: 0, max: 10 },
  slugify: { text: "Hello World!" },
};

/**
 * Pre-flight sanity preview: run a test's `function` name against a tiny
 * deterministic local implementation to show "would PASS/FAIL under sample
 * inputs" BEFORE the real verifier runs. Test-mode only.
 */
function localPreview(t: TestCase): TestPreview {
  let actual: unknown;
  let error: string | undefined;
  try {
    switch (t.function) {
      case "add":
        actual = (t.input as { a: number; b: number }).a + (t.input as { a: number; b: number }).b;
        break;
      case "clamp": {
        const { value, min, max } = t.input as { value: number; min: number; max: number };
        actual = Math.min(max, Math.max(min, value));
        break;
      }
      case "slugify":
        actual = String((t.input as { text: string }).text)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        break;
      default:
        actual = undefined;
        error = `no local preview for "${t.function}" — verifier will run it`;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const pass = error === undefined && JSON.stringify(actual) === JSON.stringify(t.expected);
  return { testId: t.id, name: t.name, pass, note: error };
}

export function TestAuthoring({
  jobId,
  onFrozen,
}: {
  jobId: string;
  onFrozen: (tests: TestCase[]) => void;
}) {
  const [mode, setMode] = useState<AuthorMode>("agent");
  const [requirements, setRequirements] = useState(
    "Pure functions only: add(a,b)->number, clamp(value,min,max)->number, slugify(text)->string. Deterministic, no I/O.",
  );
  const [tests, setTests] = useState<TestCase[]>([]);
  const [preview, setPreview] = useState<TestPreview[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);

  async function runAuthor() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.authorTests(jobId, {
        mode,
        requirements: mode === "agent" ? requirements : undefined,
        tests: mode === "manual" ? defaultManualTests() : undefined,
      });
      const proposed = (res as { tests?: TestCase[] }).tests ?? [];
      setTests(proposed);
      setPreview(proposed.map(localPreview));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authoring failed");
    } finally {
      setBusy(false);
    }
  }

  async function freeze() {
    setBusy(true);
    setError(null);
    try {
      await api.freezeTests(jobId);
      setFrozen(true);
      onFrozen(tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Freeze failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Test suite"
        subtitle="Author the deterministic tests that gate payment."
        action={
          <Tabs
            tabs={[
              { id: "agent", label: "Agent-assisted" },
              { id: "manual", label: "Manual" },
            ]}
            value={mode}
            onChange={(id) => setMode(id as AuthorMode)}
          />
        }
      />
      <CardBody className="space-y-4">
        {mode === "agent" ? (
          <Textarea
            label="Requirements for the test-authoring agent"
            id="ta-req"
            rows={3}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
          />
        ) : (
          <p className="text-xs text-muted">
            Manual mode freezes the built-in sample suite (add / clamp / slugify).
          </p>
        )}

        {preview.length > 0 && (
          <div className="thin-scroll max-h-64 space-y-2 overflow-y-auto">
            {preview.map((p) => (
              <div
                key={p.testId}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/5 bg-bg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">{p.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted">{p.testId}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    p.pass ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                  }`}
                >
                  {p.pass ? "PASS" : "FAIL"}
                </span>
              </div>
            ))}
          </div>
        )}

        {error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={runAuthor} disabled={busy}>
            {busy ? "Working…" : mode === "agent" ? "Propose tests" : "Load manual tests"}
          </Button>
          <Button onClick={freeze} disabled={busy || frozen || tests.length === 0}>
            {frozen ? "Frozen ✓" : "Freeze suite"}
          </Button>
        </div>
        <p className="text-[11px] text-muted">
          The preview is a local sanity check only — the deterministic verifier is the
          single arbiter of pass/fail.
        </p>
      </CardBody>
    </Card>
  );
}

function defaultManualTests(): TestCase[] {
  const inputs = SAMPLE_INPUTS;
  return [
    { id: "t-add", name: "add returns the sum", function: "add", input: inputs.add, expected: 5 },
    { id: "t-clamp", name: "clamp pins into range", function: "clamp", input: inputs.clamp, expected: 10 },
    { id: "t-slugify", name: "slugify normalizes text", function: "slugify", input: inputs.slugify, expected: "hello-world" },
  ];
}
