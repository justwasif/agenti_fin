"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Job } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export function RequestBuilder({ onCreated }: { onCreated: (job: Job) => void }) {
  const [title, setTitle] = useState("");
  const [requestText, setRequestText] = useState("");
  const [amountCents, setAmountCents] = useState("5000");
  const [buyerId, setBuyerId] = useState("buyer-demo-1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !requestText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await api.createJob({
        title: title.trim(),
        requestText: requestText.trim(),
        amountCents: Math.max(1, Number(amountCents) || 0),
        buyerId: buyerId.trim() || "buyer-demo-1",
      });
      setTitle("");
      setRequestText("");
      onCreated(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Post a request"
        subtitle="Describe the work. A DRAFT job is created — no funds move until you lock the test suite."
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Title"
            id="rb-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Pure utility functions: add, clamp, slugify"
            required
          />
          <Textarea
            label="What should the deliverable do?"
            id="rb-request"
            rows={5}
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            placeholder="Describe the functions and their exact expected behavior. The verifier will test only what the suite encodes."
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Budget (cents)"
              id="rb-amount"
              type="number"
              min={1}
              value={amountCents}
              onChange={(e) => setAmountCents(e.target.value)}
            />
            <Input
              label="Buyer ID (test mode)"
              id="rb-buyer"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
            />
          </div>
          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create DRAFT job"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
