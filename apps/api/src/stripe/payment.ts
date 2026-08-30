import Stripe from "stripe";
import type StripeTypes from "stripe";

/**
 * PaymentIntent helpers for ProofOfWorkPay's "no proof, no pay" flow.
 *
 * `capture_method: 'manual'` makes Stripe's authorization hold work as native
 * escrow: the buyer is authorized up front (money is held, never moved) and we
 * only `capture` it after the verifier returns a passing verdict. There is NO
 * wallet and NO customer-funds custody anywhere in this design.
 *
 * TEST-MODE ONLY.
 * Set STRIPE_SECRET_KEY in your environment (sk_test_...).
 * The placeholder below exists so the module is valid without an env var;
 * the demo scripts require you to export the real test key before running.
 */
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "sk_test_REPLACE_ME";

const stripe = new Stripe(STRIPE_SECRET);

/**
 * Authorize (but do NOT capture) a payment. This is the "hold" the buyer sees
 * when they lock a job. Returns a PaymentIntent with status `requires_capture`
 * once it is confirmed.
 */
export function createPaymentIntent(
  amountCents: number,
  currency = "usd"
): Promise<StripeTypes.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    capture_method: "manual",
    payment_method_types: ["card"],
  });
}

/**
 * Confirm the authorization hold with a card. `paymentMethodId` defaults to
 * Stripe's canonical test card `pm_card_visa`. After this the intent should be
 * `requires_capture` (authorized but not charged).
 */
export function confirmPaymentIntent(
  piId: string,
  paymentMethodId = "pm_card_visa"
): Promise<StripeTypes.PaymentIntent> {
  return stripe.paymentIntents.confirm(piId, {
    payment_method: paymentMethodId,
  });
}

/**
 * Capture the authorized amount — the "money moment" that only happens after
 * the verifier rules PASS. On success status becomes `succeeded`.
 */
export function capturePaymentIntent(
  piId: string
): Promise<StripeTypes.PaymentIntent> {
  return stripe.paymentIntents.capture(piId);
}

/**
 * Release the hold without charging. Used when the verifier rules FAIL or the
 * job is cancelled — the buyer's authorization is voided, not captured.
 */
export function cancelPaymentIntent(
  piId: string
): Promise<StripeTypes.PaymentIntent> {
  return stripe.paymentIntents.cancel(piId);
}
