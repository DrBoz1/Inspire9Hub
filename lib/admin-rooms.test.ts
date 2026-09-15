import { describe, expect, it } from "vitest";
import {
  amenitySummary,
  checkImage,
  cleanAmenities,
  formatPrice,
  matchesRoom,
  parsePrice,
  pricePreview,
  roomStatus,
  sortRooms,
  toAdminRoom,
  type AdminRoom,
} from "./admin-rooms";

const room = (o: Partial<AdminRoom> = {}): AdminRoom => ({
  id: "r1", name: "Dream Room", location: "Level 1", capacity: 6, price_per_hour: 12, regular_price_per_hour: 12,
  image_url: null, amenities: [], show_rating: true, active: true, bookable: true, ...o,
});

describe("reading rooms", () => {
  it("fills in sensible defaults", () => {
    expect(toAdminRoom({ id: "r1", name: " ", capacity: "8", price_per_hour: "24.50", regular_price_per_hour: null, amenities: null, active: null, bookable: false }))
      .toEqual({ id: "r1", name: "Untitled space", location: null, capacity: 8, price_per_hour: 24.5, regular_price_per_hour: null, image_url: null, amenities: [], show_rating: true, active: true, bookable: false });
  });

  it("describes each room's status", () => {
    expect([roomStatus(room()).key, roomStatus(room({ bookable: false })).key, roomStatus(room({ active: false, bookable: false })).key]).toEqual(["live", "not_bookable", "removed"]);
  });
});

describe("finding and ordering", () => {
  const rooms = [room({ id: "a", name: "Pool Room", capacity: 20, price_per_hour: 40 }), room({ id: "b", name: "Phone Booth", capacity: 1, price_per_hour: 6, location: "Level 2" }), room({ id: "c", name: "Old Room", capacity: 4, active: false })];

  it("sorts, with removed spaces last", () => {
    expect(sortRooms(rooms, "capacity").map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(sortRooms(rooms, "price").map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(sortRooms(rooms, "name").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("searches name and location", () => {
    expect(rooms.filter((r) => matchesRoom(r, "level 2")).map((r) => r.id)).toEqual(["b"]);
    expect(rooms.filter((r) => matchesRoom(r, "  ")).length).toBe(3);
  });
});

describe("amenities", () => {
  it("summarises in catalogue order", () => {
    expect(amenitySummary(["wifi", "whiteboard", "tv", "ac", "projector"], 3)).toEqual({ shown: ["Whiteboard", "TV Screen", "Projector"], more: 2 });
    expect(amenitySummary(["not-a-thing"])).toEqual({ shown: [], more: 0 });
  });

  it("keeps only known keys, once each", () => {
    expect(cleanAmenities(["wifi", "wifi", "hacker", "whiteboard"])).toEqual(["whiteboard", "wifi"]);
  });
});

describe("price", () => {
  it("accepts dollars and cents in range", () => {
    expect(parsePrice("12")).toEqual({ value: 12 });
    expect(parsePrice(" 12.50 ")).toEqual({ value: 12.5 });
    expect(parsePrice("1000")).toEqual({ value: 1000 });
  });

  it("rejects anything else", () => {
    for (const bad of ["", "abc", "12.505", "-5", "0.5", "1000.01", "1e3", null]) expect(parsePrice(bad), String(bad)).toHaveProperty("error");
  });

  it("previews the drop badge members will see", () => {
    expect(pricePreview(9, room({ price_per_hour: 12, regular_price_per_hour: 12 }), false)).toEqual({ regular: 12, drop: { regularPrice: 12, percentOff: 25 } });
    expect(pricePreview(9, room({ price_per_hour: 12, regular_price_per_hour: 12 }), true)).toEqual({ regular: 9, drop: null });
    expect(pricePreview(15, room({ price_per_hour: 12, regular_price_per_hour: null }), false).drop).toBeNull();
  });

  it("formats whole and fractional prices", () => {
    expect([formatPrice(12), formatPrice(12.5)]).toEqual(["$12", "$12.50"]);
  });
});

describe("photos", () => {
  it("checks type and size", () => {
    expect(checkImage({ type: "image/jpeg", size: 2_000_000 })).toBeNull();
    expect(checkImage({ type: "image/svg+xml", size: 1000 })).toContain("PNG, JPEG");
    expect(checkImage({ type: "image/png", size: 6 * 1024 * 1024 })).toContain("5MB");
  });
});
