import { ALL_AMENITIES, type AmenityKey } from "@/lib/constants";
import { getPriceDropInfo } from "@/lib/pricing";

export type AdminRoom = {
  id: string;
  name: string;
  location: string | null;
  capacity: number;
  price_per_hour: number;
  regular_price_per_hour: number | null;
  image_url: string | null;
  amenities: string[];
  show_rating: boolean;
  active: boolean;
  bookable: boolean;
};

export type RawRoom = {
  id: string;
  name?: string | null;
  location?: string | null;
  capacity?: number | string | null;
  price_per_hour?: number | string | null;
  regular_price_per_hour?: number | string | null;
  image_url?: string | null;
  amenities?: string[] | null;
  show_rating?: boolean | null;
  active?: boolean | null;
  bookable?: boolean | null;
};

const num = (value: number | string | null | undefined) => {
  const n = value === null || value === undefined || value === "" ? NaN : Number(value);
  return Number.isFinite(n) ? n : null;
};

export function toAdminRoom(row: RawRoom): AdminRoom {
  return {
    id: row.id,
    name: row.name?.trim() || "Untitled space",
    location: row.location?.trim() || null,
    capacity: num(row.capacity) ?? 0,
    price_per_hour: num(row.price_per_hour) ?? 0,
    regular_price_per_hour: num(row.regular_price_per_hour),
    image_url: row.image_url?.trim() || null,
    amenities: row.amenities ?? [],
    show_rating: row.show_rating !== false,
    active: row.active !== false,
    bookable: row.bookable !== false,
  };
}

export type RoomSort = "capacity" | "price" | "name";

/** Removed spaces always sink to the bottom. */
export function sortRooms(rooms: AdminRoom[], by: RoomSort) {
  const key = (r: AdminRoom) => (by === "price" ? r.price_per_hour : by === "capacity" ? r.capacity : 0);
  return [...rooms].sort((a, b) => Number(!a.active) - Number(!b.active) || key(a) - key(b) || a.name.localeCompare(b.name));
}

export function matchesRoom(room: AdminRoom, query: string) {
  const q = query.trim().toLowerCase();
  return !q || `${room.name} ${room.location ?? ""}`.toLowerCase().includes(q);
}

export function roomStatus(room: Pick<AdminRoom, "active" | "bookable">) {
  if (!room.active) return { key: "removed", label: "Removed" } as const;
  if (!room.bookable) return { key: "not_bookable", label: "Not bookable" } as const;
  return { key: "live", label: "Bookable" } as const;
}

/** The first few amenity labels, in the catalogue's order, and how many more there are. */
export function amenitySummary(keys: string[], limit = 4) {
  const labels = ALL_AMENITIES.filter((a) => keys.includes(a.key)).map((a) => a.label);
  return { shown: labels.slice(0, limit), more: Math.max(0, labels.length - limit) };
}

/** Only known amenity keys, once each, in the catalogue's order. */
export function cleanAmenities(keys: unknown[]): AmenityKey[] {
  const wanted = new Set(keys.map(String));
  return ALL_AMENITIES.filter((a) => wanted.has(a.key)).map((a) => a.key);
}

export const PRICE_MIN = 1;
export const PRICE_MAX = 1000;

export function parsePrice(raw: unknown): { value: number } | { error: string } {
  const text = String(raw ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: "Enter a price like 12 or 12.50." };
  const value = Number(text);
  if (value < PRICE_MIN || value > PRICE_MAX) return { error: `The price must be between $${PRICE_MIN} and $${PRICE_MAX} an hour.` };
  return { value };
}

/** What members will see once this price is saved. */
export function pricePreview(price: number, room: Pick<AdminRoom, "price_per_hour" | "regular_price_per_hour">, setAsRegular: boolean) {
  const regular = setAsRegular ? price : room.regular_price_per_hour ?? room.price_per_hour;
  return { regular, drop: getPriceDropInfo(price, regular) };
}

export const formatPrice = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function checkImage(file: { type: string; size: number }) {
  if (!IMAGE_TYPES[file.type]) return "The photo must be a PNG, JPEG, WEBP or GIF.";
  if (file.size > MAX_IMAGE_BYTES) return "The photo must be smaller than 5MB.";
  return null;
}
