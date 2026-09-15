import { HUB_TIMEZONE } from "@/lib/datetime";
import { DAY_END, DAY_START } from "@/features/booking-map/booking/time";

export type DashBooking = {
  id: string;
  workspaceId: string | null;
  start: string;
  end: string;
  status: string;
  room: string;
  member: string;
};
export type DashPending = { id: string; name: string; company: string | null; submittedOn: string | null };
export type DashRoom = { id: string; name: string };
export type DashboardData = {
  now: string;
  pendingCount: number;
  activeMembers: number;
  totalMembers: number;
  nextWeekCount: number;
  today: DashBooking[];
  upcoming: DashBooking[];
  pending: DashPending[];
  rooms: DashRoom[];
};
export type BookingPhase = "finished" | "in_use" | "upcoming";

// ─── Supabase rows → dashboard shapes ────────────────────────────────────────

type Maybe<T> = T | T[] | null | undefined;
export type RawBooking = {
  id: string;
  workspace_id?: string | null;
  start_date_time: string;
  end_date_time: string;
  booking_status: string;
  workspaces?: Maybe<{ name?: string | null }>;
  members?: Maybe<{ full_name?: string | null }>;
};
export type RawPending = {
  id: string;
  full_name?: string | null;
  company_name?: string | null;
  induction_records?: Maybe<{ completion_date?: string | null }>;
};

/** Supabase returns an embedded relation as an object or a one-item array, depending on how it reads the foreign key. */
function one<T>(value: Maybe<T>): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export function toDashBooking(row: RawBooking): DashBooking {
  return {
    id: row.id,
    workspaceId: row.workspace_id ?? null,
    start: row.start_date_time,
    end: row.end_date_time,
    status: row.booking_status,
    room: one(row.workspaces)?.name?.trim() || "Room",
    member: one(row.members)?.full_name?.trim() || "Member",
  };
}

export function toDashPending(row: RawPending): DashPending {
  return {
    id: row.id,
    name: row.full_name?.trim() || "New member",
    company: row.company_name?.trim() || null,
    submittedOn: one(row.induction_records)?.completion_date ?? null,
  };
}

/** Oldest submission first: that's who has waited longest. */
export function sortPending(list: DashPending[]) {
  return [...list].sort((a, b) => (a.submittedOn ?? "9999").localeCompare(b.submittedOn ?? "9999") || a.name.localeCompare(b.name));
}

// ─── Melbourne time ──────────────────────────────────────────────────────────

const clockFormat = new Intl.DateTimeFormat("en-AU", { timeZone: HUB_TIMEZONE, hour: "numeric", minute: "2-digit", hourCycle: "h23" });

function clockParts(date: Date) {
  const parts = clockFormat.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: get("hour") % 24, minute: get("minute") };
}

export function minutesInHub(date: Date) {
  const { hour, minute } = clockParts(date);
  return hour * 60 + minute;
}

export function hubDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: HUB_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function greetingFor(now: Date) {
  const { hour } = clockParts(now);
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function formatClock(date: Date) {
  const { hour, minute } = clockParts(date);
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

export function formatRange(start: string, end: string) {
  return `${formatClock(new Date(start))} – ${formatClock(new Date(end))}`;
}

function hubPart(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-AU", { timeZone: HUB_TIMEZONE, ...options }).format(date);
}

/** "Tuesday 15 September" */
export function formatLongDay(date: Date) {
  return `${hubPart(date, { weekday: "long" })} ${hubPart(date, { day: "numeric" })} ${hubPart(date, { month: "long" })}`;
}

export function dateTile(iso: string) {
  const date = new Date(iso);
  return { weekday: hubPart(date, { weekday: "short" }), day: hubPart(date, { day: "numeric" }), month: hubPart(date, { month: "short" }) };
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export function bookingPhase(b: Pick<DashBooking, "start" | "end">, now: Date): BookingPhase {
  if (new Date(b.end) <= now) return "finished";
  if (new Date(b.start) <= now) return "in_use";
  return "upcoming";
}

export function startsIn(start: string, now: Date) {
  const minutes = Math.round((new Date(start).getTime() - now.getTime()) / 60000);
  if (minutes < 1) return "Starting now";
  if (minutes < 60) return `In ${minutes} min`;
  return `In ${Math.round(minutes / 30) / 2} h`;
}

/** Confirmed bookings only: an unpaid checkout isn't a booking yet. */
export function todayOverview(today: DashBooking[], now: Date) {
  const confirmed = today.filter((b) => b.status === "confirmed");
  const inUse = confirmed.filter((b) => bookingPhase(b, now) === "in_use");
  return {
    total: confirmed.length,
    inUse: inUse.length,
    toCome: confirmed.filter((b) => bookingPhase(b, now) === "upcoming").length,
    roomsInUse: new Set(inUse.map((b) => b.workspaceId ?? b.room)).size,
  };
}

export function dashboardSummary(pendingCount: number, bookingsToday: number, roomsInUse: number) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const parts = [
    pendingCount ? `${plural(pendingCount, "induction")} to review` : "no inductions to review",
    bookingsToday ? `${plural(bookingsToday, "booking")} today` : "no bookings today",
  ];
  if (roomsInUse) parts.push(`${plural(roomsInUse, "room")} in use right now`);
  const text = parts.length === 3 ? `${parts[0]}, ${parts[1]} and ${parts[2]}` : `${parts[0]} and ${parts[1]}`;
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

// ─── Inductions ──────────────────────────────────────────────────────────────

export function waitingDays(submittedOn: string | null, todayKey: string) {
  const parse = (key: string) => {
    const m = key.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  };
  if (!submittedOn) return null;
  const days = Math.round((parse(todayKey) - parse(submittedOn)) / 86_400_000);
  return Number.isFinite(days) ? Math.max(0, days) : null;
}

export function waitingLabel(days: number | null) {
  if (days === null) return "Waiting";
  if (days === 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function oldestWaitingHint(pending: DashPending[], todayKey: string) {
  if (pending.length === 0) return "All caught up";
  const days = waitingDays(pending[0].submittedOn, todayKey);
  if (days === null) return `${pending.length} waiting`;
  return days === 0 ? "Oldest came in today" : `Oldest waiting ${days} day${days === 1 ? "" : "s"}`;
}

// ─── Room timeline ───────────────────────────────────────────────────────────

/** The widest day the floor plan ever draws, so no booking falls off the edge. */
export const TIMELINE = { start: DAY_START, end: DAY_END };
export const TIMELINE_TICKS = [9 * 60, 12 * 60, 15 * 60, 18 * 60];

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampToTimeline = (minutes: number) => Math.min(TIMELINE.end, Math.max(TIMELINE.start, minutes));

export function timelinePercent(minutes: number) {
  return round2(((clampToTimeline(minutes) - TIMELINE.start) / (TIMELINE.end - TIMELINE.start)) * 100);
}

function minutesToday(b: DashBooking, todayKey: string) {
  const start = new Date(b.start);
  const end = new Date(b.end);
  const from = hubDateKey(start) < todayKey ? 0 : minutesInHub(start);
  const to = hubDateKey(end) > todayKey ? 1440 : minutesInHub(end);
  return { from, to: Math.max(from, to) };
}

export function formatBooked(minutes: number) {
  if (minutes <= 0) return "Free";
  if (minutes < 60) return `${minutes} min`;
  return `${Number((minutes / 60).toFixed(1))} h`;
}

export function roomTimelines(rooms: DashRoom[], today: DashBooking[], now: Date, limit = 8) {
  const todayKey = hubDateKey(now);
  const rows = rooms.map((room) => {
    const mine = today.filter((b) => b.workspaceId === room.id);
    let bookedMinutes = 0;
    const segments = mine.flatMap((b) => {
      const { from, to } = minutesToday(b, todayKey);
      if (b.status === "confirmed") bookedMinutes += to - from;
      const left = timelinePercent(from);
      // From raw minutes, so rounding the two ends doesn't shave the width.
      const width = round2(((clampToTimeline(to) - clampToTimeline(from)) / (TIMELINE.end - TIMELINE.start)) * 100);
      if (width <= 0) return [];
      return [{ id: b.id, left, width, phase: bookingPhase(b, now), status: b.status, label: `${formatRange(b.start, b.end)}, ${b.member}${b.status === "pending" ? " (awaiting payment)" : ""}` }];
    });
    const inUse = mine.some((b) => b.status === "confirmed" && bookingPhase(b, now) === "in_use");
    return { id: room.id, name: room.name, segments, bookedMinutes, inUse, count: mine.length };
  });
  rows.sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || a.name.localeCompare(b.name));

  const nowMinutes = minutesInHub(now);
  const nowPct = nowMinutes >= TIMELINE.start && nowMinutes <= TIMELINE.end ? timelinePercent(nowMinutes) : null;
  return { rows: rows.slice(0, limit), hidden: Math.max(0, rows.length - limit), nowPct };
}
