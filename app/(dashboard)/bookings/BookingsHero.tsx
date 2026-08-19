"use client";

import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, DoorOpen } from "lucide-react";

export default function BookingsHero({ roomCount }: { roomCount: number }) {
  const statVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.95 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring" as const, stiffness: 280, damping: 22, delay: 0.3 + i * 0.1 },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[40px] bg-slate-950 px-8 py-10 md:px-12 md:py-12 text-white shadow-2xl shadow-slate-900/30"
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-linear-to-r from-transparent via-[#E31E24]/80 to-transparent" />

      {/* Animated red orb */}
      <motion.div
        animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.08, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#E31E24] blur-3xl pointer-events-none"
      />

      {/* Secondary orb */}
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        {/* Left: headline */}
        <div className="space-y-3 max-w-xl">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/70"
          >
            <Sparkles className="w-3 h-3 text-[#E31E24]" /> Live Hub Availability
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}
            className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-[0.95]"
          >
            Reserve{" "}
            <span
              style={{
                background:
                  "linear-gradient(90deg, #E31E24 0%, #ff6b6b 40%, #E31E24 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "shimmer-wave 3s linear infinite",
              }}
            >
              Space
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-slate-400 font-medium max-w-md"
          >
            Book meeting rooms and workspaces across the Inspire9 Hub —
            real-time availability for members only.
          </motion.p>
        </div>

        {/* Right: stat cards */}
        <div className="flex gap-3 shrink-0">
          <motion.div
            custom={0}
            variants={statVariants}
            initial="hidden"
            animate="show"
            className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 backdrop-blur-sm"
          >
            <p className="text-2xl font-black flex items-center gap-1.5">
              <DoorOpen className="w-4 h-4 text-[#E31E24]" /> {roomCount}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
              Rooms Open
            </p>
          </motion.div>

          <motion.div
            custom={1}
            variants={statVariants}
            initial="hidden"
            animate="show"
            className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 backdrop-blur-sm"
          >
            <p className="text-2xl font-black flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
              Instant Confirm
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
