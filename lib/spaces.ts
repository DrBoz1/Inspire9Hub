/**
 * Rooms and desks live in the same `workspaces` table. A desk is sold by the day
 * (a day pass), a room by the hour, and most screens only ever want one or the
 * other: the room list must not grow 36 desk cards, and utilisation must not
 * average rooms with desks.
 */

type SpaceRow = { kind?: string | null; space_group?: string | null };

/** A hot desk sold as a day pass, as opposed to a room booked by the hour. */
export function isDeskRow(row: SpaceRow): boolean {
  return row.kind === "desk" || row.space_group === "desks";
}

export const roomsOnly = <T extends SpaceRow>(rows: readonly T[]): T[] => rows.filter((row) => !isDeskRow(row));
export const desksOnly = <T extends SpaceRow>(rows: readonly T[]): T[] => rows.filter(isDeskRow);

/** A desk's day price, or null when it isn't on sale. */
export function dayPrice(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

type Desk = { id: string; code?: string | null; name?: string | null };

/**
 * The desks still free, in the order they're offered: bank by bank, A1 to F6.
 * "Any free desk" takes the first; a member who wants a particular one picks it
 * on the floor plan instead.
 */
export function freeDesks<T extends Desk>(desks: readonly T[], taken: ReadonlySet<string>): T[] {
  const label = (d: Desk) => (d.code ?? d.name ?? "").trim();
  return desks
    .filter((d) => !taken.has(d.id))
    .sort((a, b) => label(a).localeCompare(label(b), "en", { numeric: true }));
}
