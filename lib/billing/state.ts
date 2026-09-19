import { HUB_TIMEZONE } from "@/lib/datetime";
import { wallClockAt } from "@/features/booking-map/zoned-time";

/**
 * What a Stripe subscription means for a member. Pure: no Stripe, no database,
 * and `now` is always passed in.
 *
 * Stripe's status word is stored as it is; what it means here (can they use
 * the hub, what should their billing page say) is decided only in this file, so
 * changing a rule is a code change and never a data migration.
 */

export type StripeSubscriptionStatus = "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
export type MembershipState = "none" | "pending" | "active" | "grace" | "lapsed" | "ended";

export type SubscriptionSnapshot = {
  status: StripeSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  endedAt: string | null;
  unitAmountCents: number;
  quantity: number;
  currency: string;
  billingInterval: "month" | "year";
  intervalCount: number;
};

/** How long a failed payment keeps a member in: long enough for a card that expired on holiday. */
export const GRACE_DAYS = 7;
/** How long to let Stripe retry an event we can't match to a member, before logging it and moving on. */
export const UNRESOLVED_RETRY_WINDOW_SECONDS = 15 * 60;

const DAY_MS = 86_400_000;

/**
 * - trialing counts as active: they're a member, just not paying yet.
 * - past_due is a grace period for GRACE_DAYS after the period ended, then lapsed.
 *   Without a period end we can't prove they've lapsed, so they keep access and
 *   Stripe's own retries settle it.
 * - canceled means over. That's only right because the billing portal is set to
 *   cancel at the END of the period, which keeps Stripe saying "active" until
 *   then. If immediate cancellation is ever switched on, revisit this.
 */
export function membershipState(sub: Pick<SubscriptionSnapshot, "status" | "currentPeriodEnd"> | null, now: Date): MembershipState {
  if (!sub) return "none";
  switch (sub.status) {
    case "trialing":
    case "active":
      return "active";
    case "incomplete":
      return "pending";
    case "past_due": {
      if (!sub.currentPeriodEnd) return "grace";
      const graceEnds = Date.parse(sub.currentPeriodEnd) + GRACE_DAYS * DAY_MS;
      return now.getTime() <= graceEnds ? "grace" : "lapsed";
    }
    case "unpaid":
    case "paused":
      return "lapsed";
    case "incomplete_expired":
    case "canceled":
      return "ended";
    default:
      return "none";
  }
}

export const hasHubAccess = (state: MembershipState) => state === "active" || state === "grace";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "4 Oct", on the Melbourne calendar: a renewal just after midnight there is still that day. */
export function billingDay(iso: string): string {
  const [, m, d] = wallClockAt(Date.parse(iso), HUB_TIMEZONE).date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export type RenewalNotice = {
  kind: "renews" | "ends" | "trial" | "overdue" | "pending" | "inactive";
  label: string;
  description: string;
  /** A meaning, not a colour: the page decides how each one looks. */
  tone: "positive" | "warning" | "danger" | "neutral";
};

/** The line at the top of a member's billing page. */
export function renewalNotice(sub: SubscriptionSnapshot | null, now: Date): RenewalNotice {
  const state = membershipState(sub, now);
  const end = sub?.currentPeriodEnd ? billingDay(sub.currentPeriodEnd) : null;
  if (!sub || state === "none") return { kind: "inactive", label: "No membership", description: "Pick a plan to become a member.", tone: "neutral" };
  if (state === "pending") return { kind: "pending", label: "Payment not finished", description: "Your first payment didn’t go through. Try again, or use another card.", tone: "warning" };
  if (state === "grace") {
    return { kind: "overdue", label: "Payment overdue", description: "Your last payment didn’t go through. Update your card to keep your membership.", tone: "danger" };
  }
  if (state === "lapsed") return { kind: "inactive", label: "Membership lapsed", description: "We couldn’t take payment. Update your card to pick up where you left off.", tone: "danger" };
  if (state === "ended") {
    return { kind: "inactive", label: sub.endedAt ? `Ended ${billingDay(sub.endedAt)}` : "Membership ended", description: "Pick a plan to come back any time.", tone: "neutral" };
  }
  if (sub.status === "trialing") return { kind: "trial", label: end ? `Trial until ${end}` : "On a trial", description: "Your first payment is taken when the trial ends.", tone: "positive" };
  if (sub.cancelAtPeriodEnd) {
    return { kind: "ends", label: end ? `Ends ${end}` : "Ending", description: "You’ve cancelled. You’re still a member until then, and can change your mind.", tone: "warning" };
  }
  return { kind: "renews", label: end ? `Renews ${end}` : "Active", description: "Your membership renews automatically.", tone: "positive" };
}

/** One subscription's price as a monthly amount. Unrounded: round once, after adding up. */
export function monthlyCents(sub: Pick<SubscriptionSnapshot, "unitAmountCents" | "quantity" | "billingInterval" | "intervalCount">): number {
  const months = (sub.billingInterval === "year" ? 12 : 1) * Math.max(1, sub.intervalCount);
  return (sub.unitAmountCents * Math.max(1, sub.quantity)) / months;
}

/**
 * Monthly recurring revenue, in cents, for one currency.
 *
 * Counts active and past_due (committed, and Stripe is still collecting). A
 * trial counts nothing: it isn't revenue yet. Other currencies are left out
 * rather than converted, and the caller has to name the currency, so two can
 * never be added together by accident. Rounded once at the end: three $1,000
 * annual plans are $250.00 a month, not $249.99.
 */
export function mrrCents(subs: SubscriptionSnapshot[], currency: string): number {
  const want = currency.toLowerCase();
  const total = subs
    .filter((s) => (s.status === "active" || s.status === "past_due") && s.currency.toLowerCase() === want)
    .reduce((sum, s) => sum + monthlyCents(s), 0);
  return Math.round(total);
}

/**
 * Should an event be applied over what's stored? Compared on Stripe's clock.
 * Equal counts as fresher: two events in the same second both re-read the
 * subscription from Stripe, so whichever lands last writes the same thing.
 */
export const isFresherEvent = (incomingCreated: number, storedCreated: number) => incomingCreated >= storedCreated;

/**
 * An event we can't yet match to a member (usually because checkout is still
 * finishing) is refused so Stripe tries again, but only for a while. After
 * that it's logged for a person to sort out, so Stripe stops retrying something
 * retrying won't fix; a webhook that keeps failing eventually gets switched off,
 * and bookings share it.
 */
export function shouldRetryUnresolved(eventCreated: number, now: Date): boolean {
  return now.getTime() / 1000 - eventCreated < UNRESOLVED_RETRY_WINDOW_SECONDS;
}

const LIVE: readonly string[] = ["trialing", "active", "past_due"];

/**
 * The subscription a member's page is about. A live one (trialing, active,
 * past_due) always wins; there's at most one, the database makes sure. Without
 * one, the most recent, so a past member sees how their membership ended.
 */
export function currentSubscription<T extends { status: string; createdAt: string }>(subs: T[]): T | null {
  const live = subs.find((s) => LIVE.includes(s.status));
  if (live) return live;
  return [...subs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/**
 * "1 Oct – 31 Oct". Stripe's period end is the instant the next period starts,
 * so it's shown as the day before; otherwise every month reads "1 Oct – 1 Nov".
 */
export function periodLabel(startIso: string, endIso: string): string {
  const lastDay = new Date(Date.parse(endIso) - 1000).toISOString();
  return `${billingDay(startIso)} – ${billingDay(lastDay)}`;
}
