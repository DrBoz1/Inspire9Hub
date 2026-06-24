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
