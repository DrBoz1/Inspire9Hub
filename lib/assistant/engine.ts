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
} from "date-fns";
import Fuse from "fuse.js";
import * as chrono from "chrono-node";
import { HUB_TIMEZONE } from "@/lib/datetime";
import { offsetMinutes, todayIn, addDaysToKey, wallClockToUtc } from "@/features/booking-map/zoned-time";
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
  const words = before.split(/[^a-z\']+/);
  return NEGATORS.some(neg => words.includes(neg));
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

// Names identify rooms. Shared amenities and locations never silently choose one.
function matchRoomName(query: string, rooms: RoomOption[]): RoomOption | null {
  const q = query.toLowerCase();
  const positive = (name: string) => {
    const idx = q.indexOf(name.toLowerCase());
    return idx >= 0 && !/\b(?:not|except|instead of)\s+(?:the\s+)?$/.test(q.slice(0, idx));
  };
  const exact = rooms.filter(room => positive(room.name));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const tokens = tokenize(q).filter(t => t.length >= 3 && !GENERIC_ROOM_WORDS.has(t));
  const candidates = new Map<string, { room: RoomOption; score: number }>();
  const index = new Fuse(rooms, { keys: ["name"], includeScore: true, ignoreLocation: true, ignoreFieldNorm: true, threshold: .25 });
  for (const token of tokens) {
    if (isNegated(q, token)) continue;
    for (const result of index.search(token)) {
      const score = result.score ?? 1;
      const previous = candidates.get(result.item.id);
      if (!previous || score < previous.score) candidates.set(result.item.id, { room: result.item, score });
    }
  }
  const ranked = [...candidates.values()].sort((a, b) => a.score - b.score);
  if (!ranked.length || ranked[0].score > .25 || (ranked[1] && ranked[1].score - ranked[0].score < .08)) return null;
  return ranked[0].room;
}

// Chrono's inferred day for a time-only phrase must never overwrite a chosen date.
function extractBookingDate(query: string, now: Date): string | null {
  const dateQuery = query.replace(/\bfor\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?)\b/gi, match => " ".repeat(match.length));
  const results = chrono.parse(dateQuery, { instant: now, timezone: offsetMinutes(now.getTime(), HUB_TIMEZONE) }, { forwardDate: true });
  const explicit = results.filter(result => {
    const c = result.start;
    return (c.isCertain("day") || c.isCertain("weekday") || c.isCertain("month") || c.isCertain("year"))
      && !/\b(?:not|except|instead of)\s*$/.test(query.toLowerCase().slice(0, result.index));
  });
  const result = explicit.at(-1);
  if (!result) return null;
  const c = result.start;
  return c.get("year") + "-" + String(c.get("month")).padStart(2, "0") + "-" + String(c.get("day")).padStart(2, "0");
}

const TIME_OF_DAY: Record<string, { start: number; end: number }> = {
  morning: { start: 9, end: 12 },
  afternoon: { start: 13, end: 17 },
  evening: { start: 17, end: 19 },
};

function parseHourToken(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const meridiem = m[3]?.toLowerCase();
  if (hour > 23 || minute > 59 || (meridiem && (hour < 1 || hour > 12))) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (!meridiem && hour >= 1 && hour <= 7) hour += 12;
  return hour + minute / 60;
}

function extractTimeRange(query: string): { start: number; end: number } | null {
  const q = query.toLowerCase().replace(/\d{4}-\d{2}-\d{2}/g, "");
  const duration = q.match(/(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+for\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?)\b/);
  if (duration) {
    const start = parseHourToken(duration[1]);
    const length = Number(duration[2]) / (duration[3].startsWith("m") ? 60 : 1);
    if (start !== null) return { start, end: start + length };
  }
  const ranged = q.match(/(?<!\d)(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|until|till|through|[-–—])\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?!\d)/);
  if (ranged) {
    const start = parseHourToken(ranged[1]);
    const end = parseHourToken(ranged[2]);
    if (start === null || end === null) return { start: NaN, end: NaN };
    return { start, end };
  }
  for (const result of chrono.parse(q)) {
    if (result.end && result.start.isCertain("hour") && result.end.isCertain("hour")) {
      const start = result.start.get("hour")! + (result.start.get("minute") ?? 0) / 60;
      const end = result.end.get("hour")! + (result.end.get("minute") ?? 0) / 60;
      return { start, end };
    }
  }
  for (const [keyword, range] of Object.entries(TIME_OF_DAY)) {
    if (new RegExp("\\b" + keyword + "\\b").test(q) && !isNegated(q, keyword)) return range;
  }
  return null;
}

function looksLikeBookingAttempt(query: string, rooms: RoomOption[]): boolean {
  const q = query.toLowerCase().trim();
  if (/^(how|what|why|when|where|who|tell me|show me|can you explain)\b/.test(q)) return false;
  if (/\b(?:don't|dont|do not|not|can't|cant)\s+(?:want to\s+)?(?:book|reserve)\b/.test(q)) return false;
  if (/\b(book|reserve)\b/.test(q)) return true;
  if (isBookingCorrectionAttempt(q)) return true;
  const room = matchRoomName(q, rooms);
  return !!room && (q.replace(/[?!.,]/g, "") === room.name.toLowerCase() || extractTimeRange(q) !== null || extractBookingDate(q, new Date()) !== null);
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
  const note = b.status === "pending" ? " · awaiting confirmation" : "";
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
          action: { label: "View payment history", href: "/history?tab=payments" },
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
        action: { label: "View payment history", href: "/history?tab=payments" },
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
      action: { label: "See my refunds", href: "/history?tab=payments" },
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

  if (/^(?:hi|hello|hey|g'?day|good morning|good afternoon)[!. ]*$/i.test(query.trim())) {
    return { intentId: "hello", reply: { text: "Hi " + ctx.firstName + ". I can help with your account or find a room for your next meeting. What would you like to do?", suggestions: ["Book a room", "Show me my account snapshot", "How do refunds work?"] } };
  }
  if (/^(?:thanks|thank you|cheers|ta)(?: very much)?[!. ]*$/i.test(query.trim())) return { intentId: "thanks", reply: { text: "You're welcome. I'm here whenever you need a hand." } };
  const room = matchRoomName(query, ctx.rooms);
  if (room && !looksLikeBookingAttempt(query, ctx.rooms) && /\b(room|space|cost|price|seats|capacity|tell|about|does|have)\b/i.test(query)) {
    return { intentId: "room-info", reply: { text: describeRoomOption(room) + "\n\nI can check a date and time when you're ready.", suggestions: ["Book " + room.name], action: { label: "Explore all spaces", href: "/bookings" } } };
  }
  if (/\b(?:what|which|show|list|tell)\b.*\b(?:rooms|spaces)\b/i.test(query)) {
    return { intentId: "room-info", reply: { text: ctx.rooms.length ? ctx.rooms.map(describeRoomOption).join("\n") : "There are no rooms listed right now. The team can help you find a space.", action: { label: "Explore spaces", href: "/bookings" } } };
  }

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


  return {
    reply: {
      text: `I’m not sure I understood. I can help with bookings, spending, refunds, induction and access passes. Try a shorter question, or I can help you draft a message to the team.`,
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
  if (draft.startHour === undefined || draft.endHour === undefined) return "time";
  return "none";
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
export function progressBooking(query: string, ctx: AssistantContext, draft: BookingDraft, now: Date = new Date()): BookingStep {
  const q = query.toLowerCase().trim();
  const next: BookingDraft = { ...draft };
  const respond = (reply: BotReply, field: "room" | "date" | "time" | null): BookingStep => ({ reply, draft: next, readyToQuote: false, cancelled: false, nextMissing: field });
  if (/^(?:please\s+)?(?:cancel(?:\s+(?:this|the|my))?(?:\s+(?:draft|request|booking))?|never\s*mind|stop|forget it|don't book|dont book)(?:\s+please)?[.!]*$/.test(q)) {
    return { reply: { text: "Draft cleared. No reservation was made. Your existing bookings are unchanged." }, draft: {}, readyToQuote: false, cancelled: true, nextMissing: null };
  }
  if (/^(how|what|why|when|where|who|tell me|does|can you explain)\b/.test(q) || /^(can|could)\b.*\b(cancel|refund)\b/.test(q)) {
    const information = matchIntent(query, ctx);
    if (information.intentId && information.intentId !== "how-to-book") {
      return respond({ ...information.reply, text: information.reply.text + (Object.keys(draft).length ? "\n\nYour booking draft is saved here when you're ready to continue." : ""), suggestions: [...(information.reply.suggestions ?? []).slice(0, 2), "Continue booking"] }, null);
    }
  }
  const room = matchRoomName(query, ctx.rooms);
  const date = extractBookingDate(query, now);
  let range = extractTimeRange(query);
  // A single start-time correction preserves the duration, never invents one.
  const singleTime = q.match(/(?:at\s+|make it\s+|start(?:ing)?(?: at)?\s+|from\s+|^)(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?!\d)/);
  if (!range && singleTime && draft.startHour !== undefined && draft.endHour !== undefined) {
    const start = parseHourToken(singleTime[1]);
    if (start !== null) range = { start, end: start + draft.endHour - draft.startHour };
  }
  const correction = isBookingCorrectionAttempt(q) || /\b(wrong|not that|not this|actually|instead|i meant)\b/.test(q);
  const field = /\b(room|space)\b/.test(q) ? "room" : /\b(date|day)\b/.test(q) ? "date" : /\b(time|hours?|slot)\b/.test(q) ? "time" : null;
  if (correction && field === "room" && !room) { delete next.roomId; delete next.roomName; }
  if (correction && field === "date" && !date) delete next.dateISO;
  if (correction && field === "time" && !range) { delete next.startHour; delete next.endHour; }
  if (/^(?:no|nope|nah|not that|wrong)[.!]*$/.test(q)) {
    return respond({ text: "Which detail should I change? I'll keep the rest.", suggestions: ["Change the room", "Change the date", "Change the time", "Cancel draft"] }, null);
  }
  if (!room && !date && !range && !correction && Object.keys(draft).length) {
    const interrupted = matchIntent(query, ctx);
    if (interrupted.intentId && interrupted.intentId !== "how-to-book") return respond({ ...interrupted.reply, text: interrupted.reply.text + "\n\nYour booking draft is saved here when you're ready to continue.", suggestions: [...(interrupted.reply.suggestions ?? []).slice(0, 2), "Continue booking"] }, inferLastAsked(next) === "none" ? null : inferLastAsked(next) as "room" | "date" | "time");
  }
  if (room) { next.roomId = room.id; next.roomName = room.name; }
  if (date) {
    const today = todayIn(HUB_TIMEZONE, now.getTime());
    if (date < today || date > addDaysToKey(today, 180)) {
      delete next.dateISO;
      return respond({ text: "Choose a date from today through the next 180 days. I've kept the other details.", suggestions: ["Today", "Tomorrow"] }, "date");
    }
    next.dateISO = date;
  }
  if (range) {
    delete next.startHour; delete next.endHour;
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) return respond({ text: "That time doesn't look valid. Try 9:30am to 11am." }, "time");
    if (range.end <= range.start) return respond({ text: "The end time needs to be after the start. What times did you mean?" }, "time");
    if (range.start < ROOM_OPEN_HOUR || range.end > ROOM_CLOSE_HOUR) return respond({ text: "Rooms are bookable between 8am and 8pm. Please choose a range within those hours." }, "time");
    if (range.end - range.start < 1 - 1e-9) return respond({ text: "The minimum booking is one hour. What start and end times work for you?" }, "time");
    next.startHour = range.start; next.endHour = range.end;
  }
  if (next.dateISO && next.startHour !== undefined && wallClockToUtc(next.dateISO, Math.round(next.startHour * 60), HUB_TIMEZONE) <= now.getTime()) {
    delete next.startHour; delete next.endHour;
    return respond({ text: "That start time has passed in Melbourne. Choose a later time, or change the date.", suggestions: ["Change the date", "Change the time"] }, "time");
  }
  const missing = inferLastAsked(next);
  if (missing === "none") return { reply: { text: "I'll check that time for you." }, draft: next, readyToQuote: true, cancelled: false, nextMissing: null };
  const repeat = !room && !date && !range && !correction && Object.keys(draft).length > 0;
  return respond(repeat ? buildRepairMessage(missing, ctx, next) : bookingPrompt(missing, ctx, next), missing);
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
