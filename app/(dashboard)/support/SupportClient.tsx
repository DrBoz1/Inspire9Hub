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
  Sparkles,
  CalendarX,
  CreditCard,
  ShieldCheck,
  KeyRound,
  MessageCircleQuestion,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendSupportRequest } from "./actions";

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

const heroWords = ["How", "can", "we", "help?"];

export default function SupportClient({ firstName }: { firstName: string }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

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
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 px-8 py-14 md:px-14 md:py-16"
      >
        <motion.div
          aria-hidden
          animate={{ x: [0, 60, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.95, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#E31E24]/25 blur-[100px]"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -50, 30, 0], y: [0, 40, -25, 0], scale: [1, 0.9, 1.1, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-[110px]"
        />
        <motion.div
          aria-hidden
          animate={{ opacity: [0.04, 0.09, 0.04] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative z-10 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
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

          <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-white md:text-6xl">
            {heroWords.map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.25 + i * 0.09, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={`mr-3 inline-block ${i === heroWords.length - 1 ? "text-[#E31E24]" : ""}`}
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-5 max-w-lg text-base font-medium leading-relaxed text-slate-400"
          >
            Hey {firstName} — whether it&apos;s a booking hiccup, a refund
            question or just saying hi, you&apos;re in the right place.
          </motion.p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[
          {
            icon: Mail,
            title: "Email Us",
            line1: "hello@inspire9.com",
            line2: "Replies within one business day",
            accent: "bg-red-50 text-[#E31E24]",
          },
          {
            icon: MapPin,
            title: "Visit the Hub",
            line1: "41 Stewart St, Richmond",
            line2: "Melbourne VIC 3121",
            accent: "bg-indigo-50 text-indigo-600",
          },
          {
            icon: Clock,
            title: "Staffed Hours",
            line1: "Mon – Fri · 9am – 5pm",
            line2: "Bookings run 8am – 8pm daily",
            accent: "bg-emerald-50 text-emerald-600",
          },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 18 } }}
            className="group rounded-3xl border border-slate-100 bg-white p-7 shadow-sm transition-shadow hover:shadow-xl hover:shadow-slate-200/60"
          >
            <motion.div
              whileHover={{ rotate: [0, -12, 10, 0] }}
              transition={{ duration: 0.5 }}
              className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}
            >
              <card.icon className="h-5 w-5" />
            </motion.div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {card.title}
            </p>
            <p className="mt-2 text-base font-black text-slate-900">{card.line1}</p>
            <p className="mt-0.5 text-sm font-medium text-slate-400">{card.line2}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="lg:col-span-3"
        >
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#E31E24]" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Quick Answers
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <motion.div
                  key={faq.q}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.75 + i * 0.07 }}
                  className={`overflow-hidden rounded-2xl border bg-white transition-colors ${
                    open ? "border-red-100 shadow-md shadow-red-50" : "border-slate-100 shadow-sm"
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span
                      className={`text-sm font-bold transition-colors ${
                        open ? "text-[#E31E24]" : "text-slate-800"
                      }`}
                    >
                      {faq.q}
                    </span>
                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className={`shrink-0 rounded-full p-1.5 ${
                        open ? "bg-red-50 text-[#E31E24]" : "bg-slate-50 text-slate-400"
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
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="px-6 pb-6 text-sm font-medium leading-relaxed text-slate-500">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="lg:col-span-2"
        >
          <div className="sticky top-6 overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="flex flex-col items-center px-8 py-20 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 15 }}
                    className="relative mb-6"
                  >
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-100 opacity-60" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    </div>
                  </motion.div>
                  <h3 className="text-xl font-black text-slate-900">Message sent!</h3>
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
                    className="mt-8 text-[11px] font-black uppercase tracking-widest text-[#E31E24] underline-offset-4 hover:underline"
                  >
                    Send another →
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="p-8"
                >
                  <h3 className="text-xl font-black tracking-tight text-slate-900">
                    Talk to the team
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-400">
                    Pick a topic and tell us what&apos;s up.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {TOPICS.map((t) => {
                      const selected = topic === t.label;
                      return (
                        <motion.button
                          key={t.label}
                          type="button"
                          whileTap={{ scale: 0.94 }}
                          onClick={() => setTopic(t.label)}
                          className={`relative flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                            selected
                              ? "text-white"
                              : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {selected && (
                            <motion.span
                              layoutId="topic-pill"
                              transition={{ type: "spring", stiffness: 350, damping: 28 }}
                              className="absolute inset-0 rounded-full bg-slate-900"
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
                      className="resize-none rounded-2xl border-slate-100 bg-slate-50/50 text-sm leading-relaxed focus-visible:ring-slate-300"
                    />
                    <div className="mt-1.5 flex justify-end">
                      <span
                        className={`text-[10px] font-bold tabular-nums ${
                          message.length > 1800 ? "text-[#E31E24]" : "text-slate-300"
                        }`}
                      >
                        {message.length}/2000
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={pending || message.trim().length < 10}
                    onClick={handleSubmit}
                    className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#E31E24] text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-red-100 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Send Message <Send className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>

                  <p className="mt-4 text-center text-[11px] font-medium text-slate-300">
                    Sent securely from your member account — no spam, ever.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
