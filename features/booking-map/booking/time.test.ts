import { describe, expect, it } from 'vitest';
import { addDays, nowMinutes, openingFor, SLOT, todayKey } from './time';
import { minutesNowIn, todayIn } from '../zoned-time';
import { HUB_TIMEZONE } from '@/lib/datetime';

/**
 * The map's own date helpers used to read the browser's clock. These pin them to
 * the hub's. CI runs this file under several machine timezones; every assertion
 * has to hold in all of them.
 */
describe('the map’s clock is the hub’s clock', () => {
  it('"today" is Melbourne’s date', () => {
    expect(todayKey()).toBe(todayIn(HUB_TIMEZONE));
  });

  it('"now" is Melbourne’s time, rounded up to a whole slot', () => {
    const m = nowMinutes();
    const expected = Math.ceil(minutesNowIn(HUB_TIMEZONE) / SLOT) * SLOT;
    expect(m % SLOT).toBe(0);
    // One slot of tolerance in case the minute ticks over between the two reads.
    expect(Math.abs(m - expected)).toBeLessThanOrEqual(SLOT);
  });
});

describe('opening hours by weekday', () => {
  it('knows Sunday is closed, whatever zone the machine is in', () => {
    expect(openingFor('2026-10-04')).toEqual({ open: null, close: null });
  });

  it('opens 9–5 on Saturday and 7–9 on weekdays', () => {
    expect(openingFor('2026-10-03')).toEqual({ open: 9 * 60, close: 17 * 60 });
    expect(openingFor('2026-10-05')).toEqual({ open: 7 * 60, close: 21 * 60 });
  });
});

describe('day arithmetic', () => {
  it('crosses both daylight-saving changes without drifting', () => {
    expect(addDays('2026-10-03', 1)).toBe('2026-10-04');
    expect(addDays('2026-10-04', 1)).toBe('2026-10-05');
    expect(addDays('2026-04-05', -1)).toBe('2026-04-04');
    expect(addDays('2026-04-04', 1)).toBe('2026-04-05');
  });
});
