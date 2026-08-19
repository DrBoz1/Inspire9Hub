import {
  format,
  formatDistanceToNowStrict,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  startOfDay,
  subMonths,
  subWeeks,
  subYears,
  endOfYear,
  addDays,
} from "date-fns";
import Fuse from "fuse.js";
import * as chrono from "chrono-node";
import { formatHour } from "@/lib/datetime";
import { ALL_AMENITIES } from "@/lib/constants";

export type UpcomingBooking = {
  room: string;
  startISO: string;
  endISO: string;
  status: string;
};

export type PaymentInfo = {
  amount: number;
  refunded: number;
  status: string;
  dateISO: string | null;
};

export type RoomOption = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  pricePerHour: number;
  amenities: string[];
};

export type AssistantContext = {
  firstName: string;
  memberSince: string;
  inductionStatus: string;
  memberStatus: string;
  totalPaid: number;
  totalRefunded: number;
  netSpend: number;
  payments: PaymentInfo[];
  confirmedBookings: number;
  cancelledBookings: number;
  upcomingBookings: UpcomingBooking[];
  activePasses: number;
  rooms: RoomOption[];
};

export type BotReply = {
  text: string;
  action?: { label: string; href: string };
  escalate?: boolean;
  suggestions?: string[];
};

export type MatchResult = {
  reply: BotReply;
  intentId: string | null;
};

// ── Conversational booking ──────────────────────────────────────────────
// A draft is built up over one or more chat turns. Fields are only ever
// overwritten when a NEW value is actually parsed from a message — never
// cleared on a non-match — so "actually make it 3pm" naturally corrects a
// single field without losing the rest of the draft.
export type BookingDraft = {
  roomId?: string;
  roomName?: string;
  dateISO?: string; // yyyy-MM-dd, local calendar date intended
  startHour?: number;
  endHour?: number;
};

export type BookingQuote = {
  roomId: string;
  roomName: string;
  location: string;
  dateISO: string;
  startHour: number;
  endHour: number;
  pricePerHour: number;
  durationHours: number;
  totalCost: number;
};

export type BookingStep = {
  reply: BotReply;
  draft: BookingDraft;
  readyToQuote: boolean;
  cancelled: boolean;
  nextMissing: "room" | "date" | "time" | null;
};

// Short, human-readable one-liner for a room — used both in the generic
// "here's what we offer" prompt and the availability-aware suggestion list.
export function describeRoomOption(room: RoomOption): string {
  const labels = room.amenities
    .map((key) => ALL_AMENITIES.find((a) => a.key === key)?.label)
    .filter((label): label is NonNullable<typeof label> => Boolean(label))
    .slice(0, 3);
  const features = labels.length > 0 ? ` — ${labels.join(", ")}` : "";
  return `• ${room.name} (${room.capacity} seats, $${room.pricePerHour}/hr)${features}`;
}

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

// ── Stop words ─────────────────────────────────────────────────────────
// Filtered out before intent scoring so common words don't accidentally
// add weight to unrelated intents ("I do NOT want a refund" → refunds).
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "it", "i", "to", "for", "of", "and", "or", "in",
  "at", "on", "be", "was", "are", "this", "that", "my", "me", "we", "you",
  "do", "did", "have", "has", "from", "with", "can", "will", "would", "could",
  "should", "just", "up", "by", "but", "so", "if", "as", "any", "all",
  "about", "get", "got", "your", "our", "their", "its", "its", "also",
]);

// Words that appear inside room names but should NOT alone trigger a match —
// prevents "can I book a room?" from matching "Dream Room" via Fuse because
// "room" is an exact substring of that name in the search index.
const GENERIC_ROOM_WORDS = new Set([
  "room", "space", "desk", "spot", "place", "area", "office", "meeting",
]);

// Negation tokens — if one appears within ~35 chars before a keyword,
// the keyword's score contribution is flipped to a negative signal so
// "I do not want a refund" stops triggering the refunds intent.
const NEGATORS = [
  "not", "dont", "don't", "never", "no", "doesnt", "doesn't",
  "didnt", "didn't", "without", "cant", "can't", "wont", "won't",
];

function isNegated(query: string, keyword: string): boolean {
  const q = query.toLowerCase();
  const idx = q.indexOf(keyword);
  if (idx === -1) return false;
  const before = q.slice(Math.max(0, idx - 35), idx);
  return NEGATORS.some((neg) => before.includes(neg));
}

type TimeWindow = { label: string; from: Date; to: Date };

function extractTimeWindow(query: string): TimeWindow | null {
  const q = query.toLowerCase();
  const now = new Date();
  if (/\blast\s+month\b/.test(q)) {
    const m = subMonths(now, 1);
    return { label: "last month", from: startOfMonth(m), to: endOfMonth(m) };
  }
  if (/\bthis\s+month\b/.test(q))
    return { label: "this month", from: startOfMonth(now), to: now };
  if (/\blast\s+week\b/.test(q)) {
    const w = subWeeks(now, 1);
    return {
      label: "last week",
      from: startOfWeek(w, { weekStartsOn: 1 }),
      to: endOfWeek(w, { weekStartsOn: 1 }),
    };
  }
  if (/\bthis\s+week\b/.test(q))
    return {
      label: "this week",
      from: startOfWeek(now, { weekStartsOn: 1 }),
      to: now,
    };
  if (/\blast\s+year\b/.test(q)) {
    const y = subYears(now, 1);
    return { label: "last year", from: startOfYear(y), to: endOfYear(y) };
  }
  if (/\bthis\s+year\b/.test(q))
    return { label: "this year", from: startOfYear(now), to: now };
  if (/\btoday\b/.test(q))
    return { label: "today", from: startOfDay(now), to: now };
  return null;
}

function windowedSpend(payments: PaymentInfo[], win: TimeWindow) {
  let net = 0;
  let count = 0;
  for (const p of payments) {
    if (!p.dateISO) continue;
    const d = parseISO(p.dateISO);
    if (d < win.from || d > win.to) continue;
    if (p.status === "paid" || p.status === "refund_failed") {
      net += p.amount;
      count++;
    } else if (p.status === "refunded") {
      net += p.amount - (p.refunded || p.amount);
      count++;
    }
  }
  return { net, count };
}

function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

function fuzzyHit(token: string, keyword: string): number {
  if (token === keyword) return 1;
  if (keyword.length >= 5 && token.length >= 4) {
    const max = keyword.length >= 8 ? 2 : 1;
    if (editDistance(token, keyword, max) <= max) return 0.75;
  }
  return 0;
}

// ── Room matching — Fuse.js multi-field fuzzy search ───────────────────
// Previous implementation only compared the first word of each room name,
// so "book the boardroom" would fail against "South Wing Boardroom".
// Fuse.js handles multi-word names and can also match against amenity labels
// (e.g. "that room with the projector" → room whose amenities include "projector").

type RoomSearchDoc = {
  idx: number;
  name: string;
  location: string;
  amenities: string; // space-joined amenity labels for full-text search
};

function buildFuseIndex(rooms: RoomOption[]): Fuse<RoomSearchDoc> {
  const docs: RoomSearchDoc[] = rooms.map((room, idx) => {
    const amenityLabels = room.amenities
      .map((key) => ALL_AMENITIES.find((a) => a.key === key)?.label ?? key)
      .join(" ");
    return { idx, name: room.name, location: room.location, amenities: amenityLabels };
  });
  return new Fuse(docs, {
    keys: [
      { name: "name", weight: 0.65 },
      { name: "amenities", weight: 0.25 },
      { name: "location", weight: 0.1 },
    ],
    threshold: 0.45,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
  });
}

function matchRoomName(query: string, rooms: RoomOption[]): RoomOption | null {
  if (rooms.length === 0) return null;
  const q = query.toLowerCase();

  // Fast path: exact full-name substring (case-insensitive)
  for (const room of rooms) {
    if (q.includes(room.name.toLowerCase())) return room;
  }

  const fuse = buildFuseIndex(rooms);
  const scoreMap = new Map<number, number>();

  // Tokenise and strip generic room words before per-token Fuse search.
  // Without this, "can I book a room?" produces a token "room" that scores
  // 0 (exact substring) against "Dream Room" — a false positive.
  const rawTokens = q.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const searchTokens = rawTokens.filter(
    (t) => t.length >= 3 && !GENERIC_ROOM_WORDS.has(t),
  );

  for (const token of searchTokens) {
    const results = fuse.search(token);
    for (const r of results) {
      const prev = scoreMap.get(r.item.idx) ?? 1;
      scoreMap.set(r.item.idx, Math.min(prev, r.score ?? 1));
    }
  }

  // Full-phrase search — only for short messages (≤ 3 meaningful tokens)
  // where the entire query might itself be a room name or close to one.
  // Skipped for long conversational messages to prevent accidental matches.
  const fullResults = searchTokens.length <= 3 ? fuse.search(query) : [];
  for (const r of fullResults) {
    const prev = scoreMap.get(r.item.idx) ?? 1;
    scoreMap.set(r.item.idx, Math.min(prev, r.score ?? 1));
  }

  // Pick the entry with the lowest (best) Fuse score under the threshold
  let bestScore = 0.45;
  let bestIdx = -1;
  for (const [idx, score] of scoreMap) {
    if (score < bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestIdx >= 0 ? rooms[bestIdx] : null;
}

// ── Date extraction — chrono-node ──────────────────────────────────────
// Replaces hand-rolled regex that missed "next Friday afternoon", "the 3rd",
// "a week from tomorrow", "end of the month", etc. chrono-node is the
// industry-standard JS library for natural language date parsing and handles
// all of these out of the box, including relative expressions and ordinals.
function extractBookingDate(query: string, now: Date): Date | null {
  const parsed = chrono.parse(query, now, { forwardDate: true });
  if (parsed.length === 0) return null;
  const date = startOfDay(parsed[0].start.date());
  // Sanity-check: only accept dates within the next 6 months
  const ceiling = addDays(now, 180);
  if (date < startOfDay(now) || date > ceiling) return null;
  return date;
}

// ── Time extraction — chrono-node + time-of-day keywords ───────────────
// Handles standard patterns ("2pm to 4pm", "10:00–12:00") via chrono,
// and maps fuzzy time-of-day phrases to sensible business-hour windows.
const TIME_OF_DAY: Record<string, { start: number; end: number }> = {
  morning: { start: 9, end: 12 },
  afternoon: { start: 13, end: 17 },
  evening: { start: 17, end: 19 },
};

// Resolves a single time token ("2pm", "2:30pm", "14:00", "2") to a 24h hour.
// With no am/pm given, hours 1-7 are assumed PM (a coworking room booked
// "at 2" overwhelmingly means 2pm) — always surfaced back in plain language
// in the summary card so a wrong guess is obvious before anything is paid.
function parseHourToken(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let hour = parseInt(m[1]);
  if (hour > 23) return null;
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (!meridiem && hour >= 1 && hour <= 7) hour += 12;
  return hour;
}

function extractTimeRange(query: string): { start: number; end: number } | null {
  const q = query.toLowerCase();

  // Time-of-day keywords first — most explicit coworking signal
  // ("book tomorrow afternoon" → 13:00–17:00)
  for (const [keyword, range] of Object.entries(TIME_OF_DAY)) {
    if (new RegExp(`\\b${keyword}\\b`).test(q)) return range;
  }

  // chrono-node handles "2pm to 4pm", "10am - 12pm", "14:00 to 16:00",
  // "from 9 until 11", and many more patterns automatically.
  const now = new Date();
  const chronoParsed = chrono.parse(query, now);
  for (const result of chronoParsed) {
    if (result.end) {
      const startH = result.start.get("hour");
      const endH = result.end.get("hour");
      if (
        startH !== null &&
        endH !== null &&
        startH !== endH &&
        startH >= ROOM_OPEN_HOUR &&
        endH <= ROOM_CLOSE_HOUR &&
        endH > startH
      ) {
        return { start: startH, end: endH };
      }
    }
  }

  // "at 2pm for 3 hours" — single anchor + duration
  const durMatch = query.match(
    /(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+for\s+(\d{1,2})\s*h/i,
  );
  if (durMatch) {
    const start = parseHourToken(durMatch[1]);
    const dur = parseInt(durMatch[2]);
    if (start !== null && dur > 0 && dur <= 12) {
      return { start, end: Math.min(start + dur, ROOM_CLOSE_HOUR) };
    }
  }

  // Fallback: regex range pattern for bare "X to Y" without explicit am/pm
  const rangeMatch = q.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|until|till|through|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/,
  );
  if (rangeMatch) {
    const start = parseHourToken(rangeMatch[1]);
    const end = parseHourToken(rangeMatch[2]);
    if (start !== null && end !== null && start !== end) return { start, end };
  }

  return null;
}

// A booking ATTEMPT ("book the pool room", "reserve a space tomorrow") gets
// the interactive flow; an informational question ("how do I book a room?")
// still falls through to the existing how-to-book intent reply below.
// Also catches modification phrases so "change the time, 1pm-7pm" re-enters
// the booking FSM rather than falling through to the Q&A intent engine.
function looksLikeBookingAttempt(query: string, rooms: RoomOption[]): boolean {
  const q = query.toLowerCase().trim();
  if (/^(how|what|why|when|where|who|can you explain)\b/.test(q)) return false;
  if (matchRoomName(query, rooms)) return true;
  if (/\b(book|reserve)\b/.test(q)) return true;
  if (/\b(change|update|modify|switch|adjust)\s+(the\s+)?(time|date|room|slot)\b/.test(q))
    return true;
  if (/\b(different|another|other)\s+(time|date|room|slot)\b/.test(q)) return true;
  return false;
}

type Intent = {
  id: string;
  canonical: string;
  phrases: string[];
  strong: string[];
  stems: string[];
  reply: (ctx: AssistantContext, win: TimeWindow | null) => BotReply;
};

function describeBooking(b: UpcomingBooking): string {
  const when = format(parseISO(b.startISO), "EEE d MMM, h:mm a");
  const until = format(parseISO(b.endISO), "h:mm a");
  const note = b.status === "pending" ? " · payment processing" : "";
  return `${b.room} — ${when} to ${until}${note}`;
}

const INTENTS: Intent[] = [
  {
    id: "greeting",
    canonical: "Show me my account snapshot",
    phrases: ["account snapshot", "my snapshot", "my account"],
    strong: ["hi", "hello", "hey", "yo", "sup", "gday", "snapshot", "summary", "overview"],
    stems: ["morning", "afternoon", "there", "account"],
    reply: (ctx) => {
      const next = ctx.upcomingBookings[0];
      return {
        text: `Hey ${ctx.firstName}! Here's your live snapshot:\n\n• Net spend: ${aud.format(ctx.netSpend)}\n• Upcoming bookings: ${ctx.upcomingBookings.length || "none"}${next ? ` (next: ${next.room}, ${format(parseISO(next.startISO), "d MMM h:mm a")})` : ""}\n• Induction: ${ctx.inductionStatus}\n• Active passes: ${ctx.activePasses}\n\nAsk me anything — I can even break spending down by month.`,
        suggestions: ["How much did I spend this month?", "When's my next booking?"],
      };
    },
  },
  {
    id: "spending",
    canonical: "What's my total spending?",
    phrases: ["how much", "total spending", "total spend", "net spend", "have i spent"],
    strong: ["spent", "spend", "spending", "paid", "expenditure", "expenses"],
    stems: ["total", "money", "cost", "costs", "much", "bill", "payments", "payment", "net"],
    reply: (ctx, win) => {
      if (win) {
        const { net, count } = windowedSpend(ctx.payments, win);
        return {
          text:
            count > 0
              ? `For ${win.label}, your net spend is ${aud.format(net)} across ${count} payment${count === 1 ? "" : "s"}. Your all-time net spend sits at ${aud.format(ctx.netSpend)}.`
              : `No payments landed ${win.label}. Your all-time net spend is still ${aud.format(ctx.netSpend)}.`,
          action: { label: "View payment history", href: "/history" },
          suggestions: ["What about last month?", "How do refunds work?"],
        };
      }
      return {
        text:
          ctx.totalPaid > 0
            ? `All-time you've paid ${aud.format(ctx.totalPaid)}${
                ctx.totalRefunded > 0
                  ? `, received ${aud.format(ctx.totalRefunded)} back in refunds, putting your net spend at ${aud.format(ctx.netSpend)}`
                  : ` — no refunds, so your net spend is ${aud.format(ctx.netSpend)}`
              }. That's the exact same figure as the Net Spend card on your history page.`
            : `You haven't made any payments yet — your spending is a clean ${aud.format(0)}. Once you book your first room it'll show up here.`,
        action: { label: "View payment history", href: "/history" },
        suggestions: ["How much did I spend this month?"],
      };
    },
  },
  {
    id: "refunds",
    canonical: "How do refunds work?",
    phrases: ["money back", "refund policy", "get a refund"],
    strong: ["refund", "refunds", "refunded", "reimburse", "reimbursement"],
    stems: ["back", "money", "policy", "how"],
    reply: (ctx) => ({
      text: `${
        ctx.totalRefunded > 0
          ? `You've received ${aud.format(ctx.totalRefunded)} in refunds so far. `
          : ""
      }Refunds are automatic and tiered by cancellation timing:\n\n• 48+ hours before — 100% back\n• 4 to 48 hours — 50% back\n• Under 4 hours — no refund\n\nMoney returns to your card via Stripe within 5–10 business days.`,
      action: { label: "See my refunds", href: "/history" },
    }),
  },
  {
    id: "membership",
    canonical: "How long have I been a member?",
    phrases: ["how long", "been a member", "member for", "did i join"],
    strong: ["member", "membership", "joined", "join", "anniversary"],
    stems: ["long", "since", "how", "when", "been", "duration", "old"],
    reply: (ctx) => ({
      text: `You joined on ${format(parseISO(ctx.memberSince), "d MMMM yyyy")} — ${formatDistanceToNowStrict(parseISO(ctx.memberSince))} with us. Your account is ${ctx.memberStatus.toLowerCase()}, with ${ctx.confirmedBookings} confirmed booking${ctx.confirmedBookings === 1 ? "" : "s"} on record.`,
      suggestions: ["What's my total spending?"],
    }),
  },
  {
    id: "induction",
    canonical: "What's my induction status?",
    phrases: ["cant book", "can't book", "induction status", "why is booking locked"],
    strong: ["induction", "inducted", "verified", "verify", "approval", "approved", "locked", "unlock", "cant", "can't"],
    stems: ["why", "book", "review", "status", "complete", "blocked", "denied", "safety"],
    reply: (ctx) => {
      if (ctx.inductionStatus === "Complete")
        return {
          text: `Your induction is approved and your account is fully verified — booking is unlocked. If a slot looks greyed out, someone else simply got there first.`,
          action: { label: "Book a space", href: "/bookings" },
        };
      if (ctx.inductionStatus === "Submitted")
        return {
          text: `Your induction is submitted and with the Hub team right now. Reviews take 24–48 hours and you'll get an email the moment a decision lands — booking unlocks automatically after approval.`,
        };
      return {
        text: `Your induction hasn't been completed yet — that's what's keeping the booking page locked. It's a 5-minute safety form, then the team reviews within 24–48 hours.`,
        action: { label: "Start induction now", href: "/induction" },
      };
    },
  },
  {
    id: "next-booking",
    canonical: "When's my next booking?",
    phrases: ["next booking", "upcoming booking", "upcoming bookings", "any bookings", "my schedule", "booked anything"],
    strong: ["next", "upcoming"],
    stems: ["booking", "bookings", "reservation", "reservations", "schedule", "when", "have", "any"],
    reply: (ctx) => {
      const list = ctx.upcomingBookings;
      if (list.length === 1)
        return {
          text: `You've got one upcoming booking:\n\n• ${describeBooking(list[0])}\n\nYour digital access pass for it lives in your history.`,
          action: { label: "View my schedule", href: "/bookings" },
        };
      if (list.length > 1)
        return {
          text: `You've got ${list.length} upcoming bookings:\n\n${list
            .slice(0, 4)
            .map((b) => `• ${describeBooking(b)}`)
            .join("\n")}${list.length > 4 ? `\n…and ${list.length - 4} more.` : ""}`,
          action: { label: "View my schedule", href: "/bookings" },
        };
      return {
        text:
          ctx.inductionStatus === "Complete"
            ? `Nothing on the calendar right now. Rooms run 8am–8pm daily and availability updates live.`
            : `Nothing booked yet — and you'll need your induction approved before booking opens up.`,
        action:
          ctx.inductionStatus === "Complete"
            ? { label: "Browse spaces", href: "/bookings" }
            : { label: "Complete induction", href: "/induction" },
      };
    },
  },
  {
    id: "booking-stats",
    canonical: "How many bookings have I made?",
    phrases: ["how many bookings", "bookings have i made", "booking history"],
    strong: ["many"],
    stems: ["bookings", "history", "count", "made", "past", "total", "activity"],
    reply: (ctx) => ({
      text: `All-time you've made ${ctx.confirmedBookings} confirmed booking${ctx.confirmedBookings === 1 ? "" : "s"}${
        ctx.cancelledBookings > 0 ? ` and cancelled ${ctx.cancelledBookings}` : ""
      }${ctx.upcomingBookings.length > 0 ? `, with ${ctx.upcomingBookings.length} coming up` : ""}. The full timeline is on your history page.`,
      action: { label: "Open history", href: "/history" },
    }),
  },
  {
    id: "how-to-book",
    canonical: "How do I book a room?",
    phrases: ["how do i book", "book a room", "book a space", "make a booking"],
    strong: ["book", "reserve"],
    stems: ["how", "room", "space", "slot", "desk", "meeting", "booking"],
    reply: (ctx) =>
      ctx.inductionStatus === "Complete"
        ? {
            text: `Pick a room on the bookings page, choose your date and time slots (8am–8pm), and pay securely through Stripe. Your slot is held the moment checkout starts, and the confirmation email arrives with a PDF invoice attached.`,
            action: { label: "Book a space", href: "/bookings" },
          }
        : {
            text: `Booking unlocks once your safety induction is approved — that's the only thing between you and a room right now.`,
            action: { label: "Go to induction", href: "/induction" },
          },
  },
  {
    id: "cancel",
    canonical: "How do I cancel a booking?",
    phrases: ["cancel my booking", "cancel a booking", "change my booking"],
    strong: ["cancel", "cancelling", "cancellation", "reschedule", "modify"],
    stems: ["booking", "refund", "time", "move", "change"],
    reply: () => ({
      text: `Head to My Schedule on the bookings page and hit cancel — the refund processes automatically based on timing (48+ hrs: 100%, 4–48 hrs: 50%, under 4 hrs: none). To reschedule, cancel and rebook; your old slot frees up instantly.`,
      action: { label: "My schedule", href: "/bookings" },
    }),
  },
  {
    id: "access-pass",
    canonical: "Where's my access pass?",
    phrases: ["access pass", "get in", "door pass"],
    strong: ["pass", "passes", "door", "entry", "card"],
    stems: ["access", "building", "get", "in", "enter", "where"],
    reply: (ctx) => ({
      text: `${
        ctx.activePasses > 0
          ? `You have ${ctx.activePasses} active access pass${ctx.activePasses === 1 ? "" : "es"} right now. `
          : `You don't have an active access pass at the moment. `
      }A digital pass is issued automatically with every confirmed booking, valid for the booking day — all listed in your history.`,
      action: { label: "View my passes", href: "/history" },
    }),
  },
  {
    id: "hours-location",
    canonical: "Where is the Hub located?",
    phrases: ["where are you", "opening hours", "what time"],
    strong: ["hours", "open", "closed", "address", "located", "location", "visit"],
    stems: ["hub", "time", "find", "you", "where", "richmond"],
    reply: () => ({
      text: `We're at 41 Stewart St, Richmond — Melbourne VIC 3121, right near the park. The team is around Mon–Fri 9am–5pm, and room bookings run 8am–8pm every day.`,
    }),
  },
  {
    id: "invoice",
    canonical: "Where are my invoices?",
    phrases: ["tax invoice", "my invoice", "my receipt"],
    strong: ["invoice", "invoices", "receipt", "receipts", "pdf"],
    stems: ["email", "download", "copy", "tax", "gst"],
    reply: () => ({
      text: `Every confirmed booking emails you a PDF tax invoice automatically, GST breakdown included. Need one re-sent? Message the team below with the booking date and we'll sort it.`,
      action: { label: "Check past payments", href: "/history" },
    }),
  },
  {
    id: "password",
    canonical: "How do I reset my password?",
    phrases: ["reset my password", "change my password"],
    strong: ["password"],
    stems: ["reset", "change", "forgot", "login"],
    reply: () => ({
      text: `Log out and use "Forgot password" on the login screen — a secure reset link lands in your email within a minute.`,
    }),
  },
  {
    id: "human",
    canonical: "Talk to a real person",
    phrases: ["real person", "talk to someone", "speak to"],
    strong: ["human", "staff", "person", "someone", "agent", "team"],
    stems: ["talk", "speak", "contact", "real", "reach"],
    reply: () => ({
      text: `Of course — the form on this page goes straight to the Hub team's inbox and they reply within one business day.`,
      escalate: true,
    }),
  },
];

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((t) => Boolean(t) && !STOP_WORDS.has(t));
}

export function matchIntent(
  query: string,
  ctx: AssistantContext,
  lastIntentId: string | null = null,
): MatchResult {
  const normalized = query.toLowerCase().replace(/[^a-z0-9\s']/g, " ");
  const tokens = tokenize(query); // stop words already filtered
  const win = extractTimeWindow(query);

  const scored = INTENTS.map((intent) => {
    let score = 0;

    for (const phrase of intent.phrases) {
      if (normalized.includes(phrase)) score += 3;
    }

    for (const token of tokens) {
      let best = 0;
      for (const kw of intent.strong) {
        const hit = fuzzyHit(token, kw) * 2;
        if (hit > 0) {
          // Flip to a negative signal when the keyword is negated
          // ("I do not want a refund" should not score for refunds)
          if (isNegated(normalized, kw)) {
            score -= 1;
            continue;
          }
          if (hit > best) best = hit;
        }
      }
      if (best === 0) {
        for (const kw of intent.stems) {
          const hit = fuzzyHit(token, kw);
          if (hit > best) best = hit;
        }
      }
      score += best;
    }
    return { intent, score };
  }).sort((a, b) => b.score - a.score);

  const [first, second] = scored;

  if (first.score >= 2) {
    const ambiguous =
      second &&
      second.score >= 2 &&
      first.score - second.score < 0.75 &&
      first.intent.id !== second.intent.id;

    if (ambiguous) {
      return {
        reply: {
          text: `Quick check — did you mean one of these?`,
          suggestions: [first.intent.canonical, second.intent.canonical],
        },
        intentId: null,
      };
    }
    return { reply: first.intent.reply(ctx, win), intentId: first.intent.id };
  }

  // Near-miss: score 1 means the engine has a best guess but not enough confidence
  // to commit — surface it as a suggestion rather than sending a cold fallback.
  if (first.score >= 1) {
    return {
      reply: {
        text: `Did you mean "${first.intent.canonical}"? If not, I can connect you with the Hub team directly.`,
        suggestions: [first.intent.canonical],
        escalate: true,
      },
      intentId: null,
    };
  }

  if (win && lastIntentId === "spending") {
    const spending = INTENTS.find((i) => i.id === "spending")!;
    return { reply: spending.reply(ctx, win), intentId: "spending" };
  }

  if (win) {
    const spending = INTENTS.find((i) => i.id === "spending")!;
    return { reply: spending.reply(ctx, win), intentId: "spending" };
  }

  return {
    reply: {
      text: `Hmm, that one's outside what I know. I can answer questions about your spending, bookings, refunds, induction or access passes — or send it straight to the Hub team and a human will pick it up.`,
      escalate: true,
      suggestions: ["What's my total spending?", "When's my next booking?"],
    },
    intentId: null,
  };
}

// Detects whether a fresh (non-draft) message is an attempt to actually book
// something, as opposed to an informational question like "how do I book a
// room?" — the latter still falls through to the how-to-book intent above.
export function isBookingAttempt(query: string, ctx: AssistantContext): boolean {
  return looksLikeBookingAttempt(query, ctx.rooms);
}

// True when the user is modifying an existing in-progress booking rather than
// starting a fresh one — e.g. "change the time, 1pm-7pm", "different date".
// The widget uses this to restore the last known draft after a quote is cancelled,
// so the user doesn't have to re-specify room and date from scratch.
export function isBookingCorrectionAttempt(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\b(change|update|modify|switch|adjust)\s+(the\s+)?(time|date|room|slot)\b/.test(q) ||
    /\b(different|another|other)\s+(time|date|room|slot)\b/.test(q)
  );
}

const ROOM_OPEN_HOUR = 8;
const ROOM_CLOSE_HOUR = 20;

// ── Conversation state helpers ──────────────────────────────────────────

// What field is the bot currently waiting on, derived purely from the draft.
// No extra state to pass — the draft already encodes the conversation position.
function inferLastAsked(
  draft: BookingDraft,
): "room" | "date" | "time" | "none" {
  if (!draft.roomId) return "room";
  if (!draft.dateISO) return "date";
  if (draft.startHour === undefined) return "time";
  return "none";
}

// Classify a user message as a contextual negation or correction.
// Only matches clear, unambiguous signals — messages that also contain
// parseable booking data fall through to normal extraction so
// "no actually Elbow Room" correctly picks up Elbow Room.
type ResponseType = "negative" | "correction" | "other";

const NEGATIVE_PHRASES = [
  "not that",
  "not this",
  "wrong room",
  "wrong date",
  "wrong time",
  "different room",
  "different one",
  "another one",
  "other room",
  "not the right",
];

function classifyResponse(q: string): ResponseType {
  if (/^(no|nope|nah|wrong)\b/.test(q)) return "negative";
  if (NEGATIVE_PHRASES.some((p) => q.includes(p))) return "negative";
  if (/\b(actually|i meant|wait|change it|change the|instead|rather)\b/.test(q))
    return "correction";
  return "other";
}

// Repair response — fires when the bot would otherwise repeat the same
// prompt verbatim. Provides concrete examples so the user isn't stuck.
function buildRepairMessage(
  field: "room" | "date" | "time",
  ctx: AssistantContext,
  draft: BookingDraft,
): BotReply {
  if (field === "room") {
    const list = ctx.rooms.map(describeRoomOption).join("\n");
    return {
      text: `I didn't catch a room name. Here's the full list:\n\n${list}\n\nJust pick one or type the name.`,
      suggestions: ctx.rooms.map((r) => r.name),
    };
  }
  if (field === "date") {
    return {
      text: `I didn't catch a date — try "tomorrow", "next Friday", or something like "Aug 25". When would you like to book${draft.roomName ? ` ${draft.roomName}` : " the room"}?`,
      suggestions: ["Today", "Tomorrow"],
    };
  }
  return {
    text: `I didn't catch a time — try "2pm to 4pm", "afternoon", or "9am for 2 hours". What time works for you?`,
    suggestions: ["9am to 11am", "2pm to 4pm", "afternoon", "4pm to 6pm"],
  };
}

// Advances a booking draft by one chat turn. Pure and synchronous — the
// caller (the widget) is responsible for the one real async step, checking
// live availability, once readyToQuote comes back true. Never inserts a
// booking or touches payment; it only ever produces a draft for the widget
// to hand off to the existing checkRoomAvailability / createCheckoutSession
// server actions, so every guarantee those already enforce — server-side
// pricing, induction gating, conflict detection — applies unchanged here.
export function progressBooking(
  query: string,
  ctx: AssistantContext,
  draft: BookingDraft,
): BookingStep {
  const q = query.toLowerCase();

  if (/\b(cancel|never\s*mind|stop|forget it|don't book|dont book)\b/.test(q)) {
    return {
      reply: { text: `No worries, I've dropped that booking. Ask me anything else.` },
      draft: {},
      readyToQuote: false,
      cancelled: true,
      nextMissing: null,
    };
  }

  // ── Contextual response classification ───────────────────────────────
  // Must run BEFORE the mid-booking interruption so short negations like
  // "no not that" or "wrong room" are treated as booking corrections —
  // not routed to the intent engine, which would return a cold fallback.
  const lastAsked = inferLastAsked(draft);
  const responseType = classifyResponse(q);

  if (responseType === "negative") {
    // Only act as a correction if the message contains no parseable booking
    // data — "no actually Elbow Room" falls through so extraction gets it.
    const testRoom = matchRoomName(query, ctx.rooms);
    const testDate = extractBookingDate(query, new Date());
    const testTime = extractTimeRange(query);

    if (!testRoom && !testDate && !testTime) {
      if (lastAsked === "room") {
        const cleared: BookingDraft = { ...draft };
        delete cleared.roomId;
        delete cleared.roomName;
        return {
          reply: bookingPrompt("room", ctx, cleared),
          draft: cleared,
          readyToQuote: false,
          cancelled: false,
          nextMissing: "room",
        };
      }
      if (lastAsked === "date") {
        // "no not that" after the bot named a room most likely means "wrong
        // room" (the user hasn't given a date yet). Exception: if the message
        // contains a recognisable date word, clear just the date instead.
        const hasDateWord =
          /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(st|nd|rd|th)?)\b/.test(
            q,
          );
        if (hasDateWord) {
          const cleared: BookingDraft = { ...draft };
          delete cleared.dateISO;
          return {
            reply: {
              text: `No problem — what date works for you?`,
              suggestions: ["Today", "Tomorrow"],
            },
            draft: cleared,
            readyToQuote: false,
            cancelled: false,
            nextMissing: "date",
          };
        }
        // No date word → treat as "wrong room", reset fully.
        return {
          reply: bookingPrompt("room", ctx, {}),
          draft: {},
          readyToQuote: false,
          cancelled: false,
          nextMissing: "room",
        };
      }
      if (lastAsked === "time") {
        const cleared: BookingDraft = { ...draft };
        delete cleared.startHour;
        delete cleared.endHour;
        return {
          reply: {
            text: `Sure — what time works better? (e.g. "2pm to 4pm" or "afternoon")`,
            suggestions: ["9am to 11am", "2pm to 4pm", "afternoon", "4pm to 6pm"],
          },
          draft: cleared,
          readyToQuote: false,
          cancelled: false,
          nextMissing: "time",
        };
      }
    }
  }

  // ── Correction when all fields are already set ───────────────────────
  // "change the time" / "different date" after a full draft is assembled
  // (lastAsked === "none"). If the new value is provided inline
  // ("change the time, 1pm-7pm"), fall through to extraction which naturally
  // overrides the old value. If not provided, clear that field and ask.
  if (responseType === "correction" && lastAsked === "none") {
    const hasNewTime = extractTimeRange(query) !== null;
    const hasNewDate = extractBookingDate(query, new Date()) !== null;
    const hasNewRoom = matchRoomName(query, ctx.rooms) !== null;

    if (!hasNewTime && /\b(time|hours?|slot)\b/.test(q)) {
      const cleared: BookingDraft = { ...draft };
      delete cleared.startHour;
      delete cleared.endHour;
      return {
        reply: {
          text: `Sure — what time would you like instead?`,
          suggestions: ["9am to 11am", "2pm to 4pm", "afternoon", "4pm to 6pm"],
        },
        draft: cleared,
        readyToQuote: false,
        cancelled: false,
        nextMissing: "time",
      };
    }
    if (!hasNewDate && /\bdate\b/.test(q)) {
      const cleared: BookingDraft = { ...draft };
      delete cleared.dateISO;
      return {
        reply: {
          text: `Sure — what date works instead?`,
          suggestions: ["Today", "Tomorrow"],
        },
        draft: cleared,
        readyToQuote: false,
        cancelled: false,
        nextMissing: "date",
      };
    }
    if (!hasNewRoom && /\broom\b/.test(q)) {
      return {
        reply: bookingPrompt("room", ctx, {}),
        draft: {},
        readyToQuote: false,
        cancelled: false,
        nextMissing: "room",
      };
    }
    // New value provided inline — fall through to extraction.
  }

  // ── Mid-booking interruption ──────────────────────────────────────────
  // If a draft is already in progress and the new message doesn't look like a
  // booking action (no room name, no "book"/"reserve"), check whether it's an
  // off-topic Q&A question. If so, answer it and append a one-liner reminding
  // the user their draft is still waiting — no widget changes needed.
  const hasDraft = Object.keys(draft).length > 0 && (draft.roomId || draft.dateISO || draft.startHour !== undefined);
  if (hasDraft && !looksLikeBookingAttempt(query, ctx.rooms)) {
    const interrupted = matchIntent(query, ctx, null);
    if (interrupted.intentId && interrupted.intentId !== "how-to-book") {
      const parts: string[] = [];
      if (draft.roomName) parts.push(draft.roomName);
      if (draft.dateISO) parts.push(`on ${format(parseISO(draft.dateISO), "d MMM")}`);
      const reminder = parts.length > 0
        ? `\n\n_Still holding your ${parts.join(" ")} booking — just reply to continue._`
        : "";
      return {
        reply: {
          ...interrupted.reply,
          text: interrupted.reply.text + reminder,
        },
        draft,
        readyToQuote: false,
        cancelled: false,
        nextMissing: !draft.roomId ? "room" : !draft.dateISO ? "date" : "time",
      };
    }
  }

  const next: BookingDraft = { ...draft };

  const room = matchRoomName(query, ctx.rooms);
  if (room) {
    next.roomId = room.id;
    next.roomName = room.name;
  }

  const rawDate = extractBookingDate(query, new Date());
  // Don't apply a date that's explicitly negated ("not today", "not tomorrow").
  // chrono-node will still parse "today" out of "not today" — discard it.
  const dateIsNegated =
    rawDate !== null &&
    /\b(not|no|don't|dont|can't|cant)\b.{0,15}\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      query,
    );
  const date = dateIsNegated ? null : rawDate;
  if (date) next.dateISO = format(date, "yyyy-MM-dd");

  const range = extractTimeRange(query);
  if (range) {
    if (range.end <= range.start) {
      return {
        reply: { text: `The end time needs to be after the start — what times did you mean?` },
        draft: next,
        readyToQuote: false,
        cancelled: false,
        nextMissing: "time",
      };
    }
    if (range.start < ROOM_OPEN_HOUR || range.end > ROOM_CLOSE_HOUR) {
      return {
        reply: {
          text: `Rooms are bookable between 8am and 8pm — could you pick a time inside that window?`,
        },
        draft: next,
        readyToQuote: false,
        cancelled: false,
        nextMissing: "time",
      };
    }
    next.startHour = range.start;
    next.endHour = range.end;
  }

  const missing: ("room" | "date" | "time")[] = [];
  if (!next.roomId) missing.push("room");
  if (!next.dateISO) missing.push("date");
  if (next.startHour === undefined || next.endHour === undefined) missing.push("time");

  if (missing.length === 0) {
    return {
      reply: { text: `Let me check ${next.roomName} is free then…` },
      draft: next,
      readyToQuote: true,
      cancelled: false,
      nextMissing: null,
    };
  }

  // ── Loop / repetition detection ───────────────────────────────────────
  // If this turn produced no new info and the still-missing field is the same
  // one the bot just asked about, serve a repair response with concrete
  // examples instead of parroting the same prompt again.
  // The `draftHasContent` guard prevents a false trigger on the very first
  // booking turn (empty draft → bot hasn't asked anything yet).
  const nothingNewParsed = !room && !date && !range;
  const draftHasContent =
    draft.roomId !== undefined ||
    draft.dateISO !== undefined ||
    draft.startHour !== undefined;
  if (
    nothingNewParsed &&
    responseType === "other" &&
    missing.length > 0 &&
    missing[0] === lastAsked &&
    draftHasContent
  ) {
    return {
      reply: buildRepairMessage(missing[0], ctx, next),
      draft: next,
      readyToQuote: false,
      cancelled: false,
      nextMissing: missing[0],
    };
  }

  return {
    reply: bookingPrompt(missing[0], ctx, next),
    draft: next,
    readyToQuote: false,
    cancelled: false,
    nextMissing: missing[0],
  };
}

function bookingPrompt(
  field: "room" | "date" | "time",
  ctx: AssistantContext,
  draft: BookingDraft,
): BotReply {
  if (field === "room") {
    // If date+time are already known, the widget intercepts this case to run
    // a live, availability-aware version instead (see isRoomOptionsTrigger).
    // This generic listing only fires when we don't have a slot to check yet.
    const list = ctx.rooms.map(describeRoomOption).join("\n");
    return {
      text: `${
        draft.dateISO || draft.startHour !== undefined ? "Got it. " : ""
      }Here's what we've got:\n\n${list}\n\nWhich one would you like?`,
      suggestions: ctx.rooms.map((r) => r.name),
    };
  }
  if (field === "date") {
    return {
      text: `${draft.roomName} it is. What date?`,
      suggestions: ["Today", "Tomorrow"],
    };
  }
  return {
    text: `And what time? (e.g. "2pm to 4pm" or "afternoon")`,
    suggestions: ["9am to 11am", "2pm to 4pm", "afternoon", "4pm to 6pm"],
  };
}

// True when room is the only missing field and a concrete date+time is
// already known — the signal the widget uses to run a live, availability-
// aware room suggestion instead of the static listing above.
export function isRoomOptionsTrigger(step: BookingStep): boolean {
  return (
    step.nextMissing === "room" &&
    step.draft.dateISO !== undefined &&
    step.draft.startHour !== undefined &&
    step.draft.endHour !== undefined
  );
}

export const SUGGESTIONS = [
  "Show me my account snapshot",
  "What's my total spending?",
  "How much did I spend this month?",
  "When's my next booking?",
  "How long have I been a member?",
  "How do refunds work?",
  "Why can't I book a room?",
  "Where's my access pass?",
];
