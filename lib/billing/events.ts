/**
 * Which handler a Stripe event goes to. Pure, so the one rule that protects
 * bookings is pinned by a test: a subscription checkout must never reach the
 * booking code. Before this, it would have, and failed with a 400 that Stripe
 * retries for three days; a webhook that keeps failing gets switched off, and
 * bookings share it.
 */

export type WebhookRoute = "booking-expired" | "booking-paid" | "subscription-checkout" | "subscription" | "invoice" | "ignore";

export const SUBSCRIPTION_EVENTS = ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"] as const;
export const INVOICE_EVENTS = ["invoice.paid", "invoice.payment_failed"] as const;

type CheckoutFacts = { mode?: string | null; metadata?: Record<string, string> | null } | null;

/**
 * Whether a paid checkout is one of ours: the booking flow always sets these four.
 * Anything else paid through the same Stripe account (a Payment Link, Stripe's own
 * example product) isn't a booking, and no retry will ever make it one. Rejecting
 * it had Stripe retrying for three days; now it's acknowledged and left alone.
 */
export function isBookingCheckout(metadata?: Record<string, string> | null): boolean {
  return Boolean(metadata?.userId && metadata.workspaceId && metadata.startTime && metadata.endTime);
}

export function webhookRoute(eventType: string, session?: CheckoutFacts): WebhookRoute {
  const mode = session?.mode;
  if (eventType === "checkout.session.expired") return mode === "payment" || !mode ? "booking-expired" : "ignore";
  if (eventType === "checkout.session.completed") {
    if (mode === "subscription") return "subscription-checkout";
    return mode === "payment" && isBookingCheckout(session?.metadata) ? "booking-paid" : "ignore";
  }
  if ((SUBSCRIPTION_EVENTS as readonly string[]).includes(eventType)) return "subscription";
  if ((INVOICE_EVENTS as readonly string[]).includes(eventType)) return "invoice";
  // Anything else Stripe sends is acknowledged and left alone. An event type we
  // don't handle must never fail, or the endpoint gets switched off.
  return "ignore";
}
