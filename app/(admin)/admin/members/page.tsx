import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MembersBoard } from "./MembersBoard";
import { ReviewReminders } from "./ReviewReminders";
import { loadMembers } from "./members-data";

export const metadata: Metadata = { title: "Members | Inspire9 Hub" };

export default async function AllMembersPage() {
  const members = await loadMembers();
  const active = members.filter((m) => m.status === "Active").length;

  return (
    <div className="hub-page admin-members-page">
      <AdminPageHeader
        eyebrow="Community"
        title="Members"
        description={`${members.length} member account${members.length === 1 ? "" : "s"}, ${active} active. Open anyone to see their bookings, payments and induction.`}
        actions={<ReviewReminders />}
      />
      <MembersBoard members={members} />
    </div>
  );
}
