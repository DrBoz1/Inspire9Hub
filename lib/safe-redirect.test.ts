import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("where an email link can send someone", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/bookings?status=ok#top")).toBe("/bookings?status=ok#top");
  });

  it("refuses anything that leaves the site", () => {
    for (const evil of ["@evil.test", ".evil.test/phish", "//evil.test", "/\\evil.test", "https://evil.test", "javascript:alert(1)", "/\tevil", "evil.test"]) {
      expect(safeNextPath(evil)).toBe("/dashboard");
    }
  });

  it("falls back when there's nothing to go on", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined, "/login")).toBe("/login");
    expect(safeNextPath("")).toBe("/dashboard");
  });
});
