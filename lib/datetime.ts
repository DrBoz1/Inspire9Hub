export function formatHour(h: number) {
  if (h === 12) return "12:00 PM";
  if (h === 0 || h === 24) return "12:00 AM";
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
}

// Build a proper UTC ISO string from a local date + local hour.
// new Date(y, m, d, h) is constructed in the browser's local timezone,
// so .toISOString() correctly converts it to UTC for server storage.
// Shared by BookingModal and the Hub Assistant's conversational booking flow
// so both paths produce identical, timezone-correct results.
export function makeUTCIso(date: Date, hour: number): string {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    0,
    0,
    0,
  ).toISOString();
}

export function padTime(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// The Hub operates in Melbourne, but server-side code (Vercel functions,
// cron jobs) runs in UTC. Melbourne is always ahead of UTC, so for several
// hours every day (10-11h in winter, 11h in summer) UTC's calendar date is
// still "yesterday" relative to Melbourne — any "today" boundary computed
// with new Date().toISOString().split("T")[0] or .setHours(0,0,0,0) on the
// server is checking the wrong calendar day for a meaningful chunk of every
// single day. This must be the single source of truth for "today" anywhere
// that decision affects what a Melbourne-local user sees as "today".
export const HUB_TIMEZONE = "Australia/Melbourne";

// Returns the UTC instant range [start, end) corresponding to a full local
// calendar day in `timeZone`, computed via Intl so DST transitions (Melbourne
// shifts between UTC+10 and UTC+11) are handled correctly without a date
// library. `referenceDate` lets callers ask about a day other than "now".
export function getLocalDayBoundsUTC(
  timeZone: string,
  referenceDate: Date = new Date(),
): { startUTC: string; endUTC: string } {
  // Re-parsing the same instant's wall-clock string in two zones and diffing
  // cancels out whatever zone this process happens to be running in, leaving
  // just `timeZone`'s current UTC offset — correct on either side of a DST
  // transition because it's derived from `referenceDate` itself, not a
  // fixed constant.
  const asUTC = new Date(referenceDate.toLocaleString("en-US", { timeZone: "UTC" }));
  const asZoned = new Date(referenceDate.toLocaleString("en-US", { timeZone }));
  const offsetMs = asZoned.getTime() - asUTC.getTime();

  const localNow = new Date(referenceDate.getTime() + offsetMs);
  const y = localNow.getUTCFullYear();
  const m = localNow.getUTCMonth();
  const d = localNow.getUTCDate();

  const startUTC = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - offsetMs);
  const endUTC = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - offsetMs);
  return { startUTC: startUTC.toISOString(), endUTC: endUTC.toISOString() };
}
