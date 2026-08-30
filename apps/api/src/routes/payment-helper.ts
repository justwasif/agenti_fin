import { emitEvent } from "../realtime/publish.js";

/**
 * Demo-mode payment lifecycle glue for the route layer.
 *
 * The production design relies on Stripe's `capture_method: 'manual'`
 * authorization hold as the native escrow: freeze → create PI + confirm
 * (status `requires_capture`, money held); run pass → capture; run fail →
 * hold left active for retry. That Stripe path lives in `../stripe/payment.ts`
 * (still present but NOT called from the runtime here).
 *
 * For the presentation demo we run WITHOUT any Stripe keys or network calls:
 * every payment step is a no-op that only emits the same lifecycle events the
 * UI already renders, with `{ demo: true }` payloads.
 */
export const DEMO_MODE = true; // demo mode: no live Stripe — remove this gate to re-enable payments

export interface PaymentState {
  status: string | null;
  paymentIntentId: string | null;
}

/**
 * Authorize the buyer at freeze time. Demo stub: no Stripe call, no DB write,
 * no PaymentIntent. Just emits PAYMENT_AUTHORIZED so the UI's activity feed
 * keeps working, and returns a truthful `status: 'demo'`.
 */
export async function authorizePayment(
  jobId: string,
  amountCents: number
): Promise<PaymentState> {
  await emitEvent(jobId, "PAYMENT_AUTHORIZED", {
    status: "demo",
    amountCents,
    demo: true,
  });
  return { status: "demo", paymentIntentId: null };
}

/**
 * Capture the held amount after a passing verdict. Demo stub: no Stripe call.
 * `verifyJob` already set the job state to CAPTURED on pass, so we only emit
 * the PAYMENT_CAPTURED event (with `demo: true`) and return.
 */
export async function capturePayment(
  jobId: string,
  _paymentIntentId: string | null
): Promise<PaymentState> {
  await emitEvent(jobId, "PAYMENT_CAPTURED", {
    status: "demo",
    demo: true,
  });
  return { status: "demo", paymentIntentId: null };
}
