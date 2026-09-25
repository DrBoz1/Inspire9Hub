import { timingSafeEqual } from "node:crypto";

/**
 * Who may run a scheduled job. Vercel Cron sends `Authorization: Bearer
 * $CRON_SECRET`; anything else is a stranger, including a request with no secret
 * configured at all — an unset CRON_SECRET must lock the job, not open it.
 *
 * Compared byte by byte in constant time, so a guess can't be narrowed down by
 * how long the answer took.
 */
export function cronAuthorised(header: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
