"use client";

import { motion } from "framer-motion";

/**
 * Wraps the left-side form inner content so it slides in smoothly on mount.
 * Import this in each auth page and wrap the inner content div (mx-auto max-w-sm).
 * The outer panel background and the right image panel stay completely static.
 */
export function AuthFormMotion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
