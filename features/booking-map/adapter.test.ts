import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mergeSpaces,
  planIdByWorkspace,
  toMapBookings,
  windowToUtcRange,
  buildCheckout,
  parseBookRequest,
  parseDayPassRequest,
  SERVER_MIN_MINUTES,
  type DayBookingRow,
  type WorkspaceRow,
} from './adapter';
import { SPACES } from './data/spaces';
import { MIN_MINUTES } from '@/lib/booking-rules';
import { availabilityOf, bookingsOnDay } from './booking/time';

const MEL = 'Australia/Melbourne';

const row = (o: Partial<WorkspaceRow> = {}): WorkspaceRow => ({
  id: 'ws-dream',
  name: 'Dream Room',
  capacity: 4,
  location: 'Level 1',
  price_per_hour: 12,
  amenities: ['whiteboard', 'tv', 'ac', 'wifi'],
  floorplan_id: 'meeting-a',
  active: true,
  ...o,
});

const planA = SPACES.find((s) => s.id === 'meeting-a')!;

describe('mergeSpaces: before anything is linked', () => {
  const { spaces, linkedCount, problems } = mergeSpaces(SPACES, []);

  it('keeps every drawn space', () => {
    expect(spaces.map((s) => s.id)).toEqual(SPACES.map((s) => s.id));
  });

  it('marks every bookable drawn space as unlinked and unbookable', () => {
    for (const s of spaces.filter((x) => SPACES.find((p) => p.id === x.id)!.bookable)) {
      expect(s.bookable, s.id).toBe(false);
      expect(s.unlinked, s.id).toBe(true);
    }
    expect(linkedCount).toBe(0);
    expect(problems).toEqual([]);
  });

  it('shows no price or booking limits for a space no room backs', () => {
    for (const s of spaces.filter((x) => x.unlinked)) {
      expect(s.ratePerHour, s.id).toBeUndefined();
      expect(s.minMinutes, s.id).toBeUndefined();
      expect(s.maxMinutes, s.id).toBeUndefined();
    }
  });

  it('leaves kitchens and stairwells exactly as drawn', () => {
    for (const s of SPACES.filter((x) => !x.bookable)) {
      expect(spaces.find((x) => x.id === s.id)).toBe(s);
    }
  });

  it('copes with rows from before the migration, which have no floorplan_id at all', () => {
    const legacy = { id: 'x', name: 'Elbow Room', capacity: 5, price_per_hour: 45, amenities: ['ac'] };
    expect(mergeSpaces(SPACES, [legacy]).linkedCount).toBe(0);
  });
});

describe('mergeSpaces: a linked room', () => {
  const merged = mergeSpaces(SPACES, [row()]);
  const a = merged.spaces.find((s) => s.id === 'meeting-a')!;

  it('becomes bookable and remembers its workspace', () => {
    expect(a.bookable).toBe(true);
    expect(a.unlinked).toBe(false);
    expect(a.workspaceId).toBe('ws-dream');
    expect(merged.linkedCount).toBe(1);
  });

  it('takes what admins edit from the database', () => {
    expect(a.name).toBe('Dream Room');
    expect(a.capacity).toBe(4);
    expect(a.ratePerHour).toBe(12);
  });

  it('keeps geometry and wing from the drawing', () => {
    expect(a.shape).toBe(planA.shape);
    expect(a.zone).toBe(planA.zone);
    expect(a.label).toBe(planA.label);
  });

  it('puts amenities through the canonical vocabulary', () => {
    const m = mergeSpaces(SPACES, [row({ amenities: ['hvac', 'display', 'teleporter', 'ac'] })]);
    expect(m.spaces.find((s) => s.id === 'meeting-a')!.amenities).toEqual(['ac', 'tv']);
  });

  it('accepts a numeric price that arrives as a string', () => {
    expect(mergeSpaces(SPACES, [row({ price_per_hour: '45.5' })]).spaces.find((s) => s.id === 'meeting-a')!.ratePerHour).toBe(45.5);
  });

  it('uses kind and group from the database only when they are valid', () => {
    const ok = mergeSpaces(SPACES, [row({ kind: 'boardroom', space_group: 'rooms' })]).spaces.find((s) => s.id === 'meeting-a')!;
    expect(ok.kind).toBe('boardroom');
    const bad = mergeSpaces(SPACES, [row({ kind: 'hot_tub', space_group: 'spa' })]).spaces.find((s) => s.id === 'meeting-a')!;
    expect(bad.kind).toBe(planA.kind);
    expect(bad.group).toBe(planA.group);
  });
});

describe('mergeSpaces: rows that must not become bookable', () => {
  const find = (r: WorkspaceRow) => mergeSpaces(SPACES, [r]);

  it('ignores a retired room', () => {
    const m = find(row({ active: false }));
    expect(m.linkedCount).toBe(0);
    expect(m.spaces.find((s) => s.id === 'meeting-a')!.unlinked).toBe(true);
  });

  it('shows a room an admin switched off, but not as bookable', () => {
    const a = find(row({ bookable: false })).spaces.find((s) => s.id === 'meeting-a')!;
    expect(a.workspaceId).toBe('ws-dream');
    expect(a.bookable).toBe(false);
    expect(a.unlinked).toBe(false);
  });

  it('refuses a room without a usable price, and says why', () => {
    for (const p of [null, 'free', -5, Number.NaN]) {
      const m = find(row({ price_per_hour: p as never }));
      expect(m.spaces.find((s) => s.id === 'meeting-a')!.bookable, String(p)).toBe(false);
      expect(m.problems.join(' '), String(p)).toMatch(/price/);
    }
  });

  it('reports a link to a position that is not on the plan, without breaking anything', () => {
    const m = find(row({ floorplan_id: 'the-moon' }));
    expect(m.linkedCount).toBe(0);
    expect(m.problems.join(' ')).toMatch(/the-moon/);
  });

  it('keeps the first of two rooms linked to one position, and says so', () => {
    const m = mergeSpaces(SPACES, [row(), row({ id: 'ws-elbow', name: 'Elbow Room' })]);
    expect(m.spaces.find((s) => s.id === 'meeting-a')!.workspaceId).toBe('ws-dream');
    expect(m.problems.join(' ')).toMatch(/both linked/);
  });

  it('drops a maximum shorter than the minimum rather than making the room unbookable', () => {
    const a = find(row({ min_minutes: 60, max_minutes: 30 })).spaces.find((s) => s.id === 'meeting-a')!;
    expect(a.minMinutes).toBe(60);
    expect(a.maxMinutes).toBeUndefined();
  });
});

describe('mergeSpaces: a desk is sold by the day', () => {
  const desk = (o: Partial<WorkspaceRow> = {}): WorkspaceRow => ({
    id: 'ws-desk-a1',
    name: 'Desk A1',
    capacity: 1,
    location: 'Level 1',
    // What the migration leaves behind: desks never charge by the hour.
    price_per_hour: 0,
    price_per_day: 35,
    amenities: ['monitor', 'power'],
    floorplan_id: 'desk-A1',
    code: 'A1',
    kind: 'desk',
    space_group: 'desks',
    active: true,
    ...o,
  });
  const a1 = (row: WorkspaceRow) => {
    const m = mergeSpaces(SPACES, [row]);
    return { m, s: m.spaces.find((x) => x.id === 'desk-A1')! };
  };

  it('prices the desk by the day, never by the hour', () => {
    const { s } = a1(desk());
    expect(s.ratePerDay).toBe(35);
    expect(s.ratePerHour).toBeUndefined();
    expect(s.bookable).toBe(true);
    expect(s.workspaceId).toBe('ws-desk-a1');
  });

  it('accepts a day price that arrives as a string', () => {
    expect(a1(desk({ price_per_day: '35.00' })).s.ratePerDay).toBe(35);
  });

  it('is simply not on sale until staff set a day price, which is no error', () => {
    for (const p of [null, undefined, 0, 'free', -5]) {
      const { m, s } = a1(desk({ price_per_day: p as never }));
      expect(s.bookable, String(p)).toBe(false);
      expect(s.ratePerDay, String(p)).toBeUndefined();
      expect(m.problems, String(p)).toEqual([]);
    }
  });

  it('ignores the hourly price on a desk row even when one is set', () => {
    const { s } = a1(desk({ price_per_hour: 12 }));
    expect(s.ratePerHour).toBeUndefined();
    expect(s.ratePerDay).toBe(35);
  });

  it('leaves rooms on their hourly price', () => {
    const meeting = mergeSpaces(SPACES, [row()]).spaces.find((s) => s.id === 'meeting-a')!;
    expect(meeting.ratePerHour).toBe(12);
    expect(meeting.ratePerDay).toBeUndefined();
  });

  it('still refuses a desk an admin has switched off', () => {
    expect(a1(desk({ bookable: false })).s.bookable).toBe(false);
  });
});

describe('buying a day pass from the map', () => {
  const DESK = '2d5fdf80-a9dc-456a-b040-ac660f1ee6b2';

  it('accepts a desk and a day', () => {
    expect(parseDayPassRequest({ workspaceId: DESK, day: '2026-08-26' })).toEqual({
      ok: true,
      value: { workspaceId: DESK, day: '2026-08-26' },
    });
  });

  it.each([
    ['a desk id that isn’t one', { workspaceId: 'desk-A1', day: '2026-08-26' }],
    ['a date that doesn’t exist', { workspaceId: DESK, day: '2026-02-30' }],
    ['a day in the wrong shape', { workspaceId: DESK, day: '26/08/2026' }],
    ['no day at all', { workspaceId: DESK }],
    ['nothing', null],
    ['a string', 'book it'],
  ])('rejects %s', (_, input) => {
    expect(parseDayPassRequest(input).ok).toBe(false);
  });

  it('ignores a window sent alongside: a pass is always the whole day', () => {
    const r = parseDayPassRequest({ workspaceId: DESK, day: '2026-08-26', from: 600, to: 660 });
    expect(r).toEqual({ ok: true, value: { workspaceId: DESK, day: '2026-08-26' } });
  });
});

describe('toMapBookings', () => {
  const spaces = mergeSpaces(SPACES, [row()]).spaces;
  const ids = planIdByWorkspace(spaces);
  const b = (o: Partial<DayBookingRow> = {}): DayBookingRow => ({
    id: 'b1', workspaceId: 'ws-dream',
    startUtc: '2026-08-26T00:00:00.000Z', endUtc: '2026-08-26T01:00:00.000Z',
    mine: false, pending: false, ...o,
  });

  it('turns a winter UTC booking into Melbourne wall clock (+10)', () => {
    const { bookings } = toMapBookings([b()], '2026-08-26', MEL, ids);
    expect(bookings).toEqual([expect.objectContaining({ spaceId: 'meeting-a', start: '2026-08-26T10:00', end: '2026-08-26T11:00' })]);
  });

  it('turns a summer UTC booking into Melbourne wall clock (+11)', () => {
    const { bookings } = toMapBookings(
      [b({ startUtc: '2026-11-30T23:00:00Z', endUtc: '2026-12-01T00:30:00Z' })], '2026-12-01', MEL, ids);
    expect(bookings[0]).toMatchObject({ start: '2026-12-01T10:00', end: '2026-12-01T11:30' });
  });

  it('never sends another member’s identity to the map', () => {
    const [x] = toMapBookings([b()], '2026-08-26', MEL, ids).bookings;
    expect(x.owner).toBe('another member');
    expect(x.title).toBe('Booked');
    expect(x.mine).toBe(false);
  });

  it('marks the viewer’s own confirmed booking as theirs', () => {
    const [x] = toMapBookings([b({ mine: true })], '2026-08-26', MEL, ids).bookings;
    expect(x).toMatchObject({ mine: true, title: 'Your booking' });
  });

  it('ignores the viewer’s own pending hold but not anyone else’s', () => {
    expect(toMapBookings([b({ mine: true, pending: true })], '2026-08-26', MEL, ids).bookings).toEqual([]);
    expect(toMapBookings([b({ mine: false, pending: true })], '2026-08-26', MEL, ids).bookings).toHaveLength(1);
  });

  it('skips rooms that are not on the plan', () => {
    expect(toMapBookings([b({ workspaceId: 'ws-pool' })], '2026-08-26', MEL, ids).bookings).toEqual([]);
  });

  it('clips a booking that crosses midnight to the part on the day asked for', () => {
    // 22:00 on the 26th to 02:00 on the 27th, Melbourne.
    const cross = b({ startUtc: '2026-08-26T12:00:00Z', endUtc: '2026-08-26T16:00:00Z' });
    expect(toMapBookings([cross], '2026-08-26', MEL, ids).bookings[0]).toMatchObject({ start: '2026-08-26T22:00', end: '2026-08-26T24:00' });
    expect(toMapBookings([cross], '2026-08-27', MEL, ids).bookings[0]).toMatchObject({ start: '2026-08-27T00:00', end: '2026-08-27T02:00' });
  });

  it('leaves out bookings on other days', () => {
    expect(toMapBookings([b()], '2026-08-27', MEL, ids).bookings).toEqual([]);
  });

  it('counts, rather than crashes on, rows with broken timestamps', () => {
    const r = toMapBookings([b({ startUtc: 'nope' }), b({ endUtc: '2026-08-25T00:00:00Z' })], '2026-08-26', MEL, ids);
    expect(r).toEqual({ bookings: [], skipped: 2 });
  });

  it('refuses a malformed day', () => {
    expect(() => toMapBookings([], '2026-02-30', MEL, ids)).toThrow(RangeError);
  });

  it('produces bookings the map’s own availability rules understand', () => {
    const { bookings } = toMapBookings([b()], '2026-08-26', MEL, ids);
    const a = spaces.find((s) => s.id === 'meeting-a')!;
    expect(bookingsOnDay(bookings, 'meeting-a', '2026-08-26')).toHaveLength(1);
    expect(availabilityOf(a, bookings, { date: '2026-08-26', from: 600, to: 660 })).toBe('booked');
    expect(availabilityOf(a, bookings, { date: '2026-08-26', from: 660, to: 720 })).not.toBe('booked');
  });
});

describe('windowToUtcRange', () => {
  it('converts a winter window', () => {
    expect(windowToUtcRange('2026-08-26', 600, 660, MEL)).toEqual({
      startISO: '2026-08-26T00:00:00.000Z', endISO: '2026-08-26T01:00:00.000Z',
    });
  });

  it('is the inverse of toMapBookings', () => {
    const spaces = mergeSpaces(SPACES, [row()]).spaces;
    for (const [day, f, t] of [['2026-08-26', 600, 675], ['2026-12-01', 420, 1260], ['2026-10-04', 540, 600]] as const) {
      const { startISO, endISO } = windowToUtcRange(day, f, t, MEL);
      const [back] = toMapBookings(
        [{ id: 'r', workspaceId: 'ws-dream', startUtc: startISO, endUtc: endISO, mine: false, pending: false }],
        day, MEL, planIdByWorkspace(spaces),
      ).bookings;
      expect(back, day).toMatchObject({ start: `${day}T${String(f / 60 | 0).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}` });
    }
  });

  it('refuses an empty or backwards window', () => {
    expect(() => windowToUtcRange('2026-08-26', 600, 600, MEL)).toThrow(RangeError);
    expect(() => windowToUtcRange('2026-08-26', 660, 600, MEL)).toThrow(RangeError);
  });
});

describe('booking from the map', () => {
  const ROOM = { id: '2d5fdf80-a9dc-456a-b040-ac660f1ee6b2', name: 'Pool Room', price_per_hour: 90 };
  const req = (o: Record<string, unknown> = {}) =>
    parseBookRequest({ workspaceId: ROOM.id, day: '2026-08-26', from: 600, to: 660, ...o });
  const valid = (o: Record<string, unknown> = {}) => {
    const r = req(o);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };

  it('accepts a well-formed request', () => {
    expect(req()).toEqual({ ok: true, value: { workspaceId: ROOM.id, day: '2026-08-26', from: 600, to: 660 } });
  });

  it.each([
    ['a room id that isn’t one', { workspaceId: 'dream-room' }],
    ['a date that doesn’t exist', { day: '2026-02-30' }],
    ['a time off the 15-minute grid', { from: 607 }],
    ['fractional minutes', { to: 660.5 }],
    ['a time past midnight', { to: 1455 }],
    ['a negative time', { from: -15 }],
    ['a backwards window', { from: 660, to: 600 }],
    ['an empty window', { from: 600, to: 600 }],
    ['numbers sent as strings', { from: '600' }],
  ])('rejects %s', (_, o) => {
    expect(req(o).ok).toBe(false);
  });

  it('rejects things that aren’t requests at all', () => {
    expect(parseBookRequest(null).ok).toBe(false);
    expect(parseBookRequest('book it').ok).toBe(false);
  });

  it('builds the checkout from wall-clock minutes (winter, +10)', () => {
    expect(buildCheckout(ROOM, valid({ to: 690 }), MEL)).toEqual({
      workspaceId: ROOM.id, roomName: 'Pool Room', amount: 135, date: '2026-08-26',
      startTime: '10:00', endTime: '11:30',
      startISO: '2026-08-26T00:00:00.000Z', endISO: '2026-08-26T01:30:00.000Z',
      returnTo: '/dashboard',
    });
  });

  it('uses the summer offset in summer (+11)', () => {
    const c = buildCheckout(ROOM, valid({ day: '2026-12-01' }), MEL);
    expect(c.startISO).toBe('2026-11-30T23:00:00.000Z');
  });

  it('prices part-hours exactly', () => {
    expect(buildCheckout({ ...ROOM, price_per_hour: 45 }, valid({ to: 645 }), MEL).amount).toBe(33.75);
  });

  it('floors every linked room at the server’s one-hour minimum', () => {
    const minOf = (m: number | null) =>
      mergeSpaces(SPACES, [row({ min_minutes: m })]).spaces.find((s) => s.id === 'meeting-a')!.minMinutes;
    expect(minOf(15)).toBe(SERVER_MIN_MINUTES);
    expect(minOf(null)).toBe(SERVER_MIN_MINUTES);
    expect(minOf(120)).toBe(120);
  });

  it('matches the minimum the checkout server action actually enforces', () => {
    // The checkout enforces lib/booking-rules; the map has to agree with it.
    const src = readFileSync(join(import.meta.dirname, '../../app/(dashboard)/bookings/actions.ts'), 'utf8');
    expect(src).toContain('checkBookingWindow(');
    expect(SERVER_MIN_MINUTES).toBe(MIN_MINUTES);
  });
});
