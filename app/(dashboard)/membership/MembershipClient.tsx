"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, Check, CreditCard, Loader2, ReceiptText, Sparkles } from "lucide-react";
import { formatCentsAmount, perMonth, priceLabel, type Plan } from "@/lib/admin-plans";
import { periodLabel, renewalNotice, type RenewalNotice } from "@/lib/billing/state";
import type { MemberInvoice, MemberSubscription } from "./membership-data";
import type { RedirectResult } from "./actions";

const TONE_BADGE: Record<RenewalNotice["tone"], string> = { positive: "active", warning: "pending", danger: "cancelled", neutral: "inactive" };
const INVOICE_LABELS: Record<string, [string, string]> = {
  paid: ["Paid", "confirmed"],
  open: ["Not paid yet", "pending"],
  uncollectible: ["Couldn’t collect", "cancelled"],
  void: ["Cancelled", "inactive"],
};

export function MembershipClient({
  plans,
  current,
  invoices,
  hasCustomer,
  nowIso,
  returned,
  actions,
}: {
  plans: Plan[];
  current: MemberSubscription | null;
  invoices: MemberInvoice[];
  hasCustomer: boolean;
  nowIso: string;
  returned: "joined" | "cancelled" | null;
  actions: { start: (slug: string) => Promise<RedirectResult>; portal: () => Promise<RedirectResult> };
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notice = renewalNotice(current, new Date(nowIso));
  const live = notice.kind !== "inactive";

  /** Both actions end at a Stripe page; the browser goes there, or the problem is shown here. */
  const go = (label: string, work: () => Promise<RedirectResult>) => {
    setBusy(label);
    setError(null);
    startTransition(async () => {
      try {
        const result = await work();
        if ("error" in result) {
          setError(result.error);
          setBusy(null);
          return;
        }
        window.location.assign(result.url);
      } catch {
        setError("Couldn’t reach the server. Please try again.");
        setBusy(null);
      }
    });
  };

  return (
    <>
      {returned === "joined" && !live && (
        <p className="hub-membership-note" role="status">
          <Sparkles size={15} aria-hidden />
          Payment received, welcome. Your membership can take a moment to show here; refresh in a few seconds.
        </p>
      )}
      {returned === "cancelled" && (
        <p className="hub-membership-note" role="status">Checkout was cancelled. Nothing was charged.</p>
      )}
      {error && <p className="hub-inline-error" role="alert">{error}</p>}

      <div className="hub-membership-grid">
        <section className="hub-surface hub-membership-current" aria-labelledby="membership-now">
          <p className="hub-eyebrow">Your plan</p>
          <h2 id="membership-now">{current?.planName ?? (live ? "Membership" : "Not a member yet")}</h2>
          <span className="hub-status-badge" data-status={TONE_BADGE[notice.tone]}>{notice.label}</span>
          <p className="hub-membership-lede">{notice.description}</p>
          {current && live && (
            <dl className="hub-id-stats">
              <div><dt>Price</dt><dd>{priceLabel({ amountCents: current.unitAmountCents * current.quantity, billingInterval: current.billingInterval, intervalCount: current.intervalCount })}</dd></div>
              <div><dt>Status</dt><dd>{notice.kind === "overdue" ? "Needs attention" : "In good standing"}</dd></div>
            </dl>
          )}
          {hasCustomer && (
            <button type="button" className="hub-button hub-button-outline" onClick={() => go("portal", actions.portal)} disabled={pending}>
              {busy === "portal" ? <Loader2 size={14} className="hub-spin" aria-hidden /> : <CreditCard size={14} aria-hidden />}
              Manage billing
            </button>
          )}
          {hasCustomer && <p className="hub-membership-small">Change your card, see receipts, or cancel. Handled securely by Stripe.</p>}
        </section>

        {!live && (
          <section className="hub-membership-plans" aria-labelledby="membership-plans">
            <h2 id="membership-plans" className="hub-eyebrow">Choose a plan</h2>
            {plans.length === 0 ? (
              <p className="hub-surface hub-membership-empty">No plans are on sale right now. Ask the team about membership.</p>
            ) : (
              <ul>
                {plans.map((plan) => (
                  <li key={plan.id} className="hub-surface hub-plan">
                    <h3>{plan.name}</h3>
                    {plan.description && <p>{plan.description}</p>}
                    <strong className="hub-plan-price">{priceLabel(plan)}</strong>
                    {plan.billingInterval === "year" && <span className="hub-plan-sub">{formatCentsAmount(Math.round(perMonth(plan)))} a month</span>}
                    {plan.bookingDiscountPercent > 0 && <span className="hub-plan-perk">{plan.bookingDiscountPercent}% off meeting room bookings</span>}
                    <button type="button" className="hub-button hub-button-primary" onClick={() => go(plan.slug, () => actions.start(plan.slug))} disabled={pending} aria-label={`Choose ${plan.name}, ${priceLabel(plan)}`}>
                      {busy === plan.slug ? <Loader2 size={14} className="hub-spin" aria-hidden /> : <Check size={14} aria-hidden />}
                      Choose {plan.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="hub-membership-small">You’ll pay on Stripe’s secure checkout. Cancel any time; you keep access until the end of what you’ve paid for.</p>
          </section>
        )}

        {invoices.length > 0 && (
          <section className="hub-surface hub-account-list hub-membership-invoices" aria-labelledby="membership-invoices">
            <h2 id="membership-invoices" className="hub-eyebrow">Receipts</h2>
            <ul>
              {invoices.map((invoice) => {
                const [label, tone] = INVOICE_LABELS[invoice.status] ?? [invoice.status, "inactive"];
                const amount = invoice.status === "paid" ? invoice.amountPaidCents : invoice.amountDueCents;
                return (
                  <li key={invoice.id} className="hub-account-row">
                    <span className="hub-row-icon"><ReceiptText size={16} aria-hidden /></span>
                    <div>
                      <strong>{periodLabel(invoice.periodStart, invoice.periodEnd)}</strong>
                      <span>{formatCentsAmount(amount)} · <span className="hub-status-badge" data-status={tone}>{label}</span></span>
                    </div>
                    {invoice.url && (
                      <a href={invoice.url} target="_blank" rel="noreferrer" className="hub-text-link" aria-label={`Receipt for ${periodLabel(invoice.periodStart, invoice.periodEnd)}, opens Stripe`}>
                        Receipt<ArrowUpRight size={14} aria-hidden />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
