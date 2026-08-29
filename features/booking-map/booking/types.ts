import type { AmenityKey } from '@/lib/constants';

/** Domain types for the Inspire9 space-booking map. */

export type SpaceKind =
  | 'desk'
  | 'workpoint'
  | 'collab_table'
  | 'lounge_pod'
  | 'team_bay'
  | 'phone_booth'
  | 'meeting_room'
  | 'boardroom'
  | 'training_room'
  | 'private_office'
  | 'amenity';

/** Top-level filter buckets shown as chips in the toolbar. */
export type SpaceGroup = 'desks' | 'rooms' | 'offices' | 'facilities';

/**
 * The map used to declare its own twelve amenity values. They only half-overlapped
 * the hub's, so a database-backed space would have failed every filter silently.
 * There is one vocabulary now, in lib/constants.ts; lib/amenities.ts translates the
 * old values for anything still carrying them.
 */
export type Amenity = AmenityKey;

export type Shape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { t: 'poly'; pts: Array<[number, number]> };

export type LabelMode = 'inside' | 'code' | 'none';

export interface Space {
  id: string;
  /** Short reference printed on the plan, e.g. "1.A", "PB-2", "D-A1". */
  code: string;
  name: string;
  kind: SpaceKind;
  group: SpaceGroup;
  /** Seats. 0 for amenities. */
  capacity: number;
  bookable: boolean;
  shape: Shape;
  label: LabelMode;
  /** Optional override for the label anchor (defaults to shape centroid). */
  labelAt?: [number, number];
  zone: 'West Wing' | 'Central Core' | 'East Wing' | 'North Amenities';
  amenities: Amenity[];
  description: string;
  /** Minutes. Bookings shorter/longer than this are rejected. */
  minMinutes?: number;
  maxMinutes?: number;
  /** Cost per hour in AUD; 0 = included with membership. */
  ratePerHour?: number;
}

export interface Booking {
  id: string;
  spaceId: string;
  /** ISO-8601 local datetime, minute precision. */
  start: string;
  end: string;
  title: string;
  owner: string;
  /** True when the booking belongs to the signed-in member. */
  mine?: boolean;
}

/**
 * Availability of one space for the currently selected window.
 * `partial` means the window is partly free — enough to be worth offering an
 * alternative slot rather than greying the space out entirely.
 */
export type Availability = 'available' | 'partial' | 'booked' | 'mine' | 'closed';

export interface OpeningHours {
  /** Minutes from midnight; null = closed that day. */
  open: number | null;
  close: number | null;
}

export interface TimeWindow {
  /** yyyy-mm-dd */
  date: string;
  /** Minutes from midnight. */
  from: number;
  to: number;
}
