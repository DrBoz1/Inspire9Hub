import { AlertTriangle, Bell, CalendarDays, Clock, Megaphone, Wrench, type LucideIcon } from "lucide-react";
import { getAnnouncementType } from "@/lib/announcement-types";
import { dateTile } from "@/lib/admin-dashboard";

const ICONS: Record<string, LucideIcon> = { general: Megaphone, event: CalendarDays, maintenance: Wrench, alert: AlertTriangle, hours: Clock, reminder: Bell };

export function TypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const Icon = ICONS[type] ?? Megaphone;
  return <Icon size={size} aria-hidden />;
}

/** The member dashboard's noticeboard markup, so admins see exactly what members will. */
export function NoticeboardItem({
  type,
  title,
  message,
  createdAt,
  placeholder = {},
}: {
  type: string;
  title: string;
  message: string;
  createdAt: string;
  placeholder?: { title?: boolean; message?: boolean };
}) {
  const { day, month } = dateTile(createdAt);
  return (
    <article className="hub-announcement">
      <div className="hub-announcement-meta">
        <span><TypeIcon type={type} size={13} />{getAnnouncementType(type).label}</span>
        <time dateTime={createdAt}>{day} {month}</time>
      </div>
      <h3 data-placeholder={placeholder.title || undefined}>{title}</h3>
      <p data-placeholder={placeholder.message || undefined}>{message}</p>
    </article>
  );
}
