import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every signed-in page must be on the proxy's list. A page missing from it still
 * redirects signed-out visitors (its layout does), but only after rendering, and
 * /spaces queried Supabase for every anonymous request that way: a load test
 * served ~120 requests a second there against ~1,200 on a listed page.
 */
const ROOT = import.meta.dirname;
const matcher = [...readFileSync(join(ROOT, "proxy.ts"), "utf8").matchAll(/"\/([a-z-]+)\/:path\*"/g)].map((m) => m[1]);
const pagesIn = (group: string) =>
  readdirSync(join(ROOT, "app", group)).filter((d) => {
    const dir = join(ROOT, "app", group, d);
    return statSync(dir).isDirectory() && readdirSync(dir).includes("page.tsx");
  });

describe("the proxy guards every signed-in page", () => {
  it("covers each member page", () => {
    expect(pagesIn("(dashboard)").filter((page) => !matcher.includes(page))).toEqual([]);
  });

  it("covers the admin area", () => {
    expect(matcher).toContain("admin");
  });
});
