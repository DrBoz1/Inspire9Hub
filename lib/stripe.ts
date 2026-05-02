import Stripe from "stripe";

// Single shared Stripe instance — import this everywhere instead of calling new Stripe() directly
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});
