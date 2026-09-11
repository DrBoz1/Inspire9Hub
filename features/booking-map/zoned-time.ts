/**
 * Wall-clock time in the hub's zone, converted to and from UTC instants.
 *
 * Two time models meet in the booking map. The map reasons in venue wall-clock
 * minutes ("the Dream Room, 10:00-11:00 on the 24th"); the database stores
 * `timestamptz` instants in UTC. Converting carelessly shifts every booking by the
 * UTC offset -- and Melbourne's offset changes twice a year, so a conversion that
 * is right in August can be an hour wrong in November.
 *
 * Rules this module keeps, all enforced by zoned-time.test.ts:
 *
 * - Never reads the machine's timezone. The server runs in UTC, members' browsers
 *   run in whatever zone the laptop is set to; the answer must be the same in all of
 *   them. Everything goes through Intl with an explicit zone.
 * - A wall-clock time that doesn't exist (the hour skipped when daylight saving
 *   starts) resolves forward: 02:30 on DST-start day becomes 03:30.
 * - A wall-clock time that happens twice (the hour repeated when it ends) resolves
 *   to the first occurrence.
 * - Bad input throws rather than silently rolling over. `new Date(2026, 1, 30)` is
 *   2 March; here "2026-02-30" is an error.
 *
 * No dependencies: date-fns in this project has no timezone support, and the one
 * operation needed -- "what does the wall clock read in zone Z at instant T" -- is
 * exactly what Intl.DateTimeFormat does.
 */

const DAY_MS = 86_400_000;
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface WallClock {
  /** Calendar date in the zone, "YYYY-MM-DD". */
  date: string;
  /** Minutes since that date's midnight, 0..1439. */
  mins: number;
}

// ── date keys ─────────────────────────────────────────────────────────────────

/** Parse "YYYY-MM-DD", rejecting anything that isn't a real calendar date. */
export function parseDateKey(key: string): [year: number, month: number, day: number] {
  const m = DATE_KEY.exec(key);
  if (!m) throw new RangeError(`Not a date key: ${JSON.stringify(key)}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) {
    throw new RangeError(`No such date: ${key}`);
  }
  return [y, mo, d];
}

export function isDateKey(key: string): boolean {
  try {
    parseDateKey(key);
    return true;
  } catch {
    return false;
  }
}

/** Calendar arithmetic on date keys. Pure date maths, so no zone is involved. */
export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = parseDateKey(key);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Day of week for a date key, 0 = Sunday. Zone-free for the same reason. */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = parseDateKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ── reading the wall clock ────────────────────────────────────────────────────

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    // Throws a RangeError for an unknown zone, which is the behaviour we want.
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

function partsAt(instantMs: number, tz: string) {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  // Some engines have printed midnight as "24" even with h23; the date part is
  // already the new day in that case, so 24 means 0.
  const hour = out.hour === 24 ? 0 : out.hour;
  return { y: out.year, mo: out.month, d: out.day, h: hour, mi: out.minute, s: out.second };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** What the wall clock in `tz` reads at a UTC instant. */
export function wallClockAt(instantMs: number, tz: string): WallClock {
  const p = partsAt(instantMs, tz);
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, mins: p.h * 60 + p.mi };
}

/** The zone's UTC offset at an instant, in minutes. Melbourne: 600 or 660. */
export function offsetMinutes(instantMs: number, tz: string): number {
  const p = partsAt(instantMs, tz);
  const wallAsUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  const wholeSecond = instantMs - (((instantMs % 1000) + 1000) % 1000);
  return Math.round((wallAsUtc - wholeSecond) / 60_000);
}

// ── writing the wall clock ────────────────────────────────────────────────────

/**
 * The UTC instant at which the wall clock in `tz` reads `mins` past midnight on
 * `date`. `mins` may be 1440, meaning midnight at the end of that day -- the natural
 * end of a half-open day.
 */
export function wallClockToUtc(date: string, mins: number, tz: string): number {
  const [y, m, d] = parseDateKey(date);
  if (!Number.isInteger(mins) || mins < 0 || mins > 1440) {
    throw new RangeError(`Minutes must be a whole number from 0 to 1440, got ${mins}`);
  }

  // The requested wall clock, read as though it were UTC. Date.UTC rolls 1440
  // over to the next day's 00:00, which is what we want.
  const naive = Date.UTC(y, m - 1, d, 0, mins);
  const want = { date: new Date(naive).toISOString().slice(0, 10), mins: mins % 1440 };

  // The true instant is naive minus the offset in force at that moment -- but
  // which offset that is depends on the instant we're trying to find. Try the
  // offsets from a day either side: at most one transition happens between them.
  const before = offsetMinutes(naive - DAY_MS, tz);
  const after = offsetMinutes(naive + DAY_MS, tz);
  const candidates =
    before === after
      ? [naive - before * 60_000]
      : [naive - before * 60_000, naive - after * 60_000].sort((a, b) => a - b);

  // Sorted ascending, so a repeated hour returns its first occurrence.
  for (const t of candidates) {
    const w = wallClockAt(t, tz);
    if (w.date === want.date && w.mins === want.mins) return t;
  }

  // Neither round-trips: the time was skipped by a spring-forward. Resolve it
  // forward, by the length of the gap -- 02:30 becomes 03:30.
  return naive - before * 60_000;
}

/** A zone-local calendar day as a half-open [start, end) pair of UTC instants.
 *  23 hours long when daylight saving starts, 25 when it ends. */
export function dayBoundsUtc(date: string, tz: string): { start: number; end: number } {
  return { start: wallClockToUtc(date, 0, tz), end: wallClockToUtc(date, 1440, tz) };
}

/** Today's date key in `tz` -- not the date on the machine running the code. */
export function todayIn(tz: string, nowMs: number = Date.now()): string {
  return wallClockAt(nowMs, tz).date;
}

/** Minutes past midnight right now, on the wall clock in `tz`. */
export function minutesNowIn(tz: string, nowMs: number = Date.now()): number {
  return wallClockAt(nowMs, tz).mins;
}
