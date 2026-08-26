import type { Booking } from '../booking/types';
import { BOOKABLE_SPACES } from './spaces';
import { addDays, makeISO, openingFor, todayKey } from '../booking/time';

/** Deterministic PRNG so the demo shows the same day every reload. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TEAMS = [
  'Lumen Labs', 'Northbound', 'Practice Studio', 'Verity Health', 'Foundry Collective',
  'Tessellate', 'Harbour & Co', 'Ridgeway Data', 'Studio Kite', 'Openfield',
];

const PEOPLE = [
  'A. Okafor', 'M. Vance', 'S. Lin', 'J. Petrov', 'R. Callaghan', 'D. Mbeki',
  'K. Nakamura', 'T. Alvarez', 'H. Byrne', 'N. Farrell', 'P. Whitlock', 'E. Sørensen',
];

const ROOM_TITLES = [
  'Sprint planning', 'Client workshop', 'Design review', 'Board catch-up', 'Investor call',
  'Onboarding', 'All-hands', '1:1', 'Retro', 'Pitch rehearsal', 'Interview panel', 'Standup',
];

const DESK_TITLES = ['Desk booking', 'Focus day', 'Half day', 'Team day in'];

/** How likely a space of each kind is to be busy on any given day. */
const LOAD: Record<string, number> = {
  meeting_room: 0.72,
  boardroom: 0.5,
  training_room: 0.35,
  private_office: 0.55,
  phone_booth: 0.6,
  team_bay: 0.45,
  workpoint: 0.3,
  collab_table: 0.35,
  lounge_pod: 0.3,
  desk: 0.5,
};

/**
 * Builds a plausible week of bookings around `anchor`.
 * The signed-in member ("you") gets a handful so the "My bookings" state is real.
 */
export function generateBookings(anchor = todayKey(), daysBack = 2, daysForward = 9): Booking[] {
  const out: Booking[] = [];
  let n = 0;

  for (let offset = -daysBack; offset <= daysForward; offset++) {
    const date = addDays(anchor, offset);
    const hours = openingFor(date);
    if (hours.open === null || hours.close === null) continue;

    for (const space of BOOKABLE_SPACES) {
      const rand = mulberry32(hash(`${space.id}|${date}`));
      const load = (LOAD[space.kind] ?? 0.4) * (offset < 0 ? 1 : 1 - Math.min(offset, 6) * 0.06);
      if (rand() > load) continue;

      const isDesk = space.kind === 'desk' || space.kind === 'team_bay' || space.kind === 'workpoint';
      const sessions = isDesk ? 1 : 1 + Math.floor(rand() * 2.4);
      let cursor = hours.open + Math.floor(rand() * 6) * 30;

      for (let s = 0; s < sessions; s++) {
        const dur = isDesk
          ? [4 * 60, 6 * 60, 8 * 60][Math.floor(rand() * 3)]
          : [30, 45, 60, 60, 90, 120][Math.floor(rand() * 6)];
        const start = cursor;
        const end = start + dur;
        if (end > hours.close) break;

        const mine = rand() < 0.07;
        const owner = mine ? 'You' : PEOPLE[Math.floor(rand() * PEOPLE.length)];
        const title = mine
          ? isDesk ? 'Your desk' : 'Your booking'
          : isDesk
            ? `${TEAMS[Math.floor(rand() * TEAMS.length)]} · ${DESK_TITLES[Math.floor(rand() * DESK_TITLES.length)]}`
            : ROOM_TITLES[Math.floor(rand() * ROOM_TITLES.length)];

        out.push({
          id: `seed-${n++}`,
          spaceId: space.id,
          start: makeISO(date, start),
          end: makeISO(date, end),
          title,
          owner,
          mine,
        });

        cursor = end + 30 + Math.floor(rand() * 5) * 30;
        if (cursor >= hours.close) break;
      }
    }
  }
  return out;
}
