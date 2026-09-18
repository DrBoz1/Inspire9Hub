import { HUB_TIMEZONE } from "@/lib/datetime";
import { todayIn, wallClockAt } from "@/features/booking-map/zoned-time";

/**
 * Leads: people who might become members. Pure: no React, no Supabase, `now`
 * passed in. The public enquiry form and the admin board both validate through
 * validateLead here, so the rules can't drift between the two.
 */

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const PIPELINE = ["new", "contacted", "tour_booked", "trial", "won"] as const;
export type PipelineStage = (typeof PIPELINE)[number];
export type LeadStage = PipelineStage | "lost";

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  tour_booked: "Tour booked",
  trial: "Trial",
  won: "Won",
  lost: "Lost",
};
/** Matches hub-status-badge colours, so a stage reads the same as a status elsewhere. */
export const STAGE_TONES: Record<LeadStage, string> = {
  new: "pending",
  contacted: "inactive",
  tour_booked: "inactive",
  trial: "inactive",
  won: "confirmed",
  lost: "cancelled",
};

export const INTERESTS = {
  hot_desk: "Hot desk",
  dedicated_desk: "Dedicated desk",
  private_office: "Private office",
  meeting_room: "Meeting rooms",
  event: "Event space",
  other: "Something else",
} as const;
export type Interest = keyof typeof INTERESTS;

export const SOURCES = {
  website: "Website",
  support_form: "Member support form",
  walk_in: "Walk-in",
  referral: "Referral",
  phone: "Phone",
  email: "Email",
  event: "Event",
  other: "Other",
} as const;
export type LeadSource = keyof typeof SOURCES;

export const HEARD_VIA = {
  search: "Google or another search",
  social: "Instagram or social media",
  friend: "A friend or colleague",
  passing: "Walked past the building",
  event: "At an event",
  other: "Somewhere else",
} as const;
export type HeardVia = keyof typeof HEARD_VIA;

export const LOST_REASONS = {
  price: "Price",
  location: "Location",
  timing: "Timing",
  competitor: "Chose another space",
  no_response: "Stopped replying",
  not_a_fit: "Not a fit",
  other: "Other",
} as const;
export type LostReason = keyof typeof LOST_REASONS;

const isKey = <T extends object>(map: T, value: unknown): value is keyof T => typeof value === "string" && Object.hasOwn(map, value);
export const isStage = (value: unknown): value is LeadStage => isKey(STAGE_LABELS, value);
export const isOpen = (stage: LeadStage) => stage !== "won" && stage !== "lost";
const rank = (stage: LeadStage) => (stage === "lost" ? -1 : PIPELINE.indexOf(stage));

// ─── Rows ────────────────────────────────────────────────────────────────────

export const LEAD_COLUMNS =
  "id, name, email, phone, company, interest, team_size, message, source, heard_via, stage, furthest_stage, lost_reason, owner_id, member_id, next_follow_up, last_activity_at, closed_at, created_at";

export type RawLead = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  interest?: string | null;
  team_size?: number | null;
  message?: string | null;
  source?: string | null;
  heard_via?: string | null;
  stage?: string | null;
  furthest_stage?: string | null;
  lost_reason?: string | null;
  owner_id?: string | null;
  member_id?: string | null;
  next_follow_up?: string | null;
  last_activity_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
};

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  interest: Interest;
  teamSize: number | null;
  message: string | null;
  source: LeadSource;
  heardVia: HeardVia | null;
  stage: LeadStage;
  furthestStage: PipelineStage;
  lostReason: LostReason | null;
  ownerId: string | null;
  memberId: string | null;
  nextFollowUp: string | null;
  lastActivityAt: string;
  closedAt: string | null;
  createdAt: string;
};

const clean = (value: string | null | undefined) => value?.trim() || null;

export function toLead(raw: RawLead): Lead {
  const stage = isStage(raw.stage) ? raw.stage : "new";
  const stored = isKey({ new: 1, contacted: 1, tour_booked: 1, trial: 1, won: 1 }, raw.furthest_stage) ? (raw.furthest_stage as PipelineStage) : "new";
  // Never behind the current stage, even if an older row was written without it.
  const furthest = stage !== "lost" && rank(stage) > rank(stored) ? stage : stored;
  const createdAt = raw.created_at ?? new Date(0).toISOString();
  return {
    id: raw.id,
    name: clean(raw.name) ?? "Unnamed",
    email: clean(raw.email)?.toLowerCase() ?? "",
    phone: clean(raw.phone),
    company: clean(raw.company),
    interest: isKey(INTERESTS, raw.interest) ? raw.interest : "other",
    teamSize: typeof raw.team_size === "number" ? raw.team_size : null,
    message: clean(raw.message),
    source: isKey(SOURCES, raw.source) ? raw.source : "other",
    heardVia: isKey(HEARD_VIA, raw.heard_via) ? raw.heard_via : null,
    stage,
    furthestStage: furthest,
    lostReason: isKey(LOST_REASONS, raw.lost_reason) ? raw.lost_reason : null,
    ownerId: raw.owner_id ?? null,
    memberId: raw.member_id ?? null,
    nextFollowUp: raw.next_follow_up ?? null,
    lastActivityAt: raw.last_activity_at ?? createdAt,
    closedAt: raw.closed_at ?? null,
    createdAt,
  };
}

// ─── Validation (shared by the public form and the admin form) ──────────────

export const NAME_MAX = 120;
export const MESSAGE_MAX = 2000;
export const TEAM_MAX = 500;

export type LeadField = "name" | "email" | "phone" | "company" | "interest" | "teamSize" | "message" | "heardVia" | "source" | "nextFollowUp";
export type LeadErrors = Partial<Record<LeadField, string>>;
export type LeadValues = {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  interest: Interest;
  team_size: number | null;
  message: string | null;
  heard_via: HeardVia | null;
  source: LeadSource;
  next_follow_up: string | null;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const oneLine = (value: unknown) => text(value).replace(/\s+/g, " ").trim();
/** Deliberately loose: the only reliable check of an address is a reply. This catches typos, not edge cases. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE = /^\+?[\d\s()-]{6,20}$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `staff` unlocks the fields only the admin form sets: where the lead came from
 * and a follow-up date. From the public form those are ignored, so a visitor
 * can't claim to be a referral or book themselves a follow-up.
 */
export function validateLead(
  input: Partial<Record<LeadField, unknown>>,
  options: { staff?: boolean; today?: string } = {},
): { values: LeadValues } | { errors: LeadErrors } {
  const errors: LeadErrors = {};

  const name = oneLine(input.name);
  if (!name) errors.name = "Tell us your name.";
  else if (name.length > NAME_MAX) errors.name = `Keep your name to ${NAME_MAX} characters.`;

  const email = text(input.email).trim().toLowerCase();
  if (!email) errors.email = "We need an email address to reply to.";
  else if (email.length > 254 || !EMAIL.test(email)) errors.email = "That email address doesn’t look right.";

  const phone = oneLine(input.phone) || null;
  if (phone && !PHONE.test(phone)) errors.phone = "Use digits, spaces and + only, like 0412 345 678.";

  const company = oneLine(input.company) || null;
  if (company && company.length > NAME_MAX) errors.company = `Keep the company name to ${NAME_MAX} characters.`;

  const interestRaw = text(input.interest);
  const interest: Interest = isKey(INTERESTS, interestRaw) ? interestRaw : "other";
  if (interestRaw && !isKey(INTERESTS, interestRaw)) errors.interest = "Pick one of the options.";

  const teamRaw = text(input.teamSize).trim();
  let team_size: number | null = null;
  if (teamRaw) {
    const n = Number(teamRaw);
    if (!Number.isInteger(n) || n < 1 || n > TEAM_MAX) errors.teamSize = `Enter a whole number from 1 to ${TEAM_MAX}.`;
    else team_size = n;
  }

  const message = text(input.message).replace(/\r\n?/g, "\n").trim() || null;
  if (message && message.length > MESSAGE_MAX) errors.message = `Keep it to ${MESSAGE_MAX} characters.`;

  const heardRaw = text(input.heardVia);
  const heard_via = isKey(HEARD_VIA, heardRaw) ? heardRaw : null;
  if (heardRaw && !heard_via) errors.heardVia = "Pick one of the options.";

  let source: LeadSource = "website";
  let next_follow_up: string | null = null;
  if (options.staff) {
    const sourceRaw = text(input.source);
    if (isKey(SOURCES, sourceRaw)) source = sourceRaw;
    else errors.source = "Pick where this lead came from.";

    const follow = text(input.nextFollowUp).trim();
    if (follow) {
      if (!DATE_KEY.test(follow) || Number.isNaN(Date.parse(`${follow}T00:00:00Z`))) errors.nextFollowUp = "That isn’t a real date.";
      else if (options.today && follow < options.today) errors.nextFollowUp = "Pick today or a later date.";
      else next_follow_up = follow;
    }
  }

  if (Object.keys(errors).length) return { errors };
  return { values: { name, email, phone, company, interest, team_size, message, heard_via, source, next_follow_up } };
}

// ─── Moving through the pipeline ─────────────────────────────────────────────

export type StagePatch = {
  stage: LeadStage;
  furthest_stage: PipelineStage;
  lost_reason: LostReason | null;
  closed_at: string | null;
  last_activity_at: string;
  updated_at: string;
};

/**
 * The row changes for a stage move. Any stage can move to any other, because
 * staff correct mistakes; what's protected is the history. The furthest stage
 * only moves forward, closing stamps closed_at, reopening clears it, and "lost"
 * needs a reason, because a pile of unexplained losses teaches nobody anything.
 */
export function stagePatch(lead: Pick<Lead, "stage" | "furthestStage" | "closedAt">, to: LeadStage, now: Date, lostReason?: unknown): { patch: StagePatch } | { error: string } {
  if (!isStage(to)) return { error: "Pick a stage." };
  if (to === lead.stage) return { error: `It’s already ${STAGE_LABELS[to].toLowerCase()}.` };
  const reason = to === "lost" ? (isKey(LOST_REASONS, lostReason) ? lostReason : null) : null;
  if (to === "lost" && !reason) return { error: "Say why it was lost. It’s what makes the losses worth looking at." };

  const at = now.toISOString();
  const furthest = to !== "lost" && rank(to) > rank(lead.furthestStage) ? (to as PipelineStage) : lead.furthestStage;
  const closing = !isOpen(to);
  return {
    patch: {
      stage: to,
      furthest_stage: furthest,
      lost_reason: reason,
      // Keep the original close time if it's only moving between won and lost.
      closed_at: closing ? (isOpen(lead.stage) ? at : lead.closedAt ?? at) : null,
      last_activity_at: at,
      updated_at: at,
    },
  };
}

/** The note written alongside every stage change, so the timeline tells the whole story. */
export function stageNote(from: LeadStage, to: LeadStage, lostReason?: LostReason | null): string {
  const base = `Moved from ${STAGE_LABELS[from]} to ${STAGE_LABELS[to]}`;
  return to === "lost" && lostReason ? `${base}: ${LOST_REASONS[lostReason].toLowerCase()}` : base;
}

// ─── The board ───────────────────────────────────────────────────────────────

export type LeadFilter = "open" | "all" | LeadStage;
export const LEAD_FILTERS: { value: LeadFilter; label: string }[] = [
  { value: "open", label: "Open" },
  ...(["new", "contacted", "tour_booked", "trial", "won", "lost"] as const).map((s) => ({ value: s, label: STAGE_LABELS[s] })),
  { value: "all", label: "All" },
];
export const isLeadFilter = (value: unknown): value is LeadFilter => typeof value === "string" && LEAD_FILTERS.some((f) => f.value === value);

export function matchesFilter(lead: Lead, filter: LeadFilter) {
  if (filter === "all") return true;
  if (filter === "open") return isOpen(lead.stage);
  return lead.stage === filter;
}

export function filterCounts(leads: Lead[]): Record<LeadFilter, number> {
  const counts = Object.fromEntries(LEAD_FILTERS.map((f) => [f.value, 0])) as Record<LeadFilter, number>;
  for (const lead of leads) for (const f of LEAD_FILTERS) if (matchesFilter(lead, f.value)) counts[f.value] += 1;
  return counts;
}

export function searchLeads(leads: Lead[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return leads;
  const digits = q.replace(/\D/g, "");
  return leads.filter(
    (l) =>
      [l.name, l.email, l.company ?? ""].some((v) => v.toLowerCase().includes(q)) ||
      // Phone numbers are typed with and without spaces; compare the digits.
      (digits.length >= 3 && (l.phone ?? "").replace(/\D/g, "").includes(digits)),
  );
}

export type FollowUp = "overdue" | "today" | "soon" | "later" | "none";

/** Where a follow-up date sits relative to today in Melbourne. */
export function followUpState(lead: Pick<Lead, "nextFollowUp" | "stage">, now: Date): FollowUp {
  if (!lead.nextFollowUp || !isOpen(lead.stage)) return "none";
  const today = todayIn(HUB_TIMEZONE, now.getTime());
  if (lead.nextFollowUp < today) return "overdue";
  if (lead.nextFollowUp === today) return "today";
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 3);
  return lead.nextFollowUp <= soon.toISOString().slice(0, 10) ? "soon" : "later";
}

export const STALE_DAYS = 7;

/** An open lead nobody has touched for a week, and with no follow-up booked to cover it. */
export function isStale(lead: Pick<Lead, "stage" | "lastActivityAt" | "nextFollowUp">, now: Date, days = STALE_DAYS) {
  if (!isOpen(lead.stage) || lead.nextFollowUp) return false;
  return now.getTime() - Date.parse(lead.lastActivityAt) >= days * 86_400_000;
}

/** Most urgent first: overdue follow-ups, then due today, then gone quiet, then newest. */
export function sortForBoard(leads: Lead[], now: Date): Lead[] {
  const weight = (l: Lead) => {
    const f = followUpState(l, now);
    if (f === "overdue") return 0;
    if (f === "today") return 1;
    if (isStale(l, now)) return 2;
    if (l.stage === "new") return 3;
    if (isOpen(l.stage)) return 4;
    return 5;
  };
  return [...leads].sort((a, b) => weight(a) - weight(b) || b.createdAt.localeCompare(a.createdAt));
}

// ─── Reporting ───────────────────────────────────────────────────────────────

export type FunnelStep = { stage: PipelineStage; label: string; count: number; fromPrevious: number | null; fromStart: number | null };

/**
 * How many leads reached each step, using the furthest stage each one got to.
 * A lead that toured and was then lost still counts as having toured; the
 * current stage alone would hide that and make every later step look worse.
 */
export function funnel(leads: Lead[]): { steps: FunnelStep[]; lost: number; open: number; winRate: number | null } {
  const total = leads.length;
  const steps = PIPELINE.map((stage, i) => {
    const count = leads.filter((l) => rank(l.furthestStage) >= i).length;
    return { stage, label: STAGE_LABELS[stage], count };
  }).map((step, i, all) => ({
    ...step,
    fromPrevious: i === 0 ? null : all[i - 1].count ? step.count / all[i - 1].count : null,
    fromStart: total ? step.count / total : null,
  }));
  const won = leads.filter((l) => l.stage === "won").length;
  const lost = leads.filter((l) => l.stage === "lost").length;
  return { steps, lost, open: total - won - lost, winRate: won + lost ? won / (won + lost) : null };
}

export type ChannelRow = { key: string; label: string; leads: number; won: number; winRate: number | null };

/** Leads and wins by where they came from, or how they heard of us. Busiest channel first. */
export function channelBreakdown(leads: Lead[], by: "source" | "heardVia"): ChannelRow[] {
  const labels: Record<string, string> = by === "source" ? SOURCES : { ...HEARD_VIA, unknown: "Didn’t say" };
  const rows = new Map<string, ChannelRow>();
  for (const l of leads) {
    const key = by === "source" ? l.source : (l.heardVia ?? "unknown");
    const row = rows.get(key) ?? { key, label: labels[key] ?? key, leads: 0, won: 0, winRate: null };
    row.leads += 1;
    if (l.stage === "won") row.won += 1;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((r) => {
      const closed = leads.filter((l) => (by === "source" ? l.source : (l.heardVia ?? "unknown")) === r.key && !isOpen(l.stage)).length;
      return { ...r, winRate: closed ? r.won / closed : null };
    })
    .sort((a, b) => b.leads - a.leads || b.won - a.won || a.label.localeCompare(b.label));
}

/** Median whole days from enquiry to won, on the Melbourne calendar. Null with nothing won yet. */
export function daysToWin(leads: Lead[]): number | null {
  const days = leads
    .filter((l) => l.stage === "won" && l.closedAt)
    .map((l) => {
      const from = wallClockAt(Date.parse(l.createdAt), HUB_TIMEZONE).date;
      const to = wallClockAt(Date.parse(l.closedAt!), HUB_TIMEZONE).date;
      return Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
    })
    .sort((a, b) => a - b);
  if (days.length === 0) return null;
  const mid = Math.floor(days.length / 2);
  return days.length % 2 ? days[mid] : Math.round((days[mid - 1] + days[mid]) / 2);
}
