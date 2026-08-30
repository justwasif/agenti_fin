# ProofOfWorkPay

**No proof, no pay.** A marketplace where a buyer hires an AI agent to do a job, and the buyer's money is only released **after** the agent proves the work is correct — *automatically*, with no "pay now" button the buyer can refuse to click.

> **DATA: public/mock/sanitized only.** Everything runs against Stripe **test mode** and mock data. No real cards, no real money, no trading/lending advice.

---

## The problem

Two bad things happen in agent work today, and they are mirror images of each other:

1. **The scammer buyer.** Someone hires an agent (or a person) to do a job, receives the finished work, and then refuses to pay — or claims "this isn't what I asked for" even when it is exactly right. The worker has no leverage: the money was never locked, so the buyer can just walk away.
2. **The dishonest worker.** Someone pays for work up front, and the deliverable is wrong, incomplete, or not what was agreed. The buyer has no reliable way to verify "done" without a long manual review — and by then the money is usually already spent.

ProofOfWorkPay sits between the two and removes the *trust* requirement from both sides:

- The buyer's money is **locked before any work begins** (so the worker knows they will get paid if they deliver).
- The buyer's **own acceptance tests** define "correct" *up front* (so the worker can't redefine the goal).
- A **deterministic verifier** — not the buyer, not the worker — runs those tests and **triggers payment on pass**, or **sends the work back on fail**.

---

## How it works — one paragraph

The buyer describes what they want and defines acceptance tests (by hand, or by asking an in-house agent to generate them). Those tests are **frozen**, and a Stripe **authorization hold** locks the buyer's funds. A separate **worker agent** does the job and submits its deliverable. A **verifier agent** — a deterministic runner, not an LLM — executes the frozen tests against the deliverable. If **all tests pass**, the verifier **captures** the payment and the transaction settles. If **any test fails**, the verifier shows the exact failing case and hands the work back to the worker agent to fix, looping until everything is green. No human has to decide "should I pay?" — the buyer's own tests, checked by a neutral, re-runnable runner, make that decision.

---

## What it is NOT

- **Not a wallet or escrow custodian** — the Stripe authorization hold *is* the escrow; we never hold customer funds ourselves.
- **Not a lending/trading/advice tool** — it only gates payment for verifiable work; it recommends nothing.
- **Not an LLM-as-judge system** — the verifier is deterministic, so the same input always produces the same pass/fail (this is what makes disputes settle-able).
- **Not a live-money system** — the demo runs entirely on Stripe test mode and mock/sanitized data.

---

## The four actors

| Actor | What it is | What it does |
|---|---|---|
| **Buyer** | A human user | Posts the request, defines acceptance tests (manually or via the test-authoring agent), confirms and locks the job. |
| **Test-authoring agent** (in-house) | LLM agent | Converts the buyer's natural-language acceptance wishes into **executable test cases**. Generates and proposes tests; the buyer reviews before freezing. |
| **Worker agent** (delivering agent) | LLM agent + tools | Actually performs the requested work (writes code, produces a dataset, writes a deliverable). It reads the request **and the frozen tests**, then produces a solution. |
| **Verifier agent** (deterministic runner) | No LLM — a deterministic executor | Runs the exact frozen test suite against the submitted deliverable and emits pass/fail + evidence. Same input → same output, every time. |

There are **three distinct agents** and they must not be conflated:

- The **test-authoring agent** *creates the criteria* (before work starts).
- The **worker agent** *does the work* (after the criteria are locked).
- The **verifier agent** *judges the work* (deterministic, after submission).

This separation is load-bearing: the worker never writes its own acceptance tests, and the verifier never uses an LLM.

---

## The core money primitive: Stripe's authorization hold

The entire "no proof, no pay" guarantee rests on one Stripe feature: a **PaymentIntent with `capture_method=manual`**.

1. The buyer's card is **authorized** for the agreed amount, but the funds are **not yet captured**. Stripe (via the card network/issuer) places a temporary **authorization hold** on the buyer's card. The money is reserved — the buyer can't spend it elsewhere — but it has not moved to anyone's account yet.
2. Later, exactly one of two things happens:
   - **`capture`** — the reserved funds are actually taken (settled). This is the "pay" moment.
   - **`cancel`** — the hold is released and the funds return to the buyer's available balance. No money moves.
3. In **test mode**, this is driven with Stripe's test cards (e.g. `4242 4242 4242 4242`). The full create → confirm → capture/cancel lifecycle runs, but nothing real is charged.

The authorization hold **is** the escrow. The buyer's money is locked *before* any work begins, but neither the buyer nor the seller controls the release button — **the verifier's verdict does**. This is what stops a scammer buyer from taking the work and refusing to pay: once the hold exists, the only thing that determines whether the money is captured or returned is whether the frozen test suite passes.

> Real-world note (not demo-blocking): card authorization holds typically expire after ~7 days. In the demo we use test mode and keep the loop short. In production this would map to re-authorization or a longer-lived rail — but that is outside the demo scope.

---

## The lifecycle, step by step

### Stage 0 — Buyer posts the request

The buyer opens the app and describes **what they want** in plain language, plus the acceptance expectations. Example (used throughout this doc):

> *"Write a Python function `dedupe(emails: list[str]) -> list[str]` that removes duplicate email addresses, treats case-insensitively, and preserves first-seen order. Return a list of unique, lowercase emails."*

Alongside the request, the buyer states acceptance expectations in plain words:

> *"It must handle duplicates, ignore case, keep order, and return unique lowercase emails. Also handle an empty list."*

At this point the job is in **DRAFT** state. No money is locked yet.

### Stage 1 — Test cases are written (manual or agent-assisted)

The buyer can produce the executable test suite **two ways**, and both feed into the same frozen-test pipeline.

**1a. Manual authoring.** The buyer writes test cases directly in a simple, structured format. The UI offers pre-wired templates (code PR, dataset, freelance deliverable). For the example request, manual tests look like:

```
test_removes_exact_duplicates:
  input:  ["a@x.com", "b@x.com", "a@x.com"]
  expect: ["a@x.com", "b@x.com"]

test_case_insensitive:
  input:  ["A@X.com", "a@x.com"]
  expect: ["a@x.com"]

test_preserves_first_seen_order:
  input:  ["b@x.com", "a@x.com", "b@x.com"]
  expect: ["b@x.com", "a@x.com"]

test_empty_list:
  input:  []
  expect: []
```

Each test is a **pure function of its input** — deterministic, no network, no randomness. That is a hard requirement: a test that can't be re-run identically is rejected.

**1b. Agent-assisted authoring (the in-house test-authoring agent).** The buyer instead types a natural-language instruction to the test-authoring agent, e.g.:

> *"Make test cases that check: it removes duplicates, it is case-insensitive, it keeps first-seen order, and it handles an empty list."*

The test-authoring agent **generates** a proposed test suite (the same shape as above, possibly with extra edge cases like `None` handling if the buyer allows it). The buyer **reviews and approves** each generated test before it is frozen. The agent *proposes*; the human *owns* the final suite. This keeps the buyer in control of what counts as "done."

### Stage 2 — Pre-flight sanity screen, freeze, and lock the money

Before anything is committed, a **pre-flight sanity screen** runs. It shows the buyer a dry-run preview over example inputs:

> *"Under these sample inputs, this test would PASS / this test would FAIL."*

Its job is to catch two scams before they start:

1. **Impossible tests** (a test that can never pass — e.g. `expect: "returns pi"` on a function that returns integers).
2. **Moving goalposts** (the buyer editing tests *after* seeing the work to make it fail).

Once the buyer approves the preview, the system performs **two atomic actions together**:

1. **Freeze the test suite** — it is hashed and version-locked. It can no longer be edited by either party.
2. **Create the Stripe PaymentIntent** with `capture_method=manual`, confirming the authorization so the hold is placed on the buyer's card.

The job now enters **LOCKED** state. Money is held. Criteria are immutable. The scammer-buyer vector ("work is correct but I won't pay") is now closed: the buyer has no release button left to refuse with.

### Stage 3 — The worker agent does the job

The **worker agent** (a different agent from the test-authoring agent) receives:

- the buyer's request,
- the **frozen test suite** (read-only — it may read the tests but not modify them),
- any context/templates.

It performs the work. In the example, it writes the `dedupe` function. The worker may iterate internally, and it can even run a **copy** of the test suite locally as a self-check — but the *official* verdict always comes from the verifier, never from the worker grading itself.

The job is in **IN_PROGRESS** state.

### Stage 4 — The worker submits its solution

When the worker believes it is done, it **submits** the deliverable (code, dataset, file, etc.). Submission is a single explicit action: the deliverable is snapshotted and passed to the verifier along with the frozen test suite and its hash.

The job enters **SUBMITTED** state. From here, the worker can no longer touch the deliverable unless a failure sends it back.

### Stage 5 — The verifier runs the frozen test suite

The **verifier agent** is a deterministic executor, not an LLM. It:

1. Confirms the test-suite hash still matches the frozen hash (detects any tampering).
2. Runs every test in the frozen suite against the submitted deliverable.
3. Records, for each test: **pass** or **fail**, plus the exact input, expected output, and actual output.
4. Computes an **evidence hash** over the deliverable + test suite + results so the whole run can be replayed later.

Because the tests are pure and deterministic, the verdict is **same-input-same-output**: re-running it anywhere reproduces the identical result.

### Stage 6a — All tests pass → the transaction succeeds

If **every** test passes, the verifier's outcome is **PASS**. This triggers the Stripe **`capture`** call on the pre-authorized PaymentIntent. The reserved funds are settled to the seller side, and the job transitions to **COMPLETED / CAPTURED**.

The demo screen shows:

- the green test run (all N/N passing),
- the capture call and the resulting PaymentIntent status,
- the evidence hash (for later replay).

There is **no "buyer clicks pay" step**. The buyer authorized up front; the verifier released it. This is the whole point.

### Stage 6b — Any test fails → feedback loop back to the worker

If **any** test fails, the verifier's outcome is **FAIL**. The charge is **not** captured (and if the job should be abandoned, it can be `cancel`ed to release the hold). The verifier produces a **failure report**:

- the exact failing tests,
- for each: input → expected → actual,
- the concrete diff/mismatch.

This failure report is handed back to the **worker agent**, which re-opens the deliverable, fixes the failure, and **re-submits**. The loop is:

```
work → submit → verify → FAIL (show exact failures) → re-work → re-submit → verify → ...
```

The loop repeats **until the entire suite is green** or the job is explicitly abandoned (which releases the hold). There is no partial payment: pass/fail is all-or-nothing against the full frozen suite.

---

## State machine

```
DRAFT
  │  buyer writes request + tests (manual or agent-assisted)
  ▼
  └─ pre-flight sanity preview ──► (buyer approves)
LOCKED            ◄── test suite frozen + PaymentIntent created (hold active)
  │
  ▼
IN_PROGRESS        ◄── worker agent does the work
  │
  ▼
SUBMITTED          ◄── worker submits deliverable
  │
  ▼
VERIFYING          ◄── verifier runs frozen tests (deterministic)
  │
  ├── ALL PASS ──► CAPTURE ──► COMPLETED (money settled)
  │
  └── ANY FAIL ──► FAILURE REPORT ──► back to IN_PROGRESS (re-work loop)
                        │
                        └─ (job abandoned) ──► CANCEL ──► hold released, no payment
```

---

## The two demo beats

The demo is built around one happy path and one recovery path:

1. **Happy path (pass):** buyer posts request → tests generated → money locked → worker delivers → verifier runs → all green → **capture** → "payment released, here's the evidence."
2. **Recovery path (fail → re-work):** the same job, but the first submission has a bug. The verifier fails it, shows the exact failing test (input/expected/actual), the worker agent fixes it, re-submits, and the re-run goes green → **capture**.

The contrast is what sells the idea: the buyer's money stayed locked through the failure, and it was only released when the *buyer's own tests* turned green — with the verifier, not the buyer, pulling the trigger.

---

## Dispute / replay (one-click evidence)

If anyone disputes the outcome, the system offers **one-click replay**: re-run the exact frozen test suite against the exact submitted deliverable. The evidence hash proves nothing was changed, and the deterministic runner reproduces the same pass/fail live. This is not a signed attestation and not a ledger — it is *re-runnable proof*.

---

## Repository layout

- `apps/` — runnable demo applications.
- `packages/` — shared libraries (agents, verifier runner, Stripe glue, UI components).
- `research/` — functional specs and design notes (source of truth for behavior).
- `DEMO_SCRIPT.md` — walkthrough script for the live demo.
- `HOW_MEL_HELPED.md` / `WOW_WHAT_WE_MADE.md` — build narrative.

---

*This README is the public-facing summary of the working description in `research/proof_of_work_pay_workflow.md` — see that file for the full functional specification.*