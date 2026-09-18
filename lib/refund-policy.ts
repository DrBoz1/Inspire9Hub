// Industry-standard tiered refund policy for coworking room bookings.
// One source of truth — used by member cancellation, admin refunds, and all UI dialogs.

export type RefundPolicy = {
  percent: 0 | 50 | 100;
  label: string;
  description: string;
  color: string; // Tailwind color classes for UI badges
};

/** Hours of notice for each tier. Exported so reporting groups cancellations by the same bands the policy charges by. */
export const FULL_REFUND_HOURS = 48;
export const HALF_REFUND_HOURS = 4;

export function getRefundPolicy(bookingStartISO: string): RefundPolicy {
  const hoursUntil =
    (new Date(bookingStartISO).getTime() - Date.now()) / 3_600_000;

  if (hoursUntil <= 0) {
    return {
      percent: 0,
      label: "No Refund",
      description: "The booking has already started or passed.",
      color: "bg-slate-100 text-slate-500",
    };
  }

  if (hoursUntil >= FULL_REFUND_HOURS) {
    return {
      percent: 100,
      label: "Full Refund",
      description: "Cancelled more than 48 hours before — 100% returned.",
      color: "bg-emerald-50 text-emerald-700",
    };
  }

  if (hoursUntil >= HALF_REFUND_HOURS) {
    return {
      percent: 50,
      label: "50% Refund",
      description: "Cancelled 4–48 hours before — half the payment returned.",
      color: "bg-amber-50 text-amber-700",
    };
  }

  return {
    percent: 0,
    label: "No Refund",
    description: "Cancelled within 4 hours of the booking — no refund applies.",
    color: "bg-red-50 text-red-600",
  };
}

// Convert a percent + original amount (in dollars) to the refund amount in Stripe cents.
// Rounds to the cent, not the dollar: rounding dollars first could refund more than was paid ($12.50 -> $13).
export function calcRefundCents(
  originalAmountDollars: number,
  percent: 0 | 50 | 100,
): number {
  return Math.round(originalAmountDollars * percent); // dollars x 100 cents x percent / 100
}
