import { STALE_HOLD_MINUTES } from "@/lib/booking-rules";

/**
 * The nightly sweep, as pure rules.
 *
 * A checkout that is abandoned leaves a `pending` booking behind. Stripe's
 * `checkout.session.expired` normally releases it, and a later checkout for the
 * same slot ignores anything older than STALE_HOLD_MINUTES, so availability is
 * already correct. What's left is tidiness with teeth: a row that stays pending
 * forever shows in the member's list and the admin schedule as a booking that
 * will never happen, and — much worse — a pending row that *was* paid for means
 * a member's money went somewhere their booking didn't follow.
 *
 * So the sweep splits the old holds in two: release the unpaid ones, and never
 * touch a paid one. Those get a person instead.
 */

export type PendingHold = {
  id: string;
  memberId: string | null;
  startISO: string | null;
  createdISO: string | null;
};

/** A hold older than this has outlived any checkout that could still be open. */
export const HOLD_GRACE_MINUTES = STALE_HOLD_MINUTES;

/** Holds created before this moment are the sweep's business. */
export function holdCutoff(now: Date): string {
  return new Date(now.getTime() - HOLD_GRACE_MINUTES * 60_000).toISOString();
}

/**
 * Which old holds to release and which to escalate.
 *
 * Paid is decided by the caller passing the booking ids that have a payment row,
 * and anything in that set is left exactly as it is: cancelling a booking
 * someone paid for would turn a recoverable mix-up into a refund nobody asked
 * for. A hold with no created_at is left alone too — rows from before that
 * column existed can't be aged, and guessing would cancel real bookings.
 */
export function splitHolds(
  holds: readonly PendingHold[],
  paidBookingIds: ReadonlySet<string>,
): { release: PendingHold[]; stranded: PendingHold[] } {
  const release: PendingHold[] = [];
  const stranded: PendingHold[] = [];
  for (const hold of holds) {
    if (!hold.createdISO) continue;
    (paidBookingIds.has(hold.id) ? stranded : release).push(hold);
  }
  return { release, stranded };
}

/**
 * Whether the number of holds swept is worth telling someone about.
 *
 * One or two a night is ordinary: people open checkout and change their minds.
 * A pile of them on one night means Stripe's expiry event stopped arriving, and
 * that is worth knowing, because the same endpoint confirms bookings.
 */
export const SWEEP_ALARM = 15;

export function sweepIsUnusual(released: number): boolean {
  return released >= SWEEP_ALARM;
}

/** "3 holds released, 1 left alone" — the line the job returns and logs. */
export function sweepSummary(released: number, stranded: number): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (released === 0 && stranded === 0) return "Nothing to sweep.";
  const parts = [`${plural(released, "hold")} released`];
  if (stranded > 0) parts.push(`${plural(stranded, "paid booking")} left for a person`);
  return `${parts.join(", ")}.`;
}
