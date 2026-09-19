import type { StaffMembershipAlertKind } from "@/lib/email/templates/membership-emails";
import type { StripeSubscriptionStatus } from "./state";

/**
 * Which membership emails a Stripe event should send. Pure: the sync hands over
 * what it just learned, this says what to send and under what key.
 *
 * Decided from where the subscription is now, not from the event's name, so a
 * late or repeated event can't send the wrong thing. The key names the fact
 * ("welcome for sub_1"), and sent_emails lets each key go out once.
 */

export type SubscriptionNews = {
  stripeSubscriptionId: string;
  memberId: string;
  planId: string | null;
  status: StripeSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  endedAt: string | null;
  startedAt: string;
  unitAmountCents: number;
  quantity: number;
  billingInterval: "month" | "year";
  intervalCount: number;
};

export type InvoiceNews = {
  subscriptionRowId: string;
  stripeInvoiceId: string;
  status: string;
  amountPaidCents: number;
  amountDueCents: number;
  periodStart: string;
  periodEnd: string;
  hostedInvoiceUrl: string | null;
  number: string | null;
  nextPaymentAttempt: string | null;
};

export type BillingNews = { subscription: SubscriptionNews } | { invoice: InvoiceNews };

export type NoticeKind = "welcome" | "cancelling" | "ended" | "receipt" | "payment_failed";
export type Notice = { kind: NoticeKind; key: string };

/**
 * A welcome or a goodbye is only news for a week. Without this, the first
 * event about a membership that started before these emails existed (a renewal,
 * say) would welcome someone who joined a year ago.
 */
export const NEWS_DAYS = 7;
const DAY_MS = 86_400_000;

export function subscriptionNotices(sub: SubscriptionNews, now: Date): Notice[] {
  const recent = (iso: string | null) => iso !== null && now.getTime() - Date.parse(iso) <= NEWS_DAYS * DAY_MS;
  const live = sub.status === "active" || sub.status === "trialing";
  const notices: Notice[] = [];
  if (live && recent(sub.startedAt)) {
    notices.push({ kind: "welcome", key: `membership.welcome:${sub.stripeSubscriptionId}` });
  }
  // Keyed by the end date: cancel, change your mind, then cancel again next month and it's news again.
  if ((live || sub.status === "past_due") && sub.cancelAtPeriodEnd && sub.currentPeriodEnd && Date.parse(sub.currentPeriodEnd) > now.getTime()) {
    notices.push({ kind: "cancelling", key: `membership.cancelling:${sub.stripeSubscriptionId}:${sub.currentPeriodEnd}` });
  }
  if (sub.status === "canceled" && recent(sub.endedAt)) {
    notices.push({ kind: "ended", key: `membership.ended:${sub.stripeSubscriptionId}` });
  }
  return notices;
}

export function invoiceNotices(eventType: string, invoice: InvoiceNews): Notice[] {
  // A $0 invoice (a free trial starting, a credit) isn't a payment worth a receipt.
  if (eventType === "invoice.paid" && invoice.status === "paid" && invoice.amountPaidCents > 0) {
    return [{ kind: "receipt", key: `membership.receipt:${invoice.stripeInvoiceId}` }];
  }
  // Once per invoice, not per retry: Stripe may try the card four times in a fortnight.
  if (eventType === "invoice.payment_failed" && invoice.amountDueCents > 0) {
    return [{ kind: "payment_failed", key: `membership.payment_failed:${invoice.stripeInvoiceId}` }];
  }
  return [];
}

/** What the team hears about. Receipts aren't news for them: the admin dashboard has the totals. */
export const STAFF_ALERTS: Partial<Record<NoticeKind, StaffMembershipAlertKind>> = {
  welcome: "joined",
  cancelling: "cancelling",
  payment_failed: "payment_failed",
  ended: "ended",
};
