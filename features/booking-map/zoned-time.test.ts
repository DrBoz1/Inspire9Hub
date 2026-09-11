import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  dayBoundsUtc,
  isDateKey,
  minutesNowIn,
  offsetMinutes,
  parseDateKey,
  todayIn,
  wallClockAt,
  wallClockToUtc,
  weekdayOfKey,
} from './zoned-time';

const MEL = 'Australia/Melbourne';
const iso = (ms: number) => new Date(ms).toISOString();
const at = (s: string) => Date.parse(s);
const HOUR = 3_600_000;

/**
 * Melbourne in 2026, the facts these tests lean on:
 *   AEST = UTC+10, AEDT = UTC+11.
 *   Daylight saving ENDS   Sun 5 Apr 2026 at 03:00 AEDT -> clocks read 02:00 again.
 *   Daylight saving STARTS Sun 4 Oct 2026 at 02:00 AEST -> clocks jump to 03:00.
 */

describe('the process timezone does not leak in', () => {
  it('is running under the zone the test runner set, whatever it is', () => {
    // Informational: CI runs this file under several TZ values (npm run test:tz).
    // Every other assertion here must hold under all of them.
    expect(typeof process.env.TZ === 'string' || process.env.TZ === undefined).toBe(true);
  });
});

describe('ordinary days', () => {
  it('converts winter wall clock (AEST, +10)', () => {
    expect(iso(wallClockToUtc('2026-08-26', 10 * 60, MEL))).toBe('2026-08-26T00:00:00.000Z');
  });

  it('converts summer wall clock (AEDT, +11)', () => {
    expect(iso(wallClockToUtc('2026-12-01', 10 * 60, MEL))).toBe('2026-11-30T23:00:00.000Z');
  });

  it('puts local midnight on the previous UTC day', () => {
    expect(iso(wallClockToUtc('2026-08-26', 0, MEL))).toBe('2026-08-25T14:00:00.000Z');
  });

  it('reads the wall clock back from an instant', () => {
    expect(wallClockAt(at('2026-08-26T00:00:00Z'), MEL)).toEqual({ date: '2026-08-26', mins: 600 });
    expect(wallClockAt(at('2026-11-30T23:00:00Z'), MEL)).toEqual({ date: '2026-12-01', mins: 600 });
  });

  it('reports the offset in minutes', () => {
    expect(offsetMinutes(at('2026-08-26T00:00:00Z'), MEL)).toBe(600);
    expect(offsetMinutes(at('2026-12-01T00:00:00Z'), MEL)).toBe(660);
  });

  it('accepts 1440 as the midnight that ends a day', () => {
    expect(wallClockToUtc('2026-08-26', 1440, MEL)).toBe(wallClockToUtc('2026-08-27', 0, MEL));
  });
});

describe('daylight saving starts: 02:00 -> 03:00 on Sun 4 Oct 2026', () => {
  const D = '2026-10-04';

  it('converts the minute before the jump at +10', () => {
    expect(iso(wallClockToUtc(D, 1 * 60 + 59, MEL))).toBe('2026-10-03T15:59:00.000Z');
  });

  it('converts 03:00, the first minute after the jump, at +11', () => {
    expect(iso(wallClockToUtc(D, 3 * 60, MEL))).toBe('2026-10-03T16:00:00.000Z');
  });

  it('resolves the skipped 02:30 forward to 03:30', () => {
    const t = wallClockToUtc(D, 2 * 60 + 30, MEL);
    expect(iso(t)).toBe('2026-10-03T16:30:00.000Z');
    expect(wallClockAt(t, MEL)).toEqual({ date: D, mins: 3 * 60 + 30 });
  });

  it('is a 23-hour day', () => {
    const { start, end } = dayBoundsUtc(D, MEL);
    expect((end - start) / HOUR).toBe(23);
  });
});

describe('daylight saving ends: 03:00 -> 02:00 on Sun 5 Apr 2026', () => {
  const D = '2026-04-05';

  it('resolves the repeated 02:30 to its first occurrence (still AEDT)', () => {
    expect(iso(wallClockToUtc(D, 2 * 60 + 30, MEL))).toBe('2026-04-04T15:30:00.000Z');
  });

  it('maps both real instants of 02:30 to the same wall clock', () => {
    expect(wallClockAt(at('2026-04-04T15:30:00Z'), MEL)).toEqual({ date: D, mins: 150 });
    expect(wallClockAt(at('2026-04-04T16:30:00Z'), MEL)).toEqual({ date: D, mins: 150 });
  });

  it('converts 03:00, which only happens once, at +10', () => {
    expect(iso(wallClockToUtc(D, 3 * 60, MEL))).toBe('2026-04-04T17:00:00.000Z');
  });

  it('is a 25-hour day', () => {
    const { start, end } = dayBoundsUtc(D, MEL);
    expect((end - start) / HOUR).toBe(25);
  });
});

describe('round trips across all of 2026', () => {
  it('wall clock -> UTC -> wall clock is exact for every 15-minute slot, except the 4 skipped ones', () => {
    const skipped: string[] = [];
    let day = '2026-01-01';
    while (day <= '2026-12-31') {
      for (let m = 0; m < 1440; m += 15) {
        const back = wallClockAt(wallClockToUtc(day, m, MEL), MEL);
        if (back.date !== day || back.mins !== m) skipped.push(`${day} ${m}`);
      }
      day = addDaysToKey(day, 1);
    }
    expect(skipped).toEqual(['2026-10-04 120', '2026-10-04 135', '2026-10-04 150', '2026-10-04 165']);
  });

  it('UTC -> wall clock -> UTC is exact for every 15-minute instant, except the repeated hour', () => {
    const repeated: string[] = [];
    for (let t = at('2026-01-01T00:00:00Z'); t < at('2027-01-01T00:00:00Z'); t += 15 * 60_000) {
      const w = wallClockAt(t, MEL);
      if (wallClockToUtc(w.date, w.mins, MEL) !== t) repeated.push(iso(t));
    }
    // The second pass through 02:00-02:59 on 5 Apr maps back to the first.
    expect(repeated).toEqual([
      '2026-04-04T16:00:00.000Z', '2026-04-04T16:15:00.000Z',
      '2026-04-04T16:30:00.000Z', '2026-04-04T16:45:00.000Z',
    ]);
  });

  it('gives every day of the year bounds that tile with no gap or overlap', () => {
    let day = '2026-01-01';
    let prevEnd: number | null = null;
    let hours23 = 0, hours25 = 0;
    while (day <= '2026-12-31') {
      const { start, end } = dayBoundsUtc(day, MEL);
      if (prevEnd !== null) expect(start, day).toBe(prevEnd);
      const h = (end - start) / HOUR;
      if (h === 23) hours23++;
      else if (h === 25) hours25++;
      else expect(h, day).toBe(24);
      prevEnd = end;
      day = addDaysToKey(day, 1);
    }
    expect([hours23, hours25]).toEqual([1, 1]);
  });
});

describe('"today" and "now" belong to the hub, not the machine', () => {
  it('is already tomorrow in Melbourne while UTC is still on today', () => {
    // 15:30 UTC on the 26th is 01:30 on the 27th in Melbourne. A server in UTC, or
    // a laptop in London, reading its own clock would book on the wrong day.
    const now = at('2026-08-26T15:30:00Z');
    expect(todayIn(MEL, now)).toBe('2026-08-27');
    expect(minutesNowIn(MEL, now)).toBe(90);
  });

  it('agrees with UTC when the zone is UTC', () => {
    const now = at('2026-08-26T15:30:00Z');
    expect(todayIn('UTC', now)).toBe('2026-08-26');
    expect(minutesNowIn('UTC', now)).toBe(15 * 60 + 30);
  });
});

describe('date keys', () => {
  it('rejects dates that do not exist instead of rolling them over', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '2025-02-29', '26-08-01', '2026-8-1', '', 'today']) {
      expect(isDateKey(bad), bad).toBe(false);
      expect(() => parseDateKey(bad), bad).toThrow(RangeError);
    }
    expect(isDateKey('2028-02-29')).toBe(true); // leap year
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDaysToKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2026-10-03', 1)).toBe('2026-10-04');
    expect(addDaysToKey('2026-10-04', 1)).toBe('2026-10-05');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('knows the weekday without consulting a zone', () => {
    expect(weekdayOfKey('2026-10-04')).toBe(0); // Sunday
    expect(weekdayOfKey('2026-08-26')).toBe(3); // Wednesday
  });
});

describe('bad input', () => {
  it('refuses minutes outside a day', () => {
    for (const m of [-1, 1441, 10.5, Number.NaN]) {
      expect(() => wallClockToUtc('2026-08-26', m, MEL), String(m)).toThrow(RangeError);
    }
  });

  it('refuses an unknown zone', () => {
    expect(() => wallClockToUtc('2026-08-26', 600, 'Mars/Olympus_Mons')).toThrow(RangeError);
  });
});
