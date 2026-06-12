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

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

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
    stems: ["back", "money", "policy", "get", "how"],
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
    .filter(Boolean);
}

export function matchIntent(
  query: string,
  ctx: AssistantContext,
  lastIntentId: string | null = null,
): MatchResult {
  const normalized = query.toLowerCase().replace(/[^a-z0-9\s']/g, " ");
  const tokens = tokenize(query);
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
        if (hit > best) best = hit;
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
