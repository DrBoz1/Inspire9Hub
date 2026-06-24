// regular_price_per_hour is a stable baseline that only moves when an admin
// explicitly opts in (see app/(admin)/admin/rooms/actions.ts). Comparing the
// current price against that fixed baseline — rather than against whatever
// the price happened to be before the last edit — is what makes the "price
// drop" badge stable across any number of edits: it only ever depends on
// where the price stands right now relative to the one anchor, never on history.
export type PriceDropInfo = {
  regularPrice: number;
  percentOff: number;
};

export function getPriceDropInfo(
  currentPrice: number,
  regularPrice: number | null | undefined,
): PriceDropInfo | null {
  if (!regularPrice || currentPrice >= regularPrice) return null;
  const percentOff = Math.round((1 - currentPrice / regularPrice) * 100);
  if (percentOff <= 0) return null;
  return { regularPrice, percentOff };
}
