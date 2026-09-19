import { describe, expect, it } from "vitest";
import { checkBookingWindow, checkLookupWindow, HORIZON_DAYS, isUuidLike } from "./booking-rules";

// Friday 25 September 2026, 8:00 am Melbourne (AEST, UTC+10).
const NOW = new Date("2026-09-24T22:00:00Z");
// Wall-clock Melbourne times on a given day, as UTC ISO strings (AEST until 4 October).
const aest = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+10:00`).toISOString();
const aedt = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+11:00`).toISOString();
const check = (start: unknown, end: unknown) => checkBookingWindow(start, end, NOW);
const errorOf = (start: unknown, end: unknown) => {
  const r = check(start, end);
  return r.ok ? null : r.error;
};

describe("what the server lets anyone book", () => {
  it("accepts an ordinary booking and says what it is", () => {
    const r = check(aest("2026-09-25", "10:00"), aest("2026-09-25", "12:00"));
    expect(r).toEqual({ ok: true, value: { startISO: aest("2026-09-25", "10:00"), endISO: aest("2026-09-25", "12:00"), date: "2026-09-25", from: 600, to: 720, hours: 2 } });
  });

  it("turns away nonsense instead of passing it on", () => {
    expect(errorOf("garbage", "also garbage")).toMatch(/don’t look right/);
    expect(errorOf(undefined, aest("2026-09-25", "12:00"))).toMatch(/Pick a start/);
    expect(errorOf(123, 456)).toMatch(/Pick a start/);
  });

  it("keeps the old rules: forwards, at least an hour, not in the past", () => {
    expect(errorOf(aest("2026-09-25", "12:00"), aest("2026-09-25", "10:00"))).toMatch(/before end/);
    expect(errorOf(aest("2026-09-25", "10:00"), aest("2026-09-25", "10:45"))).toMatch(/Minimum/);
    expect(errorOf(aest("2026-09-24", "10:00"), aest("2026-09-24", "12:00"))).toMatch(/passed/);
  });

  it("only allows opening hours: 7am to 9pm on weekdays, 9 to 5 on Saturday, closed Sunday", () => {
    // Monday 28 September.
    expect(errorOf(aest("2026-09-28", "06:00"), aest("2026-09-28", "08:00"))).toMatch(/opening hours \(7am to 9pm\)/);
    expect(errorOf(aest("2026-09-28", "20:00"), aest("2026-09-28", "22:00"))).toMatch(/opening hours/);
    expect(check(aest("2026-09-28", "07:00"), aest("2026-09-28", "21:00")).ok).toBe(true);
    expect(errorOf(aest("2026-09-26", "08:00"), aest("2026-09-26", "10:00"))).toMatch(/9am to 5pm/);
    expect(check(aest("2026-09-26", "09:00"), aest("2026-09-26", "17:00")).ok).toBe(true);
    expect(errorOf(aest("2026-09-27", "10:00"), aest("2026-09-27", "12:00"))).toMatch(/closed that day/);
  });

  it("stops one booking from running for days, which is how a room got held for weeks", () => {
    expect(errorOf(aest("2026-09-25", "10:00"), aest("2026-10-01", "10:00"))).toMatch(/same day/);
    expect(errorOf(aest("2026-09-25", "20:00"), aest("2026-09-26", "10:00"))).toMatch(/same day/);
  });

  it("stops bookings more than 180 days out", () => {
    // 180 days from 25 September is Tuesday 24 March 2027 (AEDT).
    expect(check(aedt("2027-03-24", "10:00"), aedt("2027-03-24", "11:00")).ok).toBe(true);
    expect(errorOf(aedt("2027-03-25", "10:00"), aedt("2027-03-25", "11:00"))).toMatch(new RegExp(`${HORIZON_DAYS} days`));
  });

  it("keeps to the 15-minute slots", () => {
    expect(errorOf(aest("2026-09-25", "10:07"), aest("2026-09-25", "11:07"))).toMatch(/15-minute/);
    expect(errorOf(new Date(Date.parse(aest("2026-09-25", "10:00")) + 30_000).toISOString(), aest("2026-09-25", "11:30"))).toMatch(/15-minute/);
    expect(check(aest("2026-09-25", "10:15"), aest("2026-09-25", "11:45")).ok).toBe(true);
  });

  it("reads opening hours in Melbourne time across daylight saving", () => {
    // Monday 5 October 2026 is AEDT: 7am there is 8pm UTC the day before.
    expect(check(aedt("2026-10-05", "07:00"), aedt("2026-10-05", "08:00")).ok).toBe(true);
    expect(errorOf(aedt("2026-10-05", "06:00"), aedt("2026-10-05", "07:00"))).toMatch(/opening hours/);
  });
});

describe("looking up busy times", () => {
  it("allows a day, even a 25-hour daylight-saving day, and nothing wider", () => {
    expect(checkLookupWindow(aest("2026-09-25", "00:00"), aest("2026-09-26", "00:00")).ok).toBe(true);
    expect(checkLookupWindow("2026-04-04T13:00:00Z", "2026-04-05T14:00:00Z").ok).toBe(true);
    expect(checkLookupWindow(aest("2026-09-25", "00:00"), aest("2027-09-25", "00:00")).ok).toBe(false);
    expect(checkLookupWindow("x", "y").ok).toBe(false);
  });

  it("knows a room id from anything else", () => {
    expect(isUuidLike("3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e")).toBe(true);
    expect(isUuidLike("1 or 1=1")).toBe(false);
    expect(isUuidLike(undefined)).toBe(false);
  });
});
