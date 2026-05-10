// Fixed announcement labels — admins pick from these, no free-text category input.
// Add new types here and they'll appear everywhere automatically.

export const ANNOUNCEMENT_TYPES = [
  {
    key: "general",
    label: "General",
    description: "General hub notice",
    iconName: "Megaphone",
    badge: "bg-blue-50 text-blue-700",
    border: "border-l-blue-500",
    dot: "bg-blue-500",
  },
  {
    key: "event",
    label: "Hub Event",
    description: "Upcoming event at the hub",
    iconName: "CalendarDays",
    badge: "bg-emerald-50 text-emerald-700",
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    description: "Planned maintenance or outage",
    iconName: "Wrench",
    badge: "bg-amber-50 text-amber-700",
    border: "border-l-amber-500",
    dot: "bg-amber-500",
  },
  {
    key: "alert",
    label: "Urgent Alert",
    description: "Time-sensitive or critical notice",
    iconName: "AlertTriangle",
    badge: "bg-red-50 text-red-700",
    border: "border-l-[#E31E24]",
    dot: "bg-[#E31E24]",
  },
  {
    key: "hours",
    label: "Hours Change",
    description: "Change to opening or access hours",
    iconName: "Clock",
    badge: "bg-violet-50 text-violet-700",
    border: "border-l-violet-500",
    dot: "bg-violet-500",
  },
  {
    key: "reminder",
    label: "Reminder",
    description: "Reminder for members",
    iconName: "Bell",
    badge: "bg-slate-100 text-slate-600",
    border: "border-l-slate-400",
    dot: "bg-slate-400",
  },
] as const;

export type AnnouncementTypeKey = (typeof ANNOUNCEMENT_TYPES)[number]["key"];

export function getAnnouncementType(key: string) {
  return (
    ANNOUNCEMENT_TYPES.find((t) => t.key === key) ?? ANNOUNCEMENT_TYPES[0]
  );
}
