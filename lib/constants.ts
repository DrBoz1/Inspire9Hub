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
