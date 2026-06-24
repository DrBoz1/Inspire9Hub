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
  { key: "whiteboard", label: "Whiteboard" },
  { key: "tv", label: "TV Screen" },
  { key: "projector", label: "Projector" },
  { key: "ac", label: "Air Conditioning" },
  { key: "wifi", label: "High-Speed WiFi" },
  { key: "video_conf", label: "Video Conferencing" },
  { key: "conf_phone", label: "Conference Phone" },
  { key: "catering", label: "Catering Access" },
] as const;
