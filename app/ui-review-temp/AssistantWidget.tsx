"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight, ArrowUpRight, Check, Download, Loader2, MessageSquareText, Plus, Send, ShieldCheck } from "lucide-react";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { matchIntent, isBookingAttempt, progressBooking, isRoomOptionsTrigger, describeRoomOption, type AssistantContext, type BotReply, type BookingDraft, type BookingQuote } from "@/lib/assistant/engine";
import { formatAssistantHour as formatHour, paymentTime } from "@/lib/assistant/time";
import { getAssistantContext } from "./mocks";
import { checkRoomAvailability, createCheckoutSession, getBookingConfirmation } from "./mocks";
import { bookingInstant } from "@/app/(dashboard)/bookings/booking-time";

type ChatMessage = BotReply & { id: number; role: "user" | "bot"; quote?: BookingQuote; receiptBookingId?: string };
type StashedBooking = { roomId: string; startISO: string; endISO: string };
const PENDING_KEY = "hubAssistantPendingBooking";
const STARTERS = [{ title: "Find a space", detail: "A room for your next idea", query: "Book a room" }, { title: "My account", detail: "Your hub at a glance", query: "Show me my account snapshot" }, { title: "My next booking", detail: "See what's coming up", query: "When's my next booking?" }, { title: "A quick question", detail: "Cancellations & refunds", query: "How do refunds work?" }];

function readPending(): StashedBooking | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
    if (!raw || typeof raw !== "object" || !("roomId" in raw) || !("startISO" in raw) || !("endISO" in raw)) return null;
    if (typeof raw.roomId !== "string" || typeof raw.startISO !== "string" || typeof raw.endISO !== "string" || !Number.isFinite(Date.parse(raw.startISO)) || !Number.isFinite(Date.parse(raw.endISO))) return null;
    return { roomId: raw.roomId, startISO: raw.startISO, endISO: raw.endISO };
  } catch { return null; }
}
function removePending() { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* Browser storage is optional. */ } }

export default function AssistantWidget({ onEscalate }: { onEscalate: (question: string) => void }) {
  const [ctx, setCtx] = useState<AssistantContext | null>(null);
  const [connection, setConnection] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [activeQuote, setActiveQuote] = useState<number | null>(null);
  const quoteRef = useRef<number | null>(null);
  const requestLock = useRef(false);
  const messageId = useRef(0);
  const lastIntent = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const nextId = () => ++messageId.current;
  const disabled = busy || connection !== "ready";

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let ignore = false;
    async function boot() {
      try {
        const context = await getAssistantContext();
        if (ignore) return;
        if (!context) throw new Error("Account unavailable");
        setCtx(context); setConnection("ready");
        const resuming = new URLSearchParams(window.location.search).get("status") === "success";
        const pending = resuming ? readPending() : null;
        if (!pending) return;
        requestLock.current = true; setBusy(true);
        const result = await getBookingConfirmation(pending.roomId, pending.startISO, pending.endISO);
        if (ignore) return;
        const confirmed = result?.booking_status === "confirmed";
        setMessages(m => [...m, { id: ++messageId.current, role: "bot", text: confirmed ? "Your reservation is confirmed. You can view your receipt below." : "Your booking isn't confirmed yet. Check Activity for the latest status before attempting another payment.", receiptBookingId: confirmed ? result.id : undefined, action: { label: "View booking records", href: "/history?tab=bookings" } }]);
        // Retain a pending lookup so refreshing can verify it again.
        if (confirmed) { removePending(); const params = new URLSearchParams(window.location.search); params.delete("status"); params.delete("bookingId"); window.history.replaceState({}, "", window.location.pathname + (params.size ? "?" + params.toString() : "")); }
      } catch {
        if (!ignore) setConnection("error");
      } finally {
        if (!ignore) { requestLock.current = false; setBusy(false); }
      }
    }
    void boot();
    return () => { ignore = true; };
  }, [attempt]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }, [messages, busy]);

  function invalidateQuote() { quoteRef.current = null; setActiveQuote(null); }
  function reply(message: BotReply & { quote?: BookingQuote; receiptBookingId?: string }) {
    if (!alive.current) return;
    const id = nextId();
    if (message.quote) { quoteRef.current = id; setActiveQuote(id); }
    setMessages(m => [...m, { ...message, id, role: "bot" }]);
  }

  async function quoteBooking(next: BookingDraft, context: AssistantContext) {
    const room = context.rooms.find(r => r.id === next.roomId);
    if (!room || !next.dateISO || next.startHour === undefined || next.endHour === undefined) throw new Error("Please choose your room, date and time again.");
    const result = await checkRoomAvailability(room.id, bookingInstant(next.dateISO, next.startHour), bookingInstant(next.dateISO, next.endHour));
    if (result.error) throw new Error("I couldn't verify availability. Your draft is saved; try checking again.");
    if (!result.available) {
      reply({ text: room.name + " is unavailable at that time. I've kept your date and time so you can change just the detail you need.", suggestions: ["Change the time", "Change the room", "Change the date"] });
      return;
    }
    const duration = next.endHour - next.startHour;
    reply({ text: "That time is available. Take a look at the details before continuing.", quote: { roomId: room.id, roomName: room.name, location: room.location, dateISO: next.dateISO, startHour: next.startHour, endHour: next.endHour, pricePerHour: room.pricePerHour, durationHours: duration, totalCost: Math.round(duration * room.pricePerHour * 100) / 100 } });
  }

  async function ask(raw: string) {
    const question = raw.trim().slice(0, 1000);
    if (!question || requestLock.current || connection !== "ready") return;
    requestLock.current = true; setBusy(true); invalidateQuote(); setInput("");
    setMessages(m => [...m, { id: nextId(), role: "user", text: question }]);
    try {
      // Refresh account facts for each turn, so a conversation never relies on stale totals.
      const context = await getAssistantContext();
      if (!alive.current) return;
      if (!context) throw new Error("Your account couldn't be loaded. Try again or refresh the page.");
      setCtx(context);
      if (draft !== null || isBookingAttempt(question, context)) {
        if (context.inductionStatus !== "Complete") { reply(context.inductionStatus === "Submitted" ? { text: "Your induction is under review. Booking opens once the team approves it." } : { text: "Complete your induction before making a booking.", action: { label: "Start induction", href: "/induction" } }); return; }
        const step = progressBooking(question, context, draft ?? {});
        setDraft(step.cancelled ? null : step.draft);
        if (step.cancelled) { lastIntent.current = null; reply(step.reply); return; }
        if (step.readyToQuote) { await quoteBooking(step.draft, context); return; }
        if (isRoomOptionsTrigger(step)) {
          const startISO = bookingInstant(step.draft.dateISO!, step.draft.startHour!);
          const endISO = bookingInstant(step.draft.dateISO!, step.draft.endHour!);
          // Use checks that report errors; a failed lookup must never mean "free".
          const checks = await Promise.allSettled(context.rooms.map(async room => ({ room, result: await checkRoomAvailability(room.id, startISO, endISO) })));
          if (!alive.current) return;
          const available = checks.flatMap(check => check.status === "fulfilled" && check.value.result.available === true && !check.value.result.error ? [check.value.room] : []);
          const uncertain = checks.some(check => check.status === "rejected" || check.value.result.error);
          reply({ text: available.length ? "Available for your selected time:\n\n" + available.map(describeRoomOption).join("\n") + (uncertain ? "\n\nSome rooms couldn't be checked. You can try again for the complete list." : "") : uncertain ? "I couldn't verify all the rooms. Your draft is saved; please try again." : "No rooms are available for that time. Try changing the time or date.", suggestions: available.length ? available.map(r => r.name) : ["Change the time", "Change the date", "Check availability"] });
          return;
        }
        reply(step.reply); return;
      }
      const result = matchIntent(question, context, lastIntent.current);
      lastIntent.current = result.intentId;
      reply(result.reply);
    } catch (err) {
      reply({ text: err instanceof Error ? err.message : "I couldn't finish that request. Your draft is saved; please try again.", suggestions: draft ? ["Check availability", "Message the team"] : undefined, escalate: true });
    } finally {
      requestLock.current = false;
      if (alive.current) { setBusy(false); requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true })); }
    }
  }

  async function confirmQuote(message: ChatMessage) {
    const quote = message.quote;
    if (!quote || requestLock.current || quoteRef.current !== message.id) return;
    requestLock.current = true; setBusy(true);
    try {
      const startISO = bookingInstant(quote.dateISO, quote.startHour);
      const endISO = bookingInstant(quote.dateISO, quote.endHour);
      if (Date.parse(startISO) <= Date.now()) throw new Error("That start time has passed. Choose a later time.");
      const check = await checkRoomAvailability(quote.roomId, startISO, endISO);
      if (check.error) throw new Error("Availability couldn't be verified. Please try checking again.");
      if (!check.available) throw new Error("That time is no longer available. You can adjust your draft below.");
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ roomId: quote.roomId, startISO, endISO })); } catch { /* Checkout also returns a booking ID in the URL. */ }
      await createCheckoutSession({ workspaceId: quote.roomId, roomName: quote.roomName, amount: quote.totalCost, date: quote.dateISO, startTime: paymentTime(quote.startHour), endTime: paymentTime(quote.endHour), startISO, endISO, returnTo: "/support" });
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) throw err;
      removePending(); invalidateQuote();
      reply({ text: err instanceof Error ? err.message : "Checkout couldn't start. Please try again.", suggestions: ["Check availability", "Change the time"] });
      requestLock.current = false; setBusy(false);
    }
  }

  function newConversation() { if (requestLock.current) return; setMessages([]); setDraft(null); invalidateQuote(); lastIntent.current = null; setInput(""); inputRef.current?.focus(); }
  function handoff() {
    const transcript = messages.slice(-8).map(m => (m.role === "user" ? "Me: " : "Assistant: ") + m.text).join("\n\n");
    onEscalate(transcript || "I'd like some help with ");
  }
  const lastBotId = messages.findLast(m => m.role === "bot")?.id;

  return <section className="hub-assistant hub-surface" aria-label="Hub assistant">
    <header className="hub-assistant-header"><span className="hub-assistant-symbol"><ChatsCircleIcon size={25} weight="duotone" /></span><div><h2>Hub assistant</h2><p><i data-ready={connection === "ready"} />{connection === "loading" ? "Connecting to your account" : connection === "ready" ? "Here to make things easier" : "Connection needs a moment"}</p></div><button onClick={newConversation} disabled={disabled} aria-label="New conversation" title="New conversation"><Plus size={19} /></button></header>
    {draft && <div className="hub-chat-draft"><span className="hub-eyebrow">Booking draft</span><p>{[draft.roomName || "Choose a room", draft.dateISO ? format(parseISO(draft.dateISO), "EEE d MMM") : "Choose a date", draft.startHour !== undefined && draft.endHour !== undefined ? formatHour(draft.startHour) + "–" + formatHour(draft.endHour) : "Choose a time"].join(" · ")}</p><button disabled={disabled} onClick={() => ask("Cancel draft")}>Clear</button></div>}
    <div className="hub-chat-scroll" ref={scrollRef} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
      {!messages.length && <div className="hub-chat-welcome"><span className="hub-eyebrow">Your hub, a conversation away</span><h3>A little guidance.<br /><em>A lot less admin.</em></h3><p>{ctx ? "Hi " + ctx.firstName + ". " : ""}Ask a question, check your account, or tell me the room and time you have in mind.</p><div className="hub-chat-starters">{STARTERS.map(s => <button key={s.title} disabled={disabled} onClick={() => ask(s.query)}><strong>{s.title}<ArrowUpRight size={14} /></strong><span>{s.detail}</span></button>)}</div><p className="hub-chat-example">Try “Dream Room tomorrow, 2:30 to 4 pm”.</p></div>}
      {messages.map(msg => <article key={msg.id} className="hub-chat-message" data-role={msg.role}>
        <span className="hub-chat-author">{msg.role === "user" ? "You" : "Hub assistant"}</span><div className="hub-chat-bubble">{msg.text}</div>
        {msg.quote && <div className="hub-chat-quote" data-current={activeQuote === msg.id}><div className="hub-chat-quote-top"><span className="hub-eyebrow">Your space, your time</span><ShieldCheck size={17} /></div><h3>{msg.quote.roomName}</h3><p>{format(parseISO(msg.quote.dateISO), "EEEE, d MMMM")}</p><p>{formatHour(msg.quote.startHour)} – {formatHour(msg.quote.endHour)} · Melbourne</p><div className="hub-chat-quote-total"><span>{msg.quote.durationHours} hr × ${msg.quote.pricePerHour.toFixed(2)}</span><strong>${msg.quote.totalCost.toFixed(2)}<small>AUD</small></strong></div>
          {activeQuote === msg.id ? <><button className="hub-button hub-button-primary" disabled={disabled} onClick={() => confirmQuote(msg)}>Continue to payment<ArrowRight size={15} /></button><div className="hub-chat-quote-edit"><button disabled={disabled} onClick={() => ask("Change the time")}>Change time</button><button disabled={disabled} onClick={() => ask("Change the room")}>Change room</button></div><p className="hub-chat-quote-note">A quote, not a reservation. Confirmed after payment.</p></> : <p className="hub-chat-quote-note">Previous quote · check again for current availability</p>}
        </div>}
        {msg.receiptBookingId && <a className="hub-text-link" href={"/api/invoice/" + encodeURIComponent(msg.receiptBookingId)} target="_blank" rel="noopener noreferrer"><Download size={14} />View receipt</a>}
        {msg.action && <Link href={msg.action.href} className="hub-text-link">{msg.action.label}<ArrowUpRight size={13} /></Link>}
        {msg.escalate && <button className="hub-text-link" onClick={handoff}><MessageSquareText size={14} />Draft a message to the team</button>}
        {msg.id === lastBotId && !!msg.suggestions?.length && <div className="hub-chat-suggestions">{msg.suggestions.map(s => <button key={s} disabled={disabled} onClick={() => ask(s)}>{s}<ArrowUpRight size={11} /></button>)}</div>}
      </article>)}
      {busy && <div className="hub-chat-thinking" role="status"><Loader2 size={14} className="animate-spin" />Checking that for you…</div>}
      {connection === "error" && <div className="hub-inline-error" role="alert">I couldn't connect to your account. Your conversation is saved on this page.<button onClick={() => { setConnection("loading"); setAttempt(n => n + 1); }}>Reconnect</button><button onClick={handoff}>Message the team</button></div>}
    </div>
    <div className="hub-chat-composer"><form onSubmit={e => { e.preventDefault(); void ask(input); }}><input ref={inputRef} aria-label="Message the Hub assistant" placeholder={draft ? "Change a detail or ask a question…" : "What can I help you with?"} value={input} onChange={e => setInput(e.target.value)} maxLength={1000} disabled={connection !== "ready"} /><button type="submit" aria-label="Send message" disabled={disabled || !input.trim()}><Send size={16} /></button></form><span><Check size={10} />Account-aware help · Booking times in Melbourne</span></div>
  </section>;
}
