"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export function AuthAlert({ type, message }: { type: "error" | "success"; message: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const Icon = type === "error" ? AlertCircle : CheckCircle2;
  return (
    <motion.div
      className="auth-alert"
      data-type={type}
      role={type === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <Icon size={16} strokeWidth={1.8} aria-hidden />
      <span>{message}</span>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss">
        <X size={14} aria-hidden />
      </button>
    </motion.div>
  );
}
