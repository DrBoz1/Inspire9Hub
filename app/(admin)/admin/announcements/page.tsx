import type { Metadata } from "next";
import { hubDateKey } from "@/lib/admin-dashboard";
import { AnnouncementsBoard } from "./AnnouncementsBoard";
import { loadAnnouncements } from "./announcements-data";

export const metadata: Metadata = { title: "Announcements | Inspire9 Hub" };

export default async function AdminAnnouncementsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [announcements, params] = await Promise.all([loadAnnouncements(), searchParams]);
  const now = new Date();

  return (
    <div className="hub-page admin-announcements-page">
      <AnnouncementsBoard initial={announcements} now={now.toISOString()} today={hubDateKey(now)} compose={params.new === "1"} />
    </div>
  );
}
