export const INDUCTION_STATUS = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  COMPLETE: "Complete",
};

export const MEMBER_STATUS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
};

export const ROOMS = [
  { id: "dream-room", name: "Dream Room", capacity: 4, location: "Level 1" },
  { id: "elbow-room", name: "Elbow Room", capacity: 5, location: "Level 1" },
  { id: "green-room", name: "Green Room", capacity: 5, location: "Level 2" },
  {
    id: "boiler-room",
    name: "Boiler Room",
    capacity: 10,
    location: "Basement",
  },
  { id: "pool-room", name: "Pool Room", capacity: 20, location: "Level 3" },
];

export const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};

// Fallback used only if a workspace row is somehow missing an image_url.
export const DEFAULT_ROOM_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80";

// Fixed catalog of amenity types the system knows about — admins pick a
// subset of these per room. Pricing, image, and the per-room subset all
// live on the `workspaces` row now (price_per_hour, image_url, amenities).
export const ALL_AMENITIES = [
  // Original eight. These are the values already stored on every workspaces row,
  // so their keys must never change -- the database holds them as plain text.
  { key: "whiteboard", label: "Whiteboard" },
  { key: "tv", label: "TV Screen" },
  { key: "projector", label: "Projector" },
  { key: "ac", label: "Air Conditioning" },
  { key: "wifi", label: "High-Speed WiFi" },
  { key: "video_conf", label: "Video Conferencing" },
  { key: "conf_phone", label: "Conference Phone" },
  { key: "catering", label: "Catering Access" },

  // Added when the floor-plan map was folded in. The map described spaces with a
  // second, overlapping vocabulary ('hvac' for ac, 'display' for tv, and so on);
  // these six are the concepts it had that the hub genuinely lacked. Everything
  // else it used now maps onto a key above -- see lib/amenities.ts.
  { key: "power", label: "Power & Data" },
  { key: "monitor", label: "Monitor" },
  { key: "daylight", label: "Natural Light" },
  { key: "quiet", label: "Acoustically Treated" },
  { key: "standing", label: "Standing Height" },
  { key: "accessible", label: "Step-Free Access" },
] as const;

/** The canonical amenity key. One vocabulary, used by the database, the booking
 *  pages, the assistant and the floor-plan map alike. */
export type AmenityKey = (typeof ALL_AMENITIES)[number]["key"];

export const AMENITY_LABELS: Record<AmenityKey, string> = Object.fromEntries(
  ALL_AMENITIES.map((a) => [a.key, a.label]),
) as Record<AmenityKey, string>;
