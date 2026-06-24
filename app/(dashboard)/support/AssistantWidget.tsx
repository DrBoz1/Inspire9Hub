"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Sparkles,
  X,
  SendHorizonal,
  ArrowRight,
  MessageSquareText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarCheck,
  Download,
} from "lucide-react";
import {
  matchIntent,
  isBookingAttempt,
  progressBooking,
  isRoomOptionsTrigger,
  describeRoomOption,
  SUGGESTIONS,
  type AssistantContext,
  type BotReply,
  type MatchResult,
  type BookingDraft,
  type BookingQuote,
} from "@/lib/assistant/engine";
import { getAssistantContext } from "./actions";
import {
  checkRoomAvailability,
  createCheckoutSession,
  getBookingConfirmation,
  getBusyRoomIds,
} from "@/app/(dashboard)/bookings/actions";
import { formatHour, makeUTCIso, padTime } from "@/lib/datetime";

type ChatMessage = {
  id: number;
  role: "user" | "bot";
  text: string;
  action?: BotReply["action"];
  escalate?: boolean;
  suggestions?: string[];
  bookingQuote?: BookingQuote;
  bookingQuoteCancelled?: boolean;
  spotlight?: boolean;
  receiptBookingId?: string;
};

// Stashed client-side just long enough to survive the round trip to Stripe
// and back — only the booking's own non-sensitive details (room, time,
// price), never anything resembling a credential or payment token.
type StashedBooking = {
  roomId: string;
  roomName: string;
  dateISO: string;
  startHour: number;
  endHour: number;
  totalCost: number;
  startISO: string;
  endISO: string;
};
const PENDING_BOOKING_KEY = "hubAssistantPendingBooking";

let nextId = 0;

export default function AssistantWidget({
  onEscalate,
}: {
  onEscalate: (question: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [ctx, setCtx] = useState<AssistantContext | null>(null);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [bookingPending, setBookingPending] = useState(false);
  const lastQuestion = useRef("");
  const lastIntent = useRef<string | null>(null);
  const lastQuotedKey = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const booted = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  const pushBotMessage = (msg: Omit<ChatMessage, "id" | "role">) => {
    setTyping(false);
    setMessages((m) => [...m, { id: nextId++, role: "bot", ...msg }]);
  };

  // Auto-open if we're returning from a chat-initiated Stripe payment —
  // a plain mount check, kept separate from the main boot effect below so
  // `open` flips to true before that effect's [open] dependency fires.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success" && sessionStorage.getItem(PENDING_BOOKING_KEY)) {
      setOpen(true);
    }
  }, []);

  // Single boot sequence — deliberately not split across two effects. Both
  // the normal greeting and the post-payment resume need getAssistantContext
  // and both write to the same message list; doing that from independent
  // effects races (getBookingConfirmation is a lighter query and can resolve
  // before getAssistantContext, putting "you're all set!" before "hey, I'm
  // the assistant"). One sequence keeps the order deterministic.
  useEffect(() => {
    if (!open || booted.current) return;
    booted.current = true;

    const params = new URLSearchParams(window.location.search);
    const resuming = params.get("status") === "success";
    if (resuming) window.history.replaceState({}, "", window.location.pathname);

    const raw = resuming ? sessionStorage.getItem(PENDING_BOOKING_KEY) : null;
    if (raw) sessionStorage.removeItem(PENDING_BOOKING_KEY);
    let pending: StashedBooking | null = null;
    if (raw) {
      try {
        pending = JSON.parse(raw);
      } catch {
        pending = null;
      }
    }

    setTyping(true);
    getAssistantContext().then((data) => {
      setCtx(data);
      setTimeout(() => {
        setTyping(false);
        setMessages((m) => [
          ...m,
          {
            id: nextId++,
            role: "bot",
            text: data
              ? pending
                ? `Hey ${data.firstName} 👋 Welcome back — let me just check on that booking…`
                : `Hey ${data.firstName} 👋 I'm the Hub Assistant — connected live to your account.`
              : `Hey! I'm the Hub Assistant. Ask me anything about bookings, refunds, induction or the Hub itself.`,
            spotlight: !!data && !pending,
            suggestions: data && !pending ? ["Show me my account snapshot"] : undefined,
          },
        ]);

        if (pending) {
          setTyping(true);
          setTimeout(() => verifyResumedBooking(pending!, 0), 700);
        }
      }, 900);
    });
  }, [open]);

  const verifyResumedBooking = (pending: StashedBooking, attempt: number) => {
    getBookingConfirmation(pending.roomId, pending.startISO, pending.endISO).then(
      (result) => {
        if (result?.booking_status === "confirmed") {
          pushBotMessage({
            text: `🎉 You're all set! ${pending.roomName} is booked for ${format(
              parseISO(pending.dateISO),
              "EEE d MMM",
            )}, ${formatHour(pending.startHour)} – ${formatHour(
              pending.endHour,
            )}. A confirmation email with your invoice is on its way — you can also view it right here.`,
            receiptBookingId: result.id,
          });
          return;
        }
        if (attempt < 4) {
          setTimeout(() => verifyResumedBooking(pending, attempt + 1), 1500);
          return;
        }
        pushBotMessage({
          text: `Your payment went through! Your booking is just finishing up — it'll appear in your history within a moment, and a confirmation email is on its way.`,
          action: { label: "View history", href: "/history" },
        });
      },
    );
  };

  const runAvailabilityCheck = (draft: BookingDraft) => {
    const room = ctx!.rooms.find((r) => r.id === draft.roomId)!;
    const dateObj = parseISO(draft.dateISO!);
    const startISO = makeUTCIso(dateObj, draft.startHour!);
    const endISO = makeUTCIso(dateObj, draft.endHour!);

    setTimeout(async () => {
      const { available, error } = await checkRoomAvailability(
        draft.roomId!,
        startISO,
        endISO,
      );

      if (error || !available) {
        pushBotMessage({
          text: `Ah, ${room.name} just got booked for that time. Want to try a different time, or another room?`,
        });
        setBookingDraft({ roomId: draft.roomId, roomName: draft.roomName });
        return;
      }

      const durationHours = draft.endHour! - draft.startHour!;
      const quote: BookingQuote = {
        roomId: draft.roomId!,
        roomName: room.name,
        location: room.location,
        dateISO: draft.dateISO!,
        startHour: draft.startHour!,
        endHour: draft.endHour!,
        pricePerHour: room.pricePerHour,
        durationHours,
        totalCost: durationHours * room.pricePerHour,
      };
      lastQuotedKey.current = JSON.stringify(draft);
      pushBotMessage({
        text: `${room.name} is free for that slot — here's the summary:`,
        bookingQuote: quote,
      });
    }, 700);
  };

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question || typing) return;
    lastQuestion.current = question;
    setInput("");
    setUsedSuggestions((u) => [...u, question]);
    setMessages((m) => [...m, { id: nextId++, role: "user", text: question }]);
    setTyping(true);

    if (!ctx) {
      setTimeout(() => {
        pushBotMessage({ text: "Give me one second, I'm still pulling up your account…" });
      }, 500);
      return;
    }

    // ── Conversational booking flow ───────────────────────────────────
    if (bookingDraft || isBookingAttempt(question, ctx)) {
      if (!bookingDraft && ctx.inductionStatus !== "Complete") {
        setTimeout(() => {
          pushBotMessage(
            ctx.inductionStatus === "Submitted"
              ? {
                  text: `I'd love to get that booked, but your induction is still under review — booking unlocks automatically once it's approved.`,
                }
              : {
                  text: `Before I can book anything, you'll need to complete your safety induction first — it only takes a few minutes.`,
                  action: { label: "Start induction", href: "/induction" },
                },
          );
        }, 600);
        return;
      }

      const step = progressBooking(question, ctx, bookingDraft ?? {});

      if (step.cancelled) {
        setBookingDraft(null);
        lastQuotedKey.current = null;
        setTimeout(() => pushBotMessage(step.reply), 500);
        return;
      }

      if (step.readyToQuote) {
        const key = JSON.stringify(step.draft);
        if (key === lastQuotedKey.current) {
          // Nothing changed since the last summary — don't spam a duplicate
          // card, just nudge them toward the button already on screen.
          setBookingDraft(step.draft);
          setTimeout(() => {
            pushBotMessage({
              text: `That booking's still waiting above — hit Confirm & Pay, or tell me what you'd like to change.`,
            });
          }, 500);
          return;
        }
        setBookingDraft(step.draft);
        runAvailabilityCheck(step.draft);
        return;
      }

      // Room is the only thing missing and a concrete date+time is already
      // known — check what's actually free for that slot instead of just
      // asking "which room?" against the full static list.
      if (isRoomOptionsTrigger(step)) {
        setBookingDraft(step.draft);
        const { dateISO, startHour, endHour } = step.draft;
        const dateObj = parseISO(dateISO!);
        const startISO = makeUTCIso(dateObj, startHour!);
        const endISO = makeUTCIso(dateObj, endHour!);

        setTimeout(async () => {
          const busyIds = await getBusyRoomIds(startISO, endISO);
          const available = ctx.rooms.filter((r) => !busyIds.includes(r.id));
          const window_ = `${formatHour(startHour!)}–${formatHour(endHour!)} on ${format(dateObj, "EEE d MMM")}`;

          if (available.length === 0) {
            pushBotMessage({
              text: `Nothing's free ${window_} — want to try a different time?`,
            });
            setBookingDraft({});
            return;
          }

          pushBotMessage({
            text: `Here's what's free ${window_}:\n\n${available
              .map(describeRoomOption)
              .join("\n")}\n\nWhich one would you like?`,
            suggestions: available.map((r) => r.name),
          });
        }, 700);
        return;
      }

      setBookingDraft(step.draft);
      setTimeout(() => pushBotMessage(step.reply), 650 + Math.random() * 400);
      return;
    }

    // ── Normal Q&A ─────────────────────────────────────────────────────
    const result: MatchResult = matchIntent(question, ctx, lastIntent.current);
    if (result.intentId) lastIntent.current = result.intentId;

    setTimeout(() => {
      pushBotMessage(result.reply);
    }, 650 + Math.random() * 500);
  };

  const handleCancelBooking = (messageId: number) => {
    setBookingDraft(null);
    lastQuotedKey.current = null;
    setMessages((m) =>
      m.map((msg) =>
        msg.id === messageId ? { ...msg, bookingQuoteCancelled: true } : msg,
      ),
    );
    pushBotMessage({ text: `No worries, I've dropped that booking. Ask me anything else.` });
  };

  const handleConfirmBooking = async (quote: BookingQuote) => {
    setBookingPending(true);
    const dateObj = parseISO(quote.dateISO);
    const startISO = makeUTCIso(dateObj, quote.startHour);
    const endISO = makeUTCIso(dateObj, quote.endHour);

    // Stripe's redirect wipes all in-memory state — stash just enough to
    // resume here afterward. Cleared the moment it's read back (see the
    // boot effect above), and never holds anything payment-sensitive.
    const stash: StashedBooking = {
      roomId: quote.roomId,
      roomName: quote.roomName,
      dateISO: quote.dateISO,
      startHour: quote.startHour,
      endHour: quote.endHour,
      totalCost: quote.totalCost,
      startISO,
      endISO,
    };
    sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(stash));

    try {
      await createCheckoutSession({
        workspaceId: quote.roomId,
        roomName: quote.roomName,
        amount: quote.totalCost,
        date: quote.dateISO,
        startTime: padTime(quote.startHour),
        endTime: padTime(quote.endHour),
        startISO,
        endISO,
        returnTo: "/support",
      });
    } catch (err: any) {
      if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      sessionStorage.removeItem(PENDING_BOOKING_KEY);
      setBookingPending(false);
      pushBotMessage({ text: `That didn't go through: ${err.message}` });
    }
  };

  const scrollChips = (dir: 1 | -1) => {
    chipsRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
  };

  const remaining = SUGGESTIONS.filter((s) => !usedSuggestions.includes(s)).slice(0, 5);

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 260, damping: 18 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl shadow-slate-900/30"
        aria-label="Hub Assistant"
      >
        <span className="absolute inset-0 rounded-full bg-[#E31E24]/40 animate-ping [animation-duration:3s]" />
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X className="relative z-10 h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="spark"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Sparkles className="relative z-10 h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-24 right-6 z-50 flex h-144 w-[calc(100vw-3rem)] max-w-104 flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/20 dark:shadow-black/50"
          >
            <div className="relative flex items-center gap-3 bg-slate-950 px-5 py-4">
              <motion.div
                animate={{ opacity: [0.15, 0.3, 0.15] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#E31E24] blur-3xl"
              />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E31E24]">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="relative">
                <p className="text-sm font-black text-white">Hub Assistant</p>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Connected to your account
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] space-y-2 ${msg.role === "user" ? "items-end" : ""}`}
                  >
                    <div
                      className={`whitespace-pre-line rounded-2xl px-4 py-3 text-[13px] font-medium leading-relaxed ${
                        msg.role === "user"
                          ? "rounded-br-sm bg-slate-950 dark:bg-[#E31E24] text-white"
                          : "rounded-tl-sm bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {msg.text}
                    </div>

                    {msg.bookingQuote && (
                      <div
                        className={`w-full rounded-2xl bg-slate-950 dark:bg-slate-800 p-4 text-white space-y-3 relative overflow-hidden transition-opacity ${
                          msg.bookingQuoteCancelled ? "opacity-50" : ""
                        }`}
                      >
                        <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-[#E31E24]/20 blur-2xl pointer-events-none" />
                        <p className="relative text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Booking Summary
                        </p>
                        <div className="relative space-y-1">
                          <p className="text-sm font-black">{msg.bookingQuote.roomName}</p>
                          <p className="text-[11px] text-slate-400 font-bold">
                            {format(parseISO(msg.bookingQuote.dateISO), "EEE d MMM yyyy")}
                          </p>
                          <p className="text-[11px] text-slate-400 font-bold">
                            {formatHour(msg.bookingQuote.startHour)} →{" "}
                            {formatHour(msg.bookingQuote.endHour)} ·{" "}
                            {msg.bookingQuote.durationHours}h
                          </p>
                        </div>
                        <div className="relative flex items-center justify-between pt-2 border-t border-white/10">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Total (AUD)
                          </span>
                          <span className="text-xl font-black">
                            ${msg.bookingQuote.totalCost.toFixed(2)}
                          </span>
                        </div>
                        {msg.bookingQuoteCancelled ? (
                          <p className="relative text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Cancelled
                          </p>
                        ) : (
                          <div className="relative flex gap-2 pt-1">
                            <button
                              onClick={() => handleConfirmBooking(msg.bookingQuote!)}
                              disabled={bookingPending}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#E31E24] py-2.5 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                            >
                              {bookingPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Confirm & Pay"
                              )}
                            </button>
                            <button
                              onClick={() => handleCancelBooking(msg.id)}
                              disabled={bookingPending}
                              className="rounded-xl bg-white/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all hover:bg-white/15 active:scale-95 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {msg.spotlight && (
                      <button
                        onClick={() => ask("Book me a room")}
                        className="group relative w-full overflow-hidden rounded-2xl bg-linear-to-br from-[#E31E24] to-red-700 p-4 text-left shadow-lg shadow-red-500/20 transition-transform active:scale-[0.98]"
                      >
                        <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/10 blur-xl" />
                        <div className="relative flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                            <CalendarCheck className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-white/70">
                              New · The highlight of this bot
                            </p>
                            <p className="text-[13px] font-black text-white">
                              Book a room right here in chat →
                            </p>
                          </div>
                        </div>
                      </button>
                    )}

                    {msg.receiptBookingId && (
                      <a
                        href={`/api/invoice/${msg.receiptBookingId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                      >
                        <Download className="h-3 w-3" /> View &amp; Download Receipt
                      </a>
                    )}

                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => ask(s)}
                            className="rounded-full border border-red-100 dark:border-red-900/60 bg-white dark:bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-[#E31E24] dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.action && (
                      <Link
                        href={msg.action.href}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-[#E31E24] transition-colors hover:bg-red-100"
                      >
                        {msg.action.label} <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                    {msg.escalate && (
                      <button
                        onClick={() => {
                          onEscalate(lastQuestion.current);
                          setOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-slate-800"
                      >
                        <MessageSquareText className="h-3 w-3" /> Message the team
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {typing && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-slate-50 dark:bg-slate-800 px-4 py-3.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15,
                          ease: "easeInOut",
                        }}
                        className="h-1.5 w-1.5 rounded-full bg-slate-300"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {remaining.length > 0 && messages.length > 0 && (
              <div className="flex items-center gap-1 px-2 pb-2">
                <button
                  type="button"
                  onClick={() => scrollChips(-1)}
                  className="shrink-0 rounded-full p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                  aria-label="Scroll suggestions left"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <div
                  ref={chipsRef}
                  className="flex gap-2 overflow-x-auto scroll-smooth px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {remaining.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="shrink-0 rounded-full border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 transition-colors hover:border-red-100 hover:bg-red-50 hover:text-[#E31E24] dark:hover:bg-red-950/40 dark:hover:border-red-900"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => scrollChips(1)}
                  className="shrink-0 rounded-full p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                  aria-label="Scroll suggestions right"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your account…"
                className="h-11 flex-1 rounded-full bg-slate-50 dark:bg-slate-800 px-4 text-[13px] font-medium text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.88 }}
                disabled={!input.trim() || typing}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E31E24] text-white transition-opacity disabled:opacity-30"
              >
                <SendHorizonal className="h-4 w-4" />
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
