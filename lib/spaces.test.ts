import { describe, expect, it } from "vitest";
import { dayPrice, desksOnly, freeDesks, isDeskRow, roomsOnly } from "./spaces";

const rows = [
  { id: "r1", name: "Dream Room", kind: "meeting_room", space_group: "rooms" },
  { id: "d2", name: "Desk A2", code: "A2", kind: "desk", space_group: "desks" },
  { id: "d10", name: "Desk B1", code: "B1", kind: "desk", space_group: "desks" },
  { id: "d1", name: "Desk A1", code: "A1", kind: "desk", space_group: "desks" },
  { id: "r0", name: "Old room", kind: null, space_group: null },
];

describe("rooms and desks", () => {
  it("tells a desk from a room, including rooms from before the floor plan columns", () => {
    expect(rows.filter(isDeskRow).map((r) => r.id)).toEqual(["d2", "d10", "d1"]);
    expect(roomsOnly(rows).map((r) => r.id)).toEqual(["r1", "r0"]);
    expect(desksOnly(rows)).toHaveLength(3);
  });

  it("offers free desks bank by bank, and never a taken one", () => {
    const desks = desksOnly(rows);
    expect(freeDesks(desks, new Set()).map((d) => d.code)).toEqual(["A1", "A2", "B1"]);
    expect(freeDesks(desks, new Set(["d1"])).map((d) => d.code)).toEqual(["A2", "B1"]);
    expect(freeDesks(desks, new Set(["d1", "d2", "d10"]))).toEqual([]);
  });

  it("puts A10 after A9, not after A1", () => {
    const desks = [{ id: "x", code: "A10" }, { id: "y", code: "A9" }, { id: "z", code: "A1" }];
    expect(freeDesks(desks, new Set()).map((d) => d.code)).toEqual(["A1", "A9", "A10"]);
  });

  it("only sells a desk with a real day price", () => {
    expect(dayPrice(35)).toBe(35);
    expect(dayPrice("42.5")).toBe(42.5);
    for (const none of [null, undefined, 0, -5, "abc", NaN]) expect(dayPrice(none)).toBeNull();
  });
});
