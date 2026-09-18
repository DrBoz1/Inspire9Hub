import { describe, expect, it } from "vitest";
import { MIN_FILL_MS, WindowLimiter, clientKey, looksAutomated } from "./enquiry-guard";

describe("rate limiting", () => {
  it("allows up to the limit in a window, then says how long to wait", () => {
    const limit = new WindowLimiter(3, 60_000);
    expect([0, 1000, 2000].map((t) => limit.take("ip", t).ok)).toEqual([true, true, true]);
    expect(limit.take("ip", 10_000)).toEqual({ ok: false, retryAfterMs: 50_000 });
  });

  it("lets attempts back in as the oldest ones age out", () => {
    const limit = new WindowLimiter(2, 60_000);
    limit.take("ip", 0);
    limit.take("ip", 30_000);
    expect(limit.take("ip", 59_999).ok).toBe(false);
    expect(limit.take("ip", 60_000).ok).toBe(true);
  });

  it("keeps separate counts per visitor", () => {
    const limit = new WindowLimiter(1, 60_000);
    expect(limit.take("a", 0).ok).toBe(true);
    expect(limit.take("b", 0).ok).toBe(true);
    expect(limit.take("a", 1).ok).toBe(false);
  });

  it("can't be grown without bound by a flood of different addresses", () => {
    const limit = new WindowLimiter(5, 60_000, 100);
    for (let i = 0; i < 1000; i++) limit.take(`ip-${i}`, i);
    expect(limit.size).toBeLessThanOrEqual(100);
    // The most recent visitors are the ones kept.
    expect(limit.take("ip-999", 1000).ok).toBe(true);
  });
});

describe("spotting a bot", () => {
  const now = 1_000_000;

  it("catches a filled-in honeypot", () => {
    expect(looksAutomated({ honeypot: "https://spam.example" }, now)).toBe(true);
    expect(looksAutomated({ honeypot: "   " }, now)).toBe(false);
  });

  it("catches a form sent faster than a person could fill it", () => {
    expect(looksAutomated({ startedAt: String(now - 500) }, now)).toBe(true);
    expect(looksAutomated({ startedAt: String(now - MIN_FILL_MS) }, now)).toBe(false);
  });

  it("doesn't punish a visitor without JavaScript, or a clock that's off", () => {
    expect(looksAutomated({}, now)).toBe(false);
    expect(looksAutomated({ startedAt: "" }, now)).toBe(false);
    expect(looksAutomated({ startedAt: String(now + 60_000) }, now)).toBe(false);
    expect(looksAutomated({ startedAt: "yesterday" }, now)).toBe(false);
  });
});

describe("identifying the visitor", () => {
  it("uses the first forwarded address, then the real IP, then a shared bucket", () => {
    expect(clientKey("203.0.113.9, 10.0.0.1", null)).toBe("203.0.113.9");
    expect(clientKey(null, " 198.51.100.4 ")).toBe("198.51.100.4");
    expect(clientKey("", null)).toBe("unknown");
  });
});
