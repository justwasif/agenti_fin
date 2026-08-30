import { createPool, createDb } from "../db/index.js";
import { jobs } from "../db/index.js";
import { eq } from "drizzle-orm";
import { emitEvent } from "../realtime/publish.js";

/**
 * Test-mode payment lifecycle glue for the route layer.
 *
 * Stripe's `capture_method: 'manual'` authorization hold is the native escrow:
 * freeze → create PI + confirm (status `requires_capture`, money held, never
 * moved); run pass → capture (status `succeeded`); run fail → hold left active
 * for retry.
 *
 * Everything here is defensive: if STRIPE_SECRET_KEY is absent (or a call
 * throws), we record a clear `PAYMENT_UNAVAILABLE` event and return a truthful
 * `status: 'unavailable'` rather than pretending a capture happened.
 */

const pool = createPool();
const db = createDb(pool);

export interface PaymentState {
  status: string | null;
  paymentIntentId: string | null;
}

/** True when a real Stripe test key is present (vs. W2's placeholder). */
export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && key !== "sk_test_REPLACE_ME";
}

/**
 * Authorize the buyer at freeze time. Creates a manual-capture PaymentIntent
 * for `amountCents`, confirms `pm_card_visa`, persists the PI id on the job,
 * and emits PAYMENT_AUTHORIZED. On any failure returns `unavailable`.
 */
export async function authorizePayment(
  jobId: string,
  amountCents: number
): Promise<PaymentState> {
  if (!stripeConfigured()) {
    await emitEvent(jobId, "PAYMENT_UNAVAILABLE", {
      reason: "STRIPE_SECRET_KEY not set — mock/test-mode (no authorization hold)",
    });
    return { status: "unavailable", paymentIntentId: null };
  }

  try {
    const { createPaymentIntent, confirmPaymentIntent } = await import(
      "../stripe/payment.js"
    );
    const pi = await createPaymentIntent(amountCents);
    const confirmed = await confirmPaymentIntent(pi.id);

    await db
      .update(jobs)
      .set({ stripePaymentIntentId: pi.id, updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await emitEvent(jobId, "PAYMENT_AUTHORIZED", {
      paymentIntentId: pi.id,
      status: confirmed.status,
      amountCents,
    });

    return { status: confirmed.status, paymentIntentId: pi.id };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await emitEvent(jobId, "PAYMENT_UNAVAILABLE", { reason });
    return { status: "unavailable", paymentIntentId: null };
  }
}

/**
 * Capture the held amount after a passing verdict. Only flips the job to
 * CAPTURED once Stripe reports `succeeded`. Any other status (or an error)
 * leaves the hold active for a later retry.
 */
export async function capturePayment(
  jobId: string,
  paymentIntentId: string
): Promise<PaymentState> {
  if (!stripeConfigured()) {
    await emitEvent(jobId, "PAYMENT_UNAVAILABLE", {
      reason: "STRIPE_SECRET_KEY not set — mock/test-mode (no capture)",
    });
    return { status: "unavailable", paymentIntentId };
  }

  try {
    const { capturePaymentIntent } = await import("../stripe/payment.js");
    const captured = await capturePaymentIntent(paymentIntentId);

    if (captured.status === "succeeded") {
      await db
        .update(jobs)
        .set({ state: "CAPTURED", updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
      await emitEvent(jobId, "PAYMENT_CAPTURED", {
        paymentIntentId,
        status: captured.status,
      });
    } else {
      // Not succeeded (e.g. still requires_capture / error) — leave hold open.
      await emitEvent(jobId, "PAYMENT_CAPTURE_PENDING", {
        paymentIntentId,
        status: captured.status,
      });
    }

    return { status: captured.status, paymentIntentId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await emitEvent(jobId, "PAYMENT_CAPTURE_FAILED", { paymentIntentId, reason });
    return { status: "error", paymentIntentId };
  }
}
