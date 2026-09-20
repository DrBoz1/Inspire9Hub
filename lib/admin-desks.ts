import { dayPrice } from "@/lib/spaces";

/**
 * Desks in Space management.
 *
 * A desk is sold as a day pass, and in practice every desk costs the same, so
 * the panel is about one number rather than 36 tiles: set a day price and the
 * desks go on sale; clear it and they come off. A desk with no price is simply
 * not for sale, which is the state they arrive in from the migration.
 */

export type RawDesk = {
  id: string;
  name?: string | null;
  code?: string | null;
  price_per_day?: number | string | null;
  active?: boolean | null;
  bookable?: boolean | null;
};

export type DeskSummary = {
  /** Desks that exist at all. */
  total: number;
  /** Desks an admin hasn't switched off. */
  sellable: number;
  /** Desks with a day price, so members can buy them. */
  onSale: number;
  /** The day price, or the lowest one if they differ. Null when none is set. */
  price: number | null;
  /** True when desks carry different prices, which the panel says out loud. */
  mixed: boolean;
};

export const DAY_PRICE_MIN = 1;
export const DAY_PRICE_MAX = 500;

export function summariseDesks(rows: readonly RawDesk[]): DeskSummary {
  const priced = rows.map((row) => dayPrice(row.price_per_day)).filter((n): n is number => n !== null);
  const distinct = [...new Set(priced)].sort((a, b) => a - b);
  return {
    total: rows.length,
    sellable: rows.filter((row) => row.active !== false && row.bookable !== false).length,
    onSale: priced.length,
    price: distinct[0] ?? null,
    mixed: distinct.length > 1,
  };
}

/** The same shape as a room's price check, in dollars a day rather than an hour. */
export function parseDayPrice(raw: unknown): { value: number } | { error: string } {
  const text = String(raw ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: "Enter a price like 35 or 35.50." };
  const value = Number(text);
  if (value < DAY_PRICE_MIN || value > DAY_PRICE_MAX) {
    return { error: `The price must be between $${DAY_PRICE_MIN} and $${DAY_PRICE_MAX} a day.` };
  }
  return { value };
}

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** One sentence for the panel: what members can buy right now. */
export function deskPriceNote(summary: DeskSummary): string {
  if (summary.total === 0) return "No desks yet. Run the day pass migration to add them.";
  if (summary.onSale === 0) return `${summary.total} desks, none on sale. Set a day price to open them for booking.`;
  const scope = summary.onSale === summary.total ? `All ${summary.total} desks` : `${summary.onSale} of ${summary.total} desks`;
  if (summary.mixed) return `${scope} on sale, from ${money(summary.price!)} a day. Saving a price puts them all on the same one.`;
  return `${scope} on sale at ${money(summary.price!)} a day.`;
}
