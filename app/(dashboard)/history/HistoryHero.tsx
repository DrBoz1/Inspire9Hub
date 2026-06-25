"use client";

import { motion } from "framer-motion";
import { Activity, TrendingUp } from "lucide-react";

// Same dark-hero visual language as the Reserve Space page (BookingsHero) —
// kept consistent across the app rather than inventing a new look per page.
export default function HistoryHero({
  totalBookings,
  netSpend,
}: {
  totalBookings: number;
  netSpend: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[40px] bg-slate-950 px-8 py-10 md:px-12 md:py-12 text-white shadow-2xl shadow-slate-900/30"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-[#E31E24]/70 to-transparent" />
      <motion.div
        animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.08, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#E31E24] blur-3xl pointer-events-none"
      />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/70">
            <Activity className="w-3 h-3 text-[#E31E24]" /> Full Account Record
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-[0.95]">
            My <span className="text-[#E31E24]">History</span>
          </h1>
          <p className="text-slate-400 font-medium max-w-md">
            Every booking, payment, and access pass tied to your account —
            all in one place.
          </p>
        </div>

        <div className="flex gap-3 shrink-0">
          <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 backdrop-blur-sm">
            <p className="text-2xl font-black">{totalBookings}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
              Bookings Made
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 backdrop-blur-sm">
            <p className="text-2xl font-black flex items-center gap-1.5 text-emerald-400">
              <TrendingUp className="w-4 h-4" /> ${netSpend.toFixed(0)}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
              Net Spend
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
