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

export const getRoomPrice = (capacity: number) => {
  if (capacity <= 4) return 25; // Dream Room
  if (capacity <= 5) return 45; // Elbow/Green
  return 80; // Boiler/Pool
};

export const PRICING = {
  SMALL_ROOM: 25, // AUD per hour
  MEDIUM_ROOM: 45,
  LARGE_ROOM: 80,
};

// Every room card shows this full list — rooms without a feature get a strikethrough
export const ALL_AMENITIES = [
  { key: "whiteboard",   label: "Whiteboard" },
  { key: "tv",           label: "TV Screen" },
  { key: "projector",    label: "Projector" },
  { key: "ac",           label: "Air Conditioning" },
  { key: "wifi",         label: "High-Speed WiFi" },
  { key: "video_conf",   label: "Video Conferencing" },
  { key: "conf_phone",   label: "Conference Phone" },
  { key: "catering",     label: "Catering Access" },
] as const;

// Update these to match the actual equipment in each room
export const ROOM_AMENITIES: Record<string, string[]> = {
  "Dream Room":  ["whiteboard", "tv", "ac", "wifi"],
  "Elbow Room":  ["whiteboard", "ac", "wifi", "conf_phone"],
  "Green Room":  ["whiteboard", "projector", "ac", "wifi"],
  "Boiler Room": ["whiteboard", "tv", "ac", "wifi", "video_conf", "conf_phone"],
  "Pool Room":   ["whiteboard", "tv", "projector", "ac", "wifi", "video_conf", "conf_phone", "catering"],
};
