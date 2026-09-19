import { createElement, type ReactElement } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCentsAmount, priceLabel } from "@/lib/admin-plans";
import { aud, hubIssueDate } from "@/lib/email/format";
import { siteUrl, teamInbox } from "@/lib/email/links";
import { getLogoUrl } from "@/lib/email/logo";
import { sendOnce } from "@/lib/email/once";
import {
  MembershipCancelling,
  MembershipEnded,
  MembershipPaymentFailed,
  MembershipReceipt,
  MembershipWelcome,
  StaffMembershipAlert,
} from "@/lib/email/templates/membership-emails";
import { invoiceNotices, STAFF_ALERTS, subscriptionNotices, type BillingNews, type InvoiceNews, type Notice, type SubscriptionNews } from "./notices";
import { periodLabel } from "./state";

/**
 * Sends the membership emails a Stripe event calls for. Server only, and run
 * from after(): Stripe has its answer before any email goes. Never throws; a
 * failed email is logged and, having released its key, can go with a later event.
 */
export async function deliverBillingNews(news: BillingNews, eventType: string, now = new Date()): Promise<void> {
  try {
    if ("subscription" in news) await forSubscription(news.subscription, now);
    else await forInvoice(news.invoice, eventType);
  } catch (err) {
    console.error("[billing] membership email:", err instanceof Error ? err.message : err);
  }
}

type Who = { memberName: string; memberEmail: string; planName: string; discountPercent: number };

async function who(memberId: string, planId: string | null): Promise<Who | null> {
  const db = createAdminClient();
  const [{ data: member }, { data: plan }] = await Promise.all([
    db.from("members").select("full_name, email").eq("id", memberId).maybeSingle(),
    planId ? db.from("plans").select("name, booking_discount_percent").eq("id", planId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!member?.email) return null;
  return {
    memberName: (member.full_name as string | null)?.trim() || "Member",
    memberEmail: member.email as string,
    planName: (plan?.name as string | undefined)?.trim() || "your membership",
    discountPercent: Number(plan?.booking_discount_percent ?? 0),
  };
}

const common = (w: Who) => ({ memberName: w.memberName, memberEmail: w.memberEmail, planName: w.planName, membershipUrl: siteUrl("/membership"), logoDataUrl: getLogoUrl() });

async function send(notice: Notice, w: Who, subject: string, email: ReactElement, staffDetail: string) {
  await sendOnce(notice.key, `membership.${notice.kind}`, { to: w.memberEmail, replyTo: teamInbox(), subject, react: email });
  const alert = STAFF_ALERTS[notice.kind];
  if (!alert) return;
  await sendOnce(`staff.${notice.key}`, `staff.membership.${alert}`, {
    to: teamInbox(),
    replyTo: w.memberEmail,
    subject: `[Membership] ${w.memberName}: ${alert.replace("_", " ")}, ${w.planName}`,
    react: createElement(StaffMembershipAlert, { kind: alert, memberName: w.memberName, memberEmail: w.memberEmail, planName: w.planName, detail: staffDetail, adminUrl: siteUrl("/admin/memberships"), logoDataUrl: getLogoUrl() }),
  });
}

async function forSubscription(sub: SubscriptionNews, now: Date) {
  const notices = subscriptionNotices(sub, now);
  if (!notices.length) return;
  const w = await who(sub.memberId, sub.planId);
  if (!w) return;
  const price = priceLabel({ amountCents: sub.unitAmountCents * sub.quantity, billingInterval: sub.billingInterval, intervalCount: sub.intervalCount });

  for (const notice of notices) {
    if (notice.kind === "welcome") {
      const renewsOn = sub.currentPeriodEnd ? hubIssueDate(sub.currentPeriodEnd) : null;
      await send(notice, w, `Welcome to ${w.planName}`, createElement(MembershipWelcome, { ...common(w), priceLabel: price, renewsOn, discountPercent: w.discountPercent, spacesUrl: siteUrl("/spaces") }), `Pays ${price}, from ${hubIssueDate(sub.startedAt)}`);
    } else if (notice.kind === "cancelling" && sub.currentPeriodEnd) {
      const endsOn = hubIssueDate(sub.currentPeriodEnd);
      await send(notice, w, `Your membership ends on ${endsOn}`, createElement(MembershipCancelling, { ...common(w), endsOn }), `Access until ${endsOn}, no further payments`);
    } else if (notice.kind === "ended") {
      await send(notice, w, "Your membership has ended", createElement(MembershipEnded, common(w)), `Ended ${hubIssueDate(sub.endedAt ?? now)}`);
    }
  }
}

async function forInvoice(invoice: InvoiceNews, eventType: string) {
  const notices = invoiceNotices(eventType, invoice);
  if (!notices.length) return;
  const { data: owner } = await createAdminClient().from("subscriptions").select("member_id, plan_id").eq("id", invoice.subscriptionRowId).maybeSingle();
  if (!owner?.member_id) return;
  const w = await who(owner.member_id as string, (owner.plan_id as string | null) ?? null);
  if (!w) return;

  for (const notice of notices) {
    if (notice.kind === "receipt") {
      const amountAUD = invoice.amountPaidCents / 100;
      await send(notice, w, `Receipt for ${w.planName}, ${formatCentsAmount(invoice.amountPaidCents)}`, createElement(MembershipReceipt, {
        ...common(w),
        amountAUD,
        periodLabel: periodLabel(invoice.periodStart, invoice.periodEnd),
        paidOn: hubIssueDate(new Date()),
        invoiceNumber: invoice.number,
        invoiceUrl: invoice.hostedInvoiceUrl,
      }), `${aud(amountAUD)} paid`);
    } else if (notice.kind === "payment_failed") {
      const nextAttempt = invoice.nextPaymentAttempt ? hubIssueDate(invoice.nextPaymentAttempt) : null;
      const amountAUD = invoice.amountDueCents / 100;
      await send(notice, w, "Your membership payment didn’t go through", createElement(MembershipPaymentFailed, { ...common(w), amountAUD, nextAttempt }), `${aud(amountAUD)} due${nextAttempt ? `, next try ${nextAttempt}` : ", no retry scheduled"}`);
    }
  }
}
