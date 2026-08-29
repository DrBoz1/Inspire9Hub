import { ALL_AMENITIES, type AmenityKey } from "@/lib/constants";

/**
 * Reconciling the two amenity vocabularies.
 *
 * The floor-plan map arrived from a standalone app with its own twelve amenity
 * values. The hub already had eight, stored as plain text in `workspaces.amenities`.
 * Only `whiteboard` and `catering` were spelled the same in both -- the map said
 * `hvac` where the hub said `ac`, `display` where the hub said `tv`, and so on.
 *
 * Left alone that fails silently: the map's filter chips would match nothing at all
 * once spaces came from the database. No error, no empty-state, just a filter that
 * quietly returns zero rows.
 *
 * The hub's vocabulary wins, because it is the one already written to the database
 * and already spoken by the assistant and the booking pages. Six concepts the map
 * had and the hub lacked were added to ALL_AMENITIES rather than dropped. This
 * module holds the remaining translation, and is the only place it exists.
 */

/** The twelve values the standalone map shipped with. Frozen -- this is history. */
export type LegacyMapAmenity =
  | "whiteboard"
  | "av"
  | "video"
  | "display"
  | "standing"
  | "monitor"
  | "power"
  | "daylight"
  | "accessible"
  | "quiet"
  | "hvac"
  | "catering";

/**
 * Every legacy value, mapped to a canonical one.
 *
 * Typed as a total Record, so adding a value to LegacyMapAmenity without deciding
 * where it goes is a compile error rather than an `undefined` that survives to
 * production. There is deliberately no `| null` escape hatch: nothing in the map's
 * vocabulary is worth silently discarding, and if something ever is, that should be
 * a visible change to this type.
 */
export const LEGACY_MAP_AMENITY: Record<LegacyMapAmenity, AmenityKey> = {
  // Identical in both vocabularies.
  whiteboard: "whiteboard",
  catering: "catering",

  // Same concept, different word.
  hvac: "ac",           // "Independent heating & cooling" -> Air Conditioning
  display: "tv",        // "Display"                       -> TV Screen
  video: "video_conf",  // "Video conferencing"            -> Video Conferencing
  av: "projector",      // "AV media" -- the only lossy one; see note below.

  // Concepts the hub lacked; added to ALL_AMENITIES with these exact keys.
  power: "power",
  monitor: "monitor",
  daylight: "daylight",
  quiet: "quiet",
  standing: "standing",
  accessible: "accessible",
};

/**
 * `av` is the one imprecise mapping. The map used it for "AV media" generally,
 * which is broader than a projector -- but the hub has no broader term, and every
 * space that carried `av` in the plan data is a room with a projector. Recorded
 * here so the choice is visible rather than buried.
 */
export const LOSSY_MAPPINGS: ReadonlyArray<LegacyMapAmenity> = ["av"];

const CANONICAL = new Set<string>(ALL_AMENITIES.map((a) => a.key));

/** True when `value` is a canonical amenity key. */
export function isAmenityKey(value: string): value is AmenityKey {
  return CANONICAL.has(value);
}

/**
 * Translate one value from either vocabulary into the canonical one.
 * Returns null for anything unrecognised, so callers can drop or report it rather
 * than passing a bad key downstream.
 */
export function toAmenityKey(value: string): AmenityKey | null {
  if (isAmenityKey(value)) return value;
  const mapped = LEGACY_MAP_AMENITY[value as LegacyMapAmenity];
  return mapped ?? null;
}

/**
 * Translate a list, dropping anything unrecognised and de-duplicating. Two legacy
 * values can collapse onto one canonical key, so the de-dup matters.
 */
export function toAmenityKeys(values: readonly string[]): AmenityKey[] {
  const out: AmenityKey[] = [];
  for (const v of values) {
    const k = toAmenityKey(v);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}
