"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export function AuthAlert({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isError = type === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium ${
        isError
          ? "bg-red-50 border-red-100 text-red-700"
          : "bg-emerald-50 border-emerald-100 text-emerald-700"
      }`}
    >
      {isError ? (
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      )}
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 opacity-40 hover:opacity-80 transition-opacity rounded"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </motion.div>
  );
}
