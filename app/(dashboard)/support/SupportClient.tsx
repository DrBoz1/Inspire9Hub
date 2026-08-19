"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  MapPin,
  Clock,
  ChevronDown,
  Send,
  CheckCircle2,
  Loader2,
  CalendarX,
  CreditCard,
  ShieldCheck,
  KeyRound,
  MessageCircleQuestion,
  ArrowRight,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendSupportRequest } from "./actions";
import AssistantWidget from "./AssistantWidget";

const TOPICS = [
  { label: "Booking Issue", icon: CalendarX },
  { label: "Payments & Refunds", icon: CreditCard },
  { label: "Induction", icon: ShieldCheck },
  { label: "Access Pass", icon: KeyRound },
  { label: "General Enquiry", icon: MessageCircleQuestion },
];

const FAQS = [
  {
    q: "How do refunds work when I cancel a booking?",
    a: "Cancellations are automatic and tiered. Cancel 48+ hours before your booking for a full refund, between 4 and 48 hours for a 50% refund, and under 4 hours no refund applies. Refunds go straight back to your card through Stripe — usually within 5–10 business days.",
  },
  {
    q: "How long does induction approval take?",
    a: "The Hub team reviews submissions within 24–48 hours. You'll get an email the moment a decision is made, and your dashboard compliance bar updates in real time. Booking unlocks automatically once you're approved.",
  },
  {
    q: "Can I reschedule a booking instead of cancelling?",
    a: "Currently the quickest way is to cancel your existing booking (the refund policy applies) and book the new slot. Your old slot is released instantly so others can use it.",
  },
  {
    q: "Where is my access pass?",
    a: "A digital access pass is issued automatically every time a booking is confirmed. You can find all your passes under History → Access Passes, along with their validity dates.",
  },
  {
    q: "Why can't I see the booking page?",
    a: "Booking is locked until your safety induction is approved. If you've already submitted it, it's likely still under review — check the compliance card on your dashboard for the current status.",
  },
  {
    q: "I paid but my booking shows as pending. What now?",
    a: "Confirmation usually lands within seconds of payment. If it's been more than a few minutes, contact us below with your booking time and we'll chase it up — your slot is held either way.",
  },
];

const CONTACT_CHIPS = [
  { icon: Mail, label: "hello@inspire9.com" },
  { icon: MapPin, label: "41 Stewart St, Richmond VIC" },
  { icon: Clock, label: "Staffed Mon–Fri · 9am–5pm" },
];

export default function SupportClient({ firstName }: { firstName: string }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const escalateFromBot = (question: string) => {
    setSent(false);
    setTopic("General Enquiry");
    if (question) setMessage(question);
    document
      .getElementById("support-form")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = () => {
    if (!topic) {
      toast.error("Pick a topic first", {
        description: "It helps us route your message to the right person.",
      });
      return;
    }
    const formData = new FormData();
    formData.set("topic", topic);
    formData.set("message", message);

    startTransition(async () => {
      const result = await sendSupportRequest(formData);
      if (result?.error) {
        toast.error("Couldn't send", { description: result.error });
        return;
      }
      setSent(true);
    });
  };

  return (
    <div className="w-full space-y-8 font-poppins pb-16">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[40px] bg-slate-950 px-8 pt-12 pb-0 md:px-12 md:pt-14"
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-linear-to-r from-transparent via-[#E31E24]/80 to-transparent" />

        {/* Primary red orb — top left */}
        <motion.div
          aria-hidden
          animate={{ x: [0, 40, -15, 0], y: [0, -20, 15, 0], scale: [1, 1.12, 0.95, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-28 -left-20 h-96 w-96 rounded-full bg-[#E31E24]/20 blur-[100px] pointer-events-none"
        />

        {/* Secondary dim red orb — bottom right */}
        <motion.div
          aria-hidden
          animate={{ x: [0, -30, 20, 0], y: [0, 25, -15, 0], scale: [1, 0.92, 1.08, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-24 -right-16 h-104 w-104 rounded-full bg-[#E31E24]/10 blur-[110px] pointer-events-none"
        />

        {/* Dot grid */}
        <motion.div
          aria-hidden
          animate={{ opacity: [0.05, 0.09, 0.05] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 max-w-2xl pb-10">
          {/* Status pill */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
              Hub team replies within 24h
            </span>
          </motion.div>

          {/* Headline — word-by-word blur reveal */}
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-white md:text-6xl">
            {["How", "can", "we", "help?"].map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  delay: 0.25 + i * 0.09,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`mr-3 inline-block ${i === 3 ? "text-[#E31E24]" : ""}`}
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.68, duration: 0.5 }}
            className="mt-5 max-w-lg text-base font-medium leading-relaxed text-slate-400"
          >
            Hey {firstName} — booking hiccup, refund question or just saying
            hi, you&apos;re in the right place.
          </motion.p>
        </div>

        {/* Contact chips — bottom strip inside hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.45 }}
          className="relative z-10 flex flex-wrap gap-0 border-t border-white/8"
        >
          {CONTACT_CHIPS.map((chip, i) => (
            <div
              key={chip.label}
              className={`flex items-center gap-3 px-6 py-5 text-sm font-semibold text-slate-400 hover:text-white transition-colors duration-200 ${
                i < CONTACT_CHIPS.length - 1
                  ? "border-r border-white/8"
                  : ""
              }`}
            >
              <chip.icon className="h-4 w-4 text-[#E31E24] shrink-0" />
              {chip.label}
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* ── FAQ + Contact form ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="lg:col-span-3"
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Frequently Asked
              </span>
              <span className="text-[10px] font-black text-[#E31E24] uppercase tracking-widest">
                / {FAQS.length} questions
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <motion.div
                  key={faq.q}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.06 }}
                  className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                    open
                      ? "border-transparent shadow-md bg-white dark:bg-slate-900 ring-1 ring-[#E31E24]/20"
                      : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-start gap-4 px-6 py-5 text-left group"
                  >
                    {/* Number */}
                    <span
                      className={`shrink-0 font-black tabular-nums text-[11px] mt-0.5 transition-colors duration-200 ${
                        open ? "text-[#E31E24]" : "text-slate-300 dark:text-slate-600 group-hover:text-[#E31E24]"
                      }`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <span
                      className={`flex-1 text-sm font-bold leading-snug transition-colors duration-200 ${
                        open
                          ? "text-[#E31E24]"
                          : "text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white"
                      }`}
                    >
                      {faq.q}
                    </span>

                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className={`shrink-0 rounded-full p-1.5 mt-0.5 transition-colors duration-200 ${
                        open
                          ? "bg-red-50 dark:bg-red-950/40 text-[#E31E24]"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <div className="flex gap-4 px-6 pb-6">
                          {/* Left accent bar */}
                          <div className="w-0.5 shrink-0 rounded-full bg-[#E31E24]/30 ml-[calc(11px)]" />
                          <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                            {faq.a}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Contact form */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="lg:col-span-2"
        >
          <div
            id="support-form"
            className="sticky top-6 overflow-hidden rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800"
          >
            {/* Dark header strip */}
            <div className="relative overflow-hidden bg-slate-950 px-7 py-6">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-linear-to-r from-transparent via-[#E31E24]/60 to-transparent" />
              <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#E31E24]/15 blur-2xl pointer-events-none" />
              <p className="relative text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                Direct message
              </p>
              <h3 className="relative mt-1 text-xl font-black tracking-tight text-white">
                Talk to the team
              </h3>
              <p className="relative mt-0.5 text-sm font-medium text-slate-400">
                Pick a topic and tell us what&apos;s up.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="flex flex-col items-center px-8 py-16 text-center bg-white dark:bg-slate-900"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: 0.15,
                      type: "spring",
                      stiffness: 300,
                      damping: 15,
                    }}
                    className="relative mb-6"
                  >
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-100 opacity-60" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    </div>
                  </motion.div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Message sent!
                  </h3>
                  <p className="mt-2 max-w-xs text-sm font-medium leading-relaxed text-slate-500">
                    The Hub team has your message and will reply to your email
                    within one business day.
                  </p>
                  <button
                    onClick={() => {
                      setSent(false);
                      setTopic(null);
                      setMessage("");
                    }}
                    className="mt-8 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#E31E24] underline-offset-4 hover:underline"
                  >
                    Send another <ArrowRight className="h-3 w-3" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="p-7 bg-white dark:bg-slate-900"
                >
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((t) => {
                      const selected = topic === t.label;
                      return (
                        <motion.button
                          key={t.label}
                          type="button"
                          whileTap={{ scale: 0.93 }}
                          onClick={() => setTopic(t.label)}
                          className={`relative flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                            selected
                              ? "text-white dark:text-slate-900"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          {selected && (
                            <motion.span
                              layoutId="topic-pill"
                              transition={{
                                type: "spring",
                                stiffness: 350,
                                damping: 28,
                              }}
                              className="absolute inset-0 rounded-full bg-slate-900 dark:bg-white"
                            />
                          )}
                          <t.icon className="relative z-10 h-3.5 w-3.5" />
                          <span className="relative z-10">{t.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe what you need help with…"
                      rows={6}
                      maxLength={2000}
                      className="resize-none rounded-2xl border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm leading-relaxed text-slate-700 dark:text-slate-200 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-600"
                    />
                    <div className="mt-1.5 flex justify-end">
                      <span
                        className={`text-[10px] font-bold tabular-nums ${
                          message.length > 1800
                            ? "text-[#E31E24]"
                            : "text-slate-300"
                        }`}
                      >
                        {message.length}/2000
                      </span>
                    </div>
                  </div>

                  {/* Send button — shimmer sweep when active */}
                  <button
                    disabled={pending || message.trim().length < 10}
                    onClick={handleSubmit}
                    className="relative mt-4 flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#E31E24] text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-red-100 dark:shadow-red-900/20 transition-all hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    {/* Shimmer sweep */}
                    {!pending && message.trim().length >= 10 && (
                      <span
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                          backgroundSize: "200% auto",
                          animation: "shimmer-wave 2s linear infinite",
                        }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Send Message <Send className="h-4 w-4" />
                        </>
                      )}
                    </span>
                  </button>

                  <p className="mt-4 text-center text-[11px] font-medium text-slate-300">
                    Sent securely from your member account — no spam, ever.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <AssistantWidget onEscalate={escalateFromBot} />
    </div>
  );
}
