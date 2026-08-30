/**
 * Proves the Stripe "money moment" end to end in TEST MODE.
 *
 *   create  → PaymentIntent (capture_method manual) → status requires_capture/requires_payment_method
 *   confirm → authorize the hold with pm_card_visa → status requires_capture
 *   capture → charge the authorized amount         → status succeeded
 *
 * Run: node --import tsx scripts/test-stripe.ts
 */
import {
  createPaymentIntent,
  confirmPaymentIntent,
  capturePaymentIntent,
} from "../src/stripe/payment.js";

const pi = await createPaymentIntent(2500);
console.log("created   ", pi.id, pi.status);

const confirmed = await confirmPaymentIntent(pi.id, "pm_card_visa");
console.log("confirmed ", confirmed.id, confirmed.status);

const captured = await capturePaymentIntent(pi.id);
console.log("captured  ", captured.id, captured.status);

const allGood =
  pi.status === "requires_payment_method" &&
  confirmed.status === "requires_capture" &&
  captured.status === "succeeded";

console.log(allGood ? "\n[test-stripe] OK" : "\n[test-stripe] UNEXPECTED STATUSES");
