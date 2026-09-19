import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The member hub is Inspire9: red and warm neutrals. An earlier pass drifted into
 * olive, sage and cream, which read as a different brand. This fails if that comes
 * back. Green is still allowed where it means something: success states, and the
 * floor plan's own availability, zone and drawing colours.
 */
const ROOT = join(import.meta.dirname, "..", "..");
const FILES = [
  "app/(dashboard)/member-hub.css",
  "app/(dashboard)/member-pages.css",
  "app/(dashboard)/member-account.css",
  "app/(auth)/auth.css",
  "app/(public)/enquire.css",
  "app/(admin)/admin.css",
  "features/booking-map/floorplan.css",
  // Emails and the PDF invoice are the hub too: they had drifted to olive and cream.
  "lib/email/components/email-layout.tsx",
  "lib/email/pdf/booking-invoice.tsx",
];
// #276b45 is the success green darkened so 9px badge text stays readable on its tint.
const SEMANTIC_GREENS = new Set(["#2f7d52", "#276b45", "#6fcf97"]);
const MEANINGFUL_TOKEN = /--color-(status-available|cat-|zone-|plan-)/;

/** Green at least as strong as red, and clearly above blue: sage, olive, green. */
function isGreenish(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return g >= r && g - b > 0.02;
}

describe("member palette", () => {
  it("has no olive or sage outside meaningful colours", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      readFileSync(join(ROOT, file), "utf8").split(/\r?\n/).forEach((line, i) => {
        if (MEANINGFUL_TOKEN.test(line)) return;
        for (const m of line.matchAll(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g)) {
          const hex = m[0].slice(0, 7).toLowerCase();
          if (isGreenish(hex) && !SEMANTIC_GREENS.has(hex)) offenders.push(`${file}:${i + 1} ${m[0]}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("uses the Inspire9 red for the accent", () => {
    const hub = readFileSync(join(ROOT, "app/(dashboard)/member-hub.css"), "utf8");
    expect(hub).toMatch(/--hub-red:\s*#e31e24/i);
  });
});
