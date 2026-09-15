import Link from "next/link";
import { CheckCircle2, History } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSegmented } from "@/components/admin/AdminToolbar";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { HISTORY_PAGE_SIZE, complianceHref, type ComplianceData } from "@/lib/admin-compliance";
import { ReviewQueue } from "./ReviewQueue";

export function ComplianceView({ data }: { data: ComplianceData }) {
  return (
    <div className="hub-page admin-compliance">
      <AdminPageHeader
        eyebrow="Operations"
        title="Compliance"
        description="Check each induction before a member gets access, and keep a record of every decision."
      />

      <div className="admin-compliance-bar">
        <AdminSegmented
          label="Compliance views"
          value={data.view}
          options={[
            { value: "pending", label: "To review", count: data.pending.length, href: complianceHref("pending") },
            { value: "history", label: "History", href: complianceHref("history") },
          ]}
        />
        {data.view === "history" && (
          <AdminSegmented
            label="Filter by outcome"
            value={data.outcome?.toLowerCase() ?? "all"}
            options={[
              { value: "all", label: "All", href: complianceHref("history") },
              { value: "approved", label: "Approved", href: complianceHref("history", { outcome: "Approved" }) },
              { value: "rejected", label: "Rejected", href: complianceHref("history", { outcome: "Rejected" }) },
            ]}
          />
        )}
      </div>

      {data.view === "pending" ? (
        data.pending.length > 0 ? (
          <ReviewQueue items={data.pending} todayKey={data.todayKey} />
        ) : (
          <section className="hub-surface" aria-label="Inductions waiting for review">
            <AdminEmpty
              icon={<CheckCircle2 size={18} />}
              title="All caught up"
              action={<Link href={complianceHref("history")} className="hub-button hub-button-outline">See past decisions</Link>}
            >
              No inductions are waiting. New submissions appear here as soon as members send them.
            </AdminEmpty>
          </section>
        )
      ) : (
        <HistoryPanel data={data} />
      )}
    </div>
  );
}

function HistoryPanel({ data }: { data: ComplianceData }) {
  const pastTheEnd = data.page > 1 && data.history.length === 0;
  return (
    <section className="hub-surface admin-panel" aria-label="Induction decisions">
      <AdminDataTable
        caption="Induction decisions, newest first"
        rows={data.history}
        rowKey={(row) => row.id}
        empty={
          <AdminEmpty
            icon={<History size={18} />}
            title={pastTheEnd ? "Nothing on this page" : "No decisions yet"}
            action={pastTheEnd ? <Link href={complianceHref("history", { outcome: data.outcome })} className="hub-button hub-button-outline">Back to the first page</Link> : undefined}
          >
            {pastTheEnd ? "There aren’t that many decisions yet." : data.outcome ? `No ${data.outcome.toLowerCase()} inductions yet.` : "Approvals and rejections will be listed here."}
          </AdminEmpty>
        }
        columns={[
          { key: "member", header: "Member", primary: true, cell: (row) => <>{row.name}{row.email && <span className="admin-cell-sub">{row.email}</span>}</> },
          { key: "outcome", header: "Outcome", cell: (row) => <span className="hub-status-badge" data-status={row.outcome.toLowerCase()}>{row.outcome}</span> },
          { key: "company", header: "Company", cell: (row) => row.company ?? "—" },
          { key: "note", header: "Emergency details", hideOnMobile: true, cell: (row) => row.note ? <span className="admin-clamp">{row.note}</span> : <span className="admin-cell-sub">None given</span> },
          { key: "date", header: "Decided", align: "end", cell: (row) => row.date ?? "—" },
        ]}
      />
      {data.historyCount > HISTORY_PAGE_SIZE && (
        <AdminPagination
          page={data.page}
          totalPages={data.totalPages}
          label={`${data.historyCount} decisions`}
          hrefFor={(page) => complianceHref("history", { page, outcome: data.outcome })}
        />
      )}
    </section>
  );
}
