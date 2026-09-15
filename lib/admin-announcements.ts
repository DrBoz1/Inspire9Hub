import { HUB_TIMEZONE, getLocalDayBoundsUTC } from "@/lib/datetime";
import { dateTile, hubDateKey } from "@/lib/admin-dashboard";
import { ANNOUNCEMENT_TYPES } from "@/lib/announcement-types";

export const TITLE_MAX = 80;
export const MESSAGE_MAX = 400;
/** The member dashboard only shows this many of the newest live announcements. */
export const NOTICEBOARD_LIMIT = 5;
export const ANNOUNCEMENT_COLUMNS = "id, title, message, type, status, created_at, expires_at";

// ─── Rows ────────────────────────────────────────────────────────────────────

export type Announcement = {
  id: string;
  title: string;
  message: string;
  type: string;
  status: "active" | "archived";
  createdAt: string;
  expiresAt: string | null;
};

export type RawAnnouncement = {
  id: string;
  title?: string | null;
  message?: string | null;
  type?: string | null;
  status?: string | null;
  created_at: string;
  expires_at?: string | null;
};

const isType = (value: unknown): value is string => ANNOUNCEMENT_TYPES.some((t) => t.key === value);

export function toAnnouncement(raw: RawAnnouncement): Announcement {
  return {
    id: raw.id,
    title: raw.title?.trim() || "Untitled announcement",
    message: raw.message?.trim() ?? "",
    type: isType(raw.type) ? raw.type : "general",
    status: raw.status === "archived" ? "archived" : "active",
    createdAt: raw.created_at,
    expiresAt: raw.expires_at ?? null,
  };
}

export function sortAnnouncements(list: Announcement[]) {
  return [...list].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

// ─── States and filters ──────────────────────────────────────────────────────

export type AnnouncementState = "live" | "ended" | "archived";
export type AnnouncementFilter = AnnouncementState | "all";

export const ANNOUNCEMENT_FILTERS: { value: AnnouncementFilter; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "ended", label: "Ended" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

export const STATE_LABELS: Record<AnnouncementState, string> = { live: "Live", ended: "Ended", archived: "Archived" };
/** Maps onto the shared status badge colours. */
export const STATE_TONES: Record<AnnouncementState, string> = { live: "active", ended: "pending", archived: "none" };

/** Nothing flips an announcement when its end date passes, so "ended" is worked out from the date. */
export function announcementState(a: Pick<Announcement, "status" | "expiresAt">, now: Date): AnnouncementState {
  if (a.status === "archived") return "archived";
  return a.expiresAt && Date.parse(a.expiresAt) <= now.getTime() ? "ended" : "live";
}

export function announcementCounts(list: Announcement[], now: Date) {
  const counts: Record<AnnouncementFilter, number> = { live: 0, ended: 0, archived: 0, all: list.length };
  for (const a of list) counts[announcementState(a, now)]++;
  return counts;
}

export const matchesAnnouncementFilter = (a: Announcement, filter: AnnouncementFilter, now: Date) =>
  filter === "all" || announcementState(a, now) === filter;

/** Exactly what the member dashboard shows: live ones, newest first, capped. */
export function noticeboard(list: Announcement[], now: Date) {
  return sortAnnouncements(list.filter((a) => announcementState(a, now) === "live")).slice(0, NOTICEBOARD_LIMIT);
}

/** PostgREST `or` filter that keeps announcements whose end date hasn't passed. */
export function notExpiredFilter(now: Date) {
  return `expires_at.is.null,expires_at.gt."${now.toISOString()}"`;
}

// ─── End dates ───────────────────────────────────────────────────────────────

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function addDays(key: string, days: number) {
  const m = key.match(DATE_KEY);
  if (!m) return key;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)).toISOString().slice(0, 10);
}

/** An end date covers that whole day in Melbourne, so it comes down at 11:59 pm. Null for anything that isn't a real date. */
export function endOfHubDay(key: string): string | null {
  const m = key.match(DATE_KEY);
  if (!m) return null;
  // Midday UTC is 10 or 11 pm the same day in Melbourne.
  const midday = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  if (midday.toISOString().slice(0, 10) !== key) return null;
  return getLocalDayBoundsUTC(HUB_TIMEZONE, midday).endUTC;
}

/** The Melbourne day an announcement ends on, for the date picker. */
export const endDateKey = (expiresAt: string) => hubDateKey(new Date(expiresAt));

export function endPresets(today: string) {
  return [
    { label: "No end date", value: "" },
    { label: "End of today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "In a week", value: addDays(today, 7) },
  ];
}

/** "2026-09-18" as "Friday 18 September". */
export function dateKeyLabel(key: string) {
  const m = key.match(DATE_KEY);
  if (!m) return key;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", ...options }).format(date);
  return `${part({ weekday: "long" })} ${part({ day: "numeric" })} ${part({ month: "long" })}`;
}

/** "Tue 23 Jun", with the year only when it isn't this year. */
function hubDay(iso: string, now: Date) {
  const { weekday, day, month } = dateTile(iso);
  const year = hubDateKey(new Date(iso)).slice(0, 4);
  return `${weekday} ${day} ${month}${year === hubDateKey(now).slice(0, 4) ? "" : ` ${year}`}`;
}

export const postedLabel = (a: Pick<Announcement, "createdAt">, now: Date) => `Posted ${hubDay(a.createdAt, now)}`;

export function endLabel(a: Pick<Announcement, "expiresAt">, now: Date) {
  if (!a.expiresAt) return "No end date";
  return `${Date.parse(a.expiresAt) <= now.getTime() ? "Ended" : "Ends"} ${hubDay(a.expiresAt, now)}`;
}

// ─── The form ────────────────────────────────────────────────────────────────

export type AnnouncementField = "type" | "title" | "message" | "endsOn";
export type AnnouncementErrors = Partial<Record<AnnouncementField, string>>;
export type AnnouncementValues = { title: string; message: string; type: string; expires_at: string | null };

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Shared by the form and the server, which checks everything again. */
export function validateAnnouncement(
  input: Record<AnnouncementField, unknown>,
  today: string,
): { values: AnnouncementValues } | { errors: AnnouncementErrors } {
  const title = text(input.title).replace(/\s+/g, " ").trim();
  const message = text(input.message).replace(/\r\n?/g, "\n").trim();
  const type = text(input.type);
  const endsOn = text(input.endsOn).trim();
  const errors: AnnouncementErrors = {};

  if (!isType(type)) errors.type = "Pick a category.";
  if (!title) errors.title = "Give it a title.";
  else if (title.length > TITLE_MAX) errors.title = `Keep the title to ${TITLE_MAX} characters.`;
  if (!message) errors.message = "Write the message members will see.";
  else if (message.length > MESSAGE_MAX) errors.message = `Keep the message to ${MESSAGE_MAX} characters.`;

  const expires_at = endsOn ? endOfHubDay(endsOn) : null;
  if (endsOn && !expires_at) errors.endsOn = "That isn’t a real date.";
  else if (endsOn && endsOn < today) errors.endsOn = "That date has passed. Pick today or later, or clear it.";

  return Object.keys(errors).length ? { errors } : { values: { title, message, type, expires_at } };
}
