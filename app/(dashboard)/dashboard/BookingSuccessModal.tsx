"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { X, Download } from "lucide-react";
import { getBookingById } from "@/app/(dashboard)/bookings/actions";

type BookingInfo = {
  id: string;
  booking_status: string;
  start_date_time: string;
  end_date_time: string;
  workspaces: { name: string } | { name: string }[] | null;
  amount: number | null;
};

const PARTICLE_COLORS = ["#E31E24", "#0f172a", "#fbbf24", "#ffffff"];

function workspaceName(w: BookingInfo["workspaces"]): string {
  const room = Array.isArray(w) ? w[0] : w;
  return room?.name ?? "your room";
}

// Reads ?status=success&bookingId=... left behind by Stripe's redirect after
// a MANUAL (booking-modal) checkout — the chat-initiated flow has its own
// separate resume path inside AssistantWidget and never touches this. The
// query string is never trusted on its own: it only triggers a lookup
// (getBookingById) scoped server-side to the authenticated owner, which is
// what actually confirms anything happened.
export default function BookingSuccessModal() {
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [visible, setVisible] = useState(false);

  // Frozen once per mount — re-rolling on every render would make the
  // particles visibly jump mid-animation.
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const distance = 55 + Math.random() * 55;
        return {
          id: i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          rotate: Math.random() * 360,
          color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
          delay: Math.random() * 0.2,
          square: i % 3 !== 0,
        };
      }),
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") !== "success") return;
    const bookingId = params.get("bookingId");
    window.history.replaceState({}, "", window.location.pathname);
    if (!bookingId) return;

    const verify = (attempt: number) => {
      getBookingById(bookingId).then((data) => {
        if (data?.booking_status === "confirmed" || attempt >= 4) {
          setBooking(data as BookingInfo | null);
          setVisible(true);
          return;
        }
        setTimeout(() => verify(attempt + 1), 1500);
      });
    };
    setTimeout(() => verify(0), 600);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const confirmed = booking?.booking_status === "confirmed";

  // Rendered via a portal straight to <body>, same as every Dialog/AlertDialog
  // in this app (Radix does this internally for its own modals). Without it,
  // this sits deep inside the sidebar/main layout tree, where `fixed inset-0`
  // only spans the true viewport if nothing between here and <body> sets
  // transform/filter/contain on an ancestor — that's what was clipping the
  // backdrop to less than the full screen.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setVisible(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-[2rem] bg-white dark:bg-slate-900 p-8 text-center shadow-2xl"
          >
            <button
              onClick={() => setVisible(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon: a hand-drawn circle + checkmark, plus a one-shot
                particle burst timed to land right as the check completes. */}
            <div className="relative mx-auto mb-5 h-20 w-20">
              {confirmed &&
                particles.map((p) => (
                  <motion.span
                    key={p.id}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x: p.x, y: p.y + 26, opacity: 0, rotate: p.rotate }}
                    transition={{ duration: 0.9, delay: 0.7 + p.delay, ease: "easeOut" }}
                    className={`absolute left-1/2 top-1/2 h-2 w-2 ${p.square ? "rounded-sm" : "rounded-full"}`}
                    style={{ backgroundColor: p.color }}
                  />
                ))}
              <svg viewBox="0 0 80 80" className="relative h-20 w-20">
                <motion.circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="#E31E24"
                  strokeWidth="4"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                {confirmed && (
                  <motion.path
                    d="M24 42 L36 54 L58 28"
                    fill="none"
                    stroke="#E31E24"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.5, ease: "easeOut" }}
                  />
                )}
              </svg>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {confirmed ? "You're All Set!" : "Almost There…"}
              </h2>
              <p className="mt-1.5 text-sm font-medium text-slate-500">
                {confirmed
                  ? `${workspaceName(booking?.workspaces ?? null)} is booked and waiting for you.`
                  : `Your payment went through — we're just finishing up the booking. Check your history in a moment.`}
              </p>

              {booking && confirmed && (
                <div className="mt-6 space-y-2 rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 text-left">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400">From</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {format(parseISO(booking.start_date_time), "EEE d MMM, h:mm a")}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400">Until</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {format(parseISO(booking.end_date_time), "h:mm a")}
                    </span>
                  </div>
                  {booking.amount !== null && (
                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-xs font-bold">
                      <span className="text-slate-400">Total Paid</span>
                      <span className="text-slate-900 dark:text-white">
                        ${booking.amount.toFixed(2)} AUD
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex gap-2">
                {confirmed && booking && (
                  <a
                    href={`/api/invoice/${booking.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 py-3 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" /> Invoice
                  </a>
                )}
                <button
                  onClick={() => setVisible(false)}
                  className="flex-1 rounded-xl bg-[#E31E24] py-3 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:bg-red-700 active:scale-95"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
