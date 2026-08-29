import { describe, expect, it } from "vitest";
import { ALL_AMENITIES, AMENITY_LABELS, type AmenityKey } from "@/lib/constants";
import {
  LEGACY_MAP_AMENITY,
  LOSSY_MAPPINGS,
  isAmenityKey,
  toAmenityKey,
  toAmenityKeys,
  type LegacyMapAmenity,
} from "@/lib/amenities";
import { SPACES } from "@/features/booking-map/data/spaces";

/**
 * The amenity vocabulary is the one thing in this migration that fails *silently*.
 * A wrong key doesn't throw -- a filter just returns nothing, and you find out from
 * a member who couldn't book a room. These tests are the alarm.
 */

/** Every value the standalone map ever wrote. Hard-coded on purpose: if the mapping
 *  table loses an entry, this list still remembers it and the test fails. */
const LEGACY_VALUES: LegacyMapAmenity[] = [
  "whiteboard", "av", "video", "display", "standing",
  "monitor", "power", "daylight", "accessible", "quiet", "hvac", "catering",
];

/** The eight keys already written to `workspaces.amenities` in production. These
 *  are stored as plain text, so renaming one silently orphans live data. */
const KEYS_IN_PRODUCTION_DATA = [
  "whiteboard", "tv", "projector", "ac", "wifi", "video_conf", "conf_phone", "catering",
] as const;

describe("canonical vocabulary", () => {
  it("has no duplicate keys", () => {
    const keys = ALL_AMENITIES.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every key a non-empty label", () => {
    for (const { key } of ALL_AMENITIES) {
      expect(AMENITY_LABELS[key], `no label for "${key}"`).toBeTruthy();
    }
  });

  it("still contains every key present in live workspaces rows", () => {
    // Renaming or removing one of these orphans amenities on real rooms.
    for (const key of KEYS_IN_PRODUCTION_DATA) {
      expect(isAmenityKey(key), `"${key}" is stored in the database but no longer canonical`).toBe(true);
    }
  });
});

describe("legacy map vocabulary", () => {
  it("maps every one of the map's twelve values", () => {
    for (const legacy of LEGACY_VALUES) {
      expect(LEGACY_MAP_AMENITY[legacy], `"${legacy}" has no mapping`).toBeDefined();
    }
  });

  it("maps them all to keys that actually exist", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_MAP_AMENITY)) {
      expect(isAmenityKey(canonical), `"${legacy}" maps to "${canonical}", which is not canonical`).toBe(true);
    }
  });

  it("has no mapping entries beyond the twelve legacy values", () => {
    // Guards against a typo adding a phantom key that silently never matches.
    expect(Object.keys(LEGACY_MAP_AMENITY).sort()).toEqual([...LEGACY_VALUES].sort());
  });

  it("keeps the identical pair identical", () => {
    expect(LEGACY_MAP_AMENITY.whiteboard).toBe("whiteboard");
    expect(LEGACY_MAP_AMENITY.catering).toBe("catering");
  });

  it("translates the four renamed concepts", () => {
    expect(LEGACY_MAP_AMENITY.hvac).toBe("ac");
    expect(LEGACY_MAP_AMENITY.display).toBe("tv");
    expect(LEGACY_MAP_AMENITY.video).toBe("video_conf");
    expect(LEGACY_MAP_AMENITY.av).toBe("projector");
  });

  it("declares every lossy mapping it makes", () => {
    // `av` ("AV media") is broader than `projector`. If another imprecise mapping
    // is added later it must be recorded, not quietly introduced.
    for (const l of LOSSY_MAPPINGS) expect(LEGACY_VALUES).toContain(l);
  });
});

describe("translation helpers", () => {
  it("passes canonical keys straight through", () => {
    expect(toAmenityKey("video_conf")).toBe("video_conf");
  });

  it("translates a legacy key", () => {
    expect(toAmenityKey("hvac")).toBe("ac");
  });

  it("returns null for anything unrecognised rather than guessing", () => {
    expect(toAmenityKey("teleporter")).toBeNull();
    expect(toAmenityKey("")).toBeNull();
  });

  it("de-duplicates when two legacy values collapse onto one key", () => {
    // 'tv' and 'display' are the same concept; a list carrying both must not
    // produce a duplicate that shows the chip twice.
    expect(toAmenityKeys(["display", "tv"])).toEqual(["tv"]);
  });

  it("drops unknown values instead of passing them downstream", () => {
    expect(toAmenityKeys(["hvac", "teleporter", "power"])).toEqual(["ac", "power"]);
  });

  it("preserves order of first appearance", () => {
    expect(toAmenityKeys(["power", "hvac", "whiteboard"])).toEqual(["power", "ac", "whiteboard"]);
  });
});

describe("the migrated floor-plan data", () => {
  const used = [...new Set(SPACES.flatMap((s) => s.amenities as string[]))].sort();

  it("carries only canonical keys", () => {
    const bad = used.filter((a) => !isAmenityKey(a));
    expect(bad, `spaces.ts still uses non-canonical amenities: ${bad.join(", ")}`).toEqual([]);
  });

  it("no longer carries any legacy-only spelling", () => {
    const legacyOnly = LEGACY_VALUES.filter((l) => !isAmenityKey(l));
    for (const l of legacyOnly) {
      expect(used, `spaces.ts still contains the old value "${l}"`).not.toContain(l);
    }
  });

  it("can label everything it uses", () => {
    for (const a of used) {
      expect(AMENITY_LABELS[a as AmenityKey], `no label for "${a}"`).toBeTruthy();
    }
  });

  it("did not lose any amenities in the rewrite", () => {
    // 12 distinct values went in; they collapse to 12 canonical ones because no two
    // legacy values in the plan data share a target.
    expect(used.length).toBe(12);
  });
});
