import { Hono } from "hono";
import Stripe from "stripe";

/**
 * Stripe webhook receiver. Mounted at POST /api/stripe/webhook by W3's routes.
 *
 * In production we MUST verify the signature with STRIPE_WEBHOOK_SECRET so we
 * never act on a forged event (an attacker could otherwise post a fake
 * `payment_intent.succeeded` and drain a job without the verifier passing it).
 * In local/demo environments where STRIPE_WEBHOOK_SECRET is unset we fall back
 * to accepting the raw JSON so the demo still works without Stripe CLI.
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const webhook = new Hono();

webhook.post("/", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    if (secret) {
      event = stripe.webhooks.constructEvent(rawBody, signature ?? "", secret);
    } else {
      console.warn(
        "[stripe-webhook] STRIPE_WEBHOOK_SECRET unset — accepting raw body (demo mode). Do NOT do this in production."
      );
      event = JSON.parse(rawBody) as Stripe.Event;
    }
  } catch (err) {
    console.error(
      "[stripe-webhook] invalid event:",
      (err as Error)?.message ?? err
    );
    return c.json({ received: false, error: "invalid event" }, 400);
  }

  // For now we only log. W3's route layer is responsible for acting on
  // `payment_intent.requires_capture` / `.succeeded` / `.canceled` to drive the
  // job state machine. Keeping this handler side-effect-free means Stripe
  // cannot push a state change the verifier did not authorize.
  console.log("[stripe-webhook] event:", event.type, "id:", event.id);

  return c.json({ received: true, type: event.type });
});
