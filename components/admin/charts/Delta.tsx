import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Change } from "@/lib/admin-insights";

/**
 * Change against the previous period. Colour says whether the move is good,
 * which depends on the measure: more revenue is good, more cancellations are
 * not. It's never the only signal: the arrow gives the direction and the words
 * say better or worse for screen readers.
 */
export function Delta({ change, better, against }: { change: Change; better: "up" | "down"; against: string }) {
  if (!change) return <span className="admin-delta" data-tone="neutral">Nothing to compare with {against}</span>;
  const tone = change.direction === "flat" ? "neutral" : change.direction === better ? "good" : "bad";
  const Icon = change.direction === "up" ? ArrowUpRight : change.direction === "down" ? ArrowDownRight : Minus;
  return (
    <span className="admin-delta" data-tone={tone}>
      <Icon size={12} strokeWidth={2} aria-hidden />
      <strong>{change.label}</strong>
      {tone !== "neutral" && <span className="sr-only">{tone === "good" ? "(better)" : "(worse)"}</span>}
      <span>vs {against}</span>
    </span>
  );
}
