import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aud, hubDateKey, hubIssueDate, hubLongDay, hubShortDay, hubTime } from "./format";

// 9:00 am on Monday 21 September 2026 in Melbourne (AEST, UTC+10) is 11:00 pm
// on Sunday the 20th in UTC: the date and time a UTC server got wrong.
const NINE_AM_MONDAY = "2026-09-20T23:00:00Z";

describe("email dates on a UTC server, like Vercel", () => {
  let before: string | undefined;
  beforeEach(() => {
    before = process.env.TZ;
    process.env.TZ = "UTC";
  });
  afterEach(() => {
    process.env.TZ = before;
  });

  it("still says the Melbourne day and time", () => {
    // Proof the clock really is UTC here: the plain call gets it wrong.
    expect(new Date(NINE_AM_MONDAY).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })).toBe("11:00 pm");
    expect(hubLongDay(NINE_AM_MONDAY)).toBe("Monday 21 September 2026");
    expect(hubShortDay(NINE_AM_MONDAY)).toBe("Mon, 21 Sept 2026");
    expect(hubTime(NINE_AM_MONDAY)).toBe("9:00 am");
    expect(hubIssueDate(NINE_AM_MONDAY)).toBe("21 September 2026");
    expect(hubDateKey(NINE_AM_MONDAY)).toBe("2026-09-21");
  });

  it("follows daylight saving: 9 am is 10 pm UTC once the clocks go forward", () => {
    // AEDT (UTC+11) from 4 October 2026.
    expect(hubTime("2026-10-11T22:00:00Z")).toBe("9:00 am");
    expect(hubDateKey("2026-10-11T22:00:00Z")).toBe("2026-10-12");
  });
});

describe("money", () => {
  it("writes dollars with cents", () => {
    expect(aud(128)).toBe("$128.00");
    expect(aud(62.5)).toBe("$62.50");
  });
});
