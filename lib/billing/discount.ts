/**
 * Member rates on room bookings. Pure: the same functions price what a member
 * sees and what checkout charges, so the two can't disagree.
 *
 * Rounded to the cent at the end, never to the dollar, and never below zero.
 */

const cents = (n: number) => Math.round(n * 100) / 100;

/** A plan's discount as a whole percentage from 0 to 100; anything else is no discount. */
export function parseDiscount(value: unknown): number {
  const n = typeof value === "string" ? Number(value.trim().replace(/%$/, "")) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** The hourly rate a member pays. */
export function memberRate(pricePerHour: number, percent: number): number {
  const p = parseDiscount(percent);
  return Math.max(0, cents(pricePerHour * (1 - p / 100)));
}

/**
 * What a booking costs a member. Worked out from the full price and the hours,
 * then discounted and rounded once, so a 90-minute booking at $25 an hour with
 * 15% off is $31.88, not the $31.87 you'd get by rounding the hourly rate first.
 */
export function memberTotal(pricePerHour: number, hours: number, percent: number): number {
  const p = parseDiscount(percent);
  return Math.max(0, cents(pricePerHour * hours * (1 - p / 100)));
}

type PricedRow = { price_per_hour: number | string | null; regular_price_per_hour?: number | string | null };

/**
 * Rooms as a member should see them: the member rate as the price, the full
 * price kept as the "regular" one it's compared against, and the percentage for
 * labelling. Display only; checkout works the charge out again from the database.
 */
export function withMemberRates<T extends PricedRow>(rows: T[], percent: number): (T & { member_discount_percent: number })[] {
  const p = parseDiscount(percent);
  if (p === 0) return rows.map((row) => ({ ...row, member_discount_percent: 0 }));
  return rows.map((row) => {
    // Number(null) is 0, not "no number": a room with no price must stay unpriced, not become free.
    const raw = row.price_per_hour;
    const full = raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "") ? NaN : Number(raw);
    if (!Number.isFinite(full)) return { ...row, member_discount_percent: 0 };
    return { ...row, price_per_hour: memberRate(full, p), regular_price_per_hour: full, member_discount_percent: p };
  });
}
