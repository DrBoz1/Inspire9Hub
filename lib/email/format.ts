import { HUB_TIMEZONE } from "@/lib/datetime";

/**
 * Dates and times for emails and invoices, always in Melbourne time.
 *
 * toLocaleDateString without a timeZone uses the server's clock. That was
 * Melbourne on a laptop and UTC on Vercel, so the live site emailed a 9:00 am
 * booking as 11:00 pm the night before, under the words "Melbourne time".
 */
const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { timeZone: HUB_TIMEZONE, ...options });

const LONG_DAY = format({ weekday: "long", year: "numeric", month: "long", day: "numeric" });
const SHORT_DAY = format({ weekday: "short", year: "numeric", month: "short", day: "numeric" });
const TIME = format({ hour: "numeric", minute: "2-digit", hour12: true });
const ISSUE_DATE = format({ year: "numeric", month: "long", day: "numeric" });
// en-CA writes dates as YYYY-MM-DD, which is the shape a DATE column wants.
const DATE_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: HUB_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

type When = Date | string | number;
const at = (when: When) => (when instanceof Date ? when : new Date(when));

/** "Monday 21 September 2026" */
export const hubLongDay = (when: When) => LONG_DAY.format(at(when));
/** "Mon, 21 Sep 2026" */
export const hubShortDay = (when: When) => SHORT_DAY.format(at(when));
/** "9:00 am" */
export const hubTime = (when: When) => TIME.format(at(when));
/** "21 September 2026" */
export const hubIssueDate = (when: When) => ISSUE_DATE.format(at(when));
/** "2026-09-21", the Melbourne calendar day, for DATE columns. */
export const hubDateKey = (when: When) => DATE_KEY.format(at(when));

/** "$128.00" */
export const aud = (amount: number) => `$${amount.toFixed(2)}`;
