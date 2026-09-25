import { hubDateKey } from "@/lib/email/format";

/**
 * Telling a person when something needs a person.
 *
 * Every failure in this app ends in a console line, which is right for Stripe —
 * an endpoint that keeps failing gets switched off — and useless to anyone who
 * isn't reading Vercel's logs on a Tuesday. These are the few failures where
 * money or a member is stuck and only a human can unstick it.
 *
 * Not to be confused with the membership emails in lib/billing/notices.ts: those
 * report business as usual (someone joined, someone's card bounced). These report
 * the app itself failing to do its job.
 *
 * Pure by design, like notices.ts: what to send and under what key lives here,
 * sending lives in notify-staff.ts. Deliberately narrow, too — an alert that
 * arrives every day stops being read, so anything a retry can fix isn't one.
 */

export type AlertKind =
  /** A Stripe event we can't match to a member. Nothing is written until it's resolved. */
  | "billing-unmatched"
  /** Paid for a slot someone else got first, and refunding that payment failed. */
  | "refund-failed"
  /** A booking was paid for but never confirmed, found by the nightly sweep. */
  | "booking-unconfirmed"
  /** The nightly sweep found something it couldn't put right by itself. */
  | "janitor";

export type StaffAlert = {
  kind: AlertKind;
  /** What happened, in one line: it becomes the subject. */
  headline: string;
  /** The handful of facts someone needs to act. Empty values are dropped. */
  facts?: Record<string, string | number | null | undefined>;
  /** What to do about it. */
  action?: string;
  /**
   * What this alert is about — a session id, a booking id. Two different problems
   * of the same kind stay two alerts; the same problem arriving five times is one.
   */
  ref?: string;
};

export const ALERT_LABELS: Record<AlertKind, string> = {
  "billing-unmatched": "Billing needs a person",
  "refund-failed": "A refund didn’t go through",
  "booking-unconfirmed": "A paid booking isn’t confirmed",
  janitor: "The nightly check found something",
};

/**
 * One alert per kind, subject and day, in the hub's own timezone. Stripe retries
 * an event for three days and the sweep runs nightly, so without this the same
 * problem would land in the inbox again and again until it was filtered out.
 */
export function alertKey(alert: StaffAlert, now: Date): string {
  return ["alert", alert.kind, alert.ref ?? alert.headline, hubDateKey(now)].join(":");
}

export function alertSubject(alert: StaffAlert): string {
  return `${ALERT_LABELS[alert.kind]}: ${alert.headline}`;
}

/** Facts worth printing: no nulls, no blanks, values as text. */
export function alertFacts(facts: StaffAlert["facts"]): [string, string][] {
  return Object.entries(facts ?? {})
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([label, value]) => [label, String(value)]);
}
