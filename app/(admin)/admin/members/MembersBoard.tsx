"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { AdminSearch, AdminSegmented, AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { initialsOf } from "@/lib/member-forms";
import {
  INDUCTION_LABELS,
  INDUCTION_TONES,
  MEMBER_FILTERS,
  matchesFilter,
  memberCounts,
  searchMembers,
  statusTone,
  type MemberFilter,
  type MemberRow,
} from "@/lib/admin-members";
import { getMemberDetails, type MemberDetailsResult } from "./actions";
import { MemberSheet } from "./MemberSheet";

export function MembersBoard({ members, loadDetails = getMemberDetails }: { members: MemberRow[]; loadDetails?: (id: string) => Promise<MemberDetailsResult> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = memberCounts(members);
  const rows = searchMembers(members.filter((m) => matchesFilter(m, filter)), query);
  const open = members.find((m) => m.id === openId) ?? null;
  // Suspended only earns a pill when someone is suspended.
  const filters = MEMBER_FILTERS.filter((f) => f.value !== "suspended" || counts.suspended > 0 || filter === "suspended");

  return (
    <>
      <section className="hub-surface admin-panel" aria-label="Members">
        <AdminToolbar>
          <AdminSearch label="Search members" value={query} onChange={setQuery} placeholder="Search name, email, company or mobile" />
          <AdminSegmented label="Filter members" value={filter} onChange={setFilter} options={filters.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))} />
        </AdminToolbar>
        <AdminDataTable
          caption="Members"
          rows={rows}
          rowKey={(row) => row.id}
          empty={
            <AdminEmpty icon={<Users size={18} />} title={query.trim() ? `No members match “${query.trim()}”` : "No members here"}>
              {query.trim() ? "Try a different name, email or company." : "Try another filter."}
            </AdminEmpty>
          }
          columns={[
            {
              key: "member",
              header: "Member",
              primary: true,
              cell: (row) => (
                <span className="admin-member-cell">
                  <span className="admin-initials" aria-hidden>{initialsOf(row.name)}</span>
                  <span>{row.name}<span className="admin-cell-sub">{row.email ?? "No email on file"}</span></span>
                </span>
              ),
            },
            { key: "company", header: "Company", cell: (row) => row.company ?? "—" },
            { key: "induction", header: "Induction", cell: (row) => <span className="hub-status-badge" data-status={INDUCTION_TONES[row.induction]}>{INDUCTION_LABELS[row.induction]}</span> },
            { key: "status", header: "Membership", cell: (row) => <span className="hub-status-badge" data-status={statusTone(row.status)}>{row.status}</span> },
            {
              key: "open",
              header: "",
              align: "end",
              cell: (row) => (
                <button type="button" className="hub-button hub-button-outline admin-member-open" onClick={() => setOpenId(row.id)} aria-label={`Open ${row.name}’s profile`}>
                  View profile
                </button>
              ),
            },
          ]}
        />
      </section>

      {open && <MemberSheet key={open.id} member={open} loadDetails={loadDetails} onClose={() => setOpenId(null)} />}
    </>
  );
}
