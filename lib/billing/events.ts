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

export function webhookRoute(eventType: string, sessionMode?: string | null): WebhookRoute {
  if (eventType === "checkout.session.expired") return sessionMode === "payment" || !sessionMode ? "booking-expired" : "ignore";
  if (eventType === "checkout.session.completed") {
    if (sessionMode === "subscription") return "subscription-checkout";
    return sessionMode === "payment" ? "booking-paid" : "ignore";
  }
  if ((SUBSCRIPTION_EVENTS as readonly string[]).includes(eventType)) return "subscription";
  if ((INVOICE_EVENTS as readonly string[]).includes(eventType)) return "invoice";
  // Anything else Stripe sends is acknowledged and left alone. An event type we
  // don't handle must never fail, or the endpoint gets switched off.
  return "ignore";
}
