"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Sparkles, X, SendHorizonal, ArrowRight, MessageSquareText } from "lucide-react";
import {
  matchIntent,
  SUGGESTIONS,
  type AssistantContext,
  type BotReply,
  type MatchResult,
} from "@/lib/assistant/engine";
import { getAssistantContext } from "./actions";

type ChatMessage = {
  id: number;
  role: "user" | "bot";
  text: string;
  action?: BotReply["action"];
  escalate?: boolean;
  suggestions?: string[];
};

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
  const lastQuestion = useRef("");
  const lastIntent = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const booted = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  useEffect(() => {
    if (!open || booted.current) return;
    booted.current = true;
    setTyping(true);
    getAssistantContext().then((data) => {
      setCtx(data);
      setTimeout(() => {
        setTyping(false);
        setMessages([
          {
            id: nextId++,
            role: "bot",
            text: data
              ? `Hey ${data.firstName} 👋 I'm the Hub Assistant — connected live to your account. I understand natural questions (typos included), so ask away about your spending, bookings, refunds or induction. I can even break spending down by month.`
              : `Hey! I'm the Hub Assistant. Ask me anything about bookings, refunds, induction or the Hub itself.`,
            suggestions: data ? ["Show me my account snapshot"] : undefined,
          },
        ]);
      }, 900);
    });
  }, [open]);

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question || typing) return;
    lastQuestion.current = question;
    setInput("");
    setUsedSuggestions((u) => [...u, question]);
    setMessages((m) => [...m, { id: nextId++, role: "user", text: question }]);
    setTyping(true);

    const result: MatchResult = ctx
      ? matchIntent(question, ctx, lastIntent.current)
      : {
          reply: { text: "Give me one second, I'm still pulling up your account…" },
          intentId: null,
        };

    if (result.intentId) lastIntent.current = result.intentId;

    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          id: nextId++,
          role: "bot",
          text: result.reply.text,
          action: result.reply.action,
          escalate: result.reply.escalate,
          suggestions: result.reply.suggestions,
        },
      ]);
    }, 650 + Math.random() * 500);
  };

  const remaining = SUGGESTIONS.filter((s) => !usedSuggestions.includes(s)).slice(0, 3);

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
            className="fixed bottom-24 right-6 z-50 flex h-[34rem] w-[calc(100vw-3rem)] max-w-[25rem] flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/20 dark:shadow-black/50"
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
                    className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "items-end" : ""}`}
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
              <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
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
