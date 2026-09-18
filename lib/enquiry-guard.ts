/**
 * Defences for the public enquiry form, the one page a stranger can write to.
 * Pure: time is always passed in, so every rule here is pinned by a test.
 */

/**
 * A sliding-window limiter held in memory.
 *
 * Honest about its limits: each server instance keeps its own count, so on a
 * platform that runs several instances a determined sender gets a few times the
 * limit, and a restart forgets everything. It raises the cost of spam and stops
 * the accidental double-submit; it isn't a wall. A shared store (Redis, or a
 * table) is the upgrade when that matters.
 */
export class WindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    /** Caps memory: a flood of distinct keys can't grow the map without bound. */
    private readonly maxKeys = 5000,
  ) {}

  /** Records an attempt if it's allowed. `retryAfterMs` says how long until the oldest attempt ages out. */
  take(key: string, now: number): { ok: true } | { ok: false; retryAfterMs: number } {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterMs: this.windowMs - (now - recent[0]) };
    }
    recent.push(now);
    // Re-inserting moves the key to the end, so the map stays ordered oldest-used first.
    this.hits.delete(key);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.prune(now);
    return { ok: true };
  }

  get size() {
    return this.hits.size;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
    // Still over after dropping the expired: shed the least recently used.
    for (const key of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(key);
    }
  }
}

/** No person fills in name, email and a message this fast; a script does. */
export const MIN_FILL_MS = 2000;

/**
 * Two cheap tells of a bot. The honeypot is a field hidden from people that
 * form-filling scripts complete anyway. The timer catches instant submissions.
 * A missing or implausible start time is ignored rather than punished: it's
 * what a visitor with JavaScript switched off sends, and they're welcome.
 */
export function looksAutomated(fields: { honeypot?: unknown; startedAt?: unknown }, now: number): boolean {
  if (typeof fields.honeypot === "string" && fields.honeypot.trim() !== "") return true;
  const started = Number(typeof fields.startedAt === "string" ? fields.startedAt : NaN);
  if (!Number.isFinite(started) || started > now || now - started > 86_400_000) return false;
  return now - started < MIN_FILL_MS;
}

/**
 * The visitor's address, for rate limiting only; never stored. On Vercel the
 * first x-forwarded-for entry is set by the platform and can't be forged by the
 * client. Elsewhere it can be, which only lets someone rate-limit themselves
 * under a different name.
 */
export function clientKey(forwardedFor: string | null, realIp: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || realIp?.trim() || "unknown";
}
