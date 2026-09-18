"use client";

import { useMemo, useState } from "react";
import { CircleCheckBig, Clock3, Inbox, MailQuestion, Plus, UserPlus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStat, AdminStats } from "@/components/admin/AdminStat";
import { AdminSearch, AdminSegmented, AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { initialsOf } from "@/lib/member-forms";
import {
  INTERESTS,
  LEAD_FILTERS,
  SOURCES,
  STAGE_LABELS,
  STAGE_TONES,
  boardStats,
  filterCounts,
  followUpState,
  isStale,
  matchesFilter,
  searchLeads,
  sortForBoard,
  whenLabel,
  type Lead,
  type LeadFilter,
} from "@/lib/admin-leads";
import { addLead, addLeadNote, convertLead, getLeadTimeline, moveLeadStage, updateLeadDetails, type AddLeadResult } from "./actions";
import { AddLeadDialog } from "./AddLeadDialog";
import { FOLLOW_LABELS, LeadSheet, type LeadActions } from "./LeadSheet";
import type { StaffOption } from "./leads-data";

const SERVER_ACTIONS: LeadActions & { add: (data: FormData) => Promise<AddLeadResult> } = {
  add: addLead,
  timeline: getLeadTimeline,
  move: moveLeadStage,
  note: addLeadNote,
  details: updateLeadDetails,
  convert: convertLead,
};

const percent = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

export function LeadsBoard({
  initialLeads,
  staff,
  today,
  nowIso,
  openLeadId,
  tableMissing,
  actions = SERVER_ACTIONS,
}: {
  initialLeads: Lead[];
  staff: StaffOption[];
  today: string;
  nowIso: string;
  openLeadId: string | null;
  tableMissing: boolean;
  actions?: typeof SERVER_ACTIONS;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LeadFilter>("open");
  // Arriving from a "new enquiry" email opens that lead straight away.
  const [openId, setOpenId] = useState<string | null>(() => (openLeadId && initialLeads.some((l) => l.id === openLeadId) ? openLeadId : null));
  const [adding, setAdding] = useState(false);

  const stats = boardStats(leads, now);
  const counts = filterCounts(leads);
  const rows = sortForBoard(searchLeads(leads, query).filter((l) => matchesFilter(l, filter)), now);
  const open = leads.find((l) => l.id === openId) ?? null;
  const ownerOf = (id: string | null) => staff.find((s) => s.id === id)?.name ?? null;

  const save = (saved: Lead) => setLeads((list) => (list.some((l) => l.id === saved.id) ? list.map((l) => (l.id === saved.id ? saved : l)) : [saved, ...list]));
  const close = () => {
    setOpenId(null);
    // Tidy the link it was opened from, so a refresh doesn't reopen it.
    if (window.location.search.includes("lead=")) window.history.replaceState(null, "", window.location.pathname);
  };

  return (
    <div className="hub-page admin-leads-page">
      <AdminPageHeader
        eyebrow="Community"
        title="Leads"
        description="People who might become members. Enquiries from the website arrive here on their own; add walk-ins and calls yourself."
        actions={
          !tableMissing && (
            <button type="button" className="hub-button hub-button-primary" onClick={() => setAdding(true)}>
              Add lead
              <Plus size={15} aria-hidden />
            </button>
          )
        }
      />

      {tableMissing ? (
        <section className="hub-surface admin-panel">
          <AdminEmpty icon={<Inbox size={18} />} title="Leads aren’t set up yet">
            Run supabase/migrations/add_leads.sql in the Supabase SQL Editor, then refresh this page. Until then, website enquiries still reach the team by email.
          </AdminEmpty>
        </section>
      ) : (
        <>
          <AdminStats label="The pipeline at a glance">
            <AdminStat label="Open leads" value={stats.open} icon={<UserPlus size={16} />} tone="red" hint={stats.open ? `${stats.stale} gone quiet for a week` : "Nothing in the pipeline"} />
            <AdminStat label="Waiting for a reply" value={stats.untouched} icon={<MailQuestion size={16} />} tone={stats.untouched ? "amber" : "neutral"} hint={stats.untouched ? "New, not contacted yet" : "Everyone’s had a reply"} />
            <AdminStat label="Follow-ups due" value={stats.due} icon={<Clock3 size={16} />} tone={stats.due ? "amber" : "neutral"} hint="Today or overdue" />
            <AdminStat label="Win rate" value={percent(stats.winRate)} icon={<CircleCheckBig size={16} />} tone="green" hint={`${stats.won} won of every lead that’s closed`} />
          </AdminStats>

          <section className="hub-surface admin-panel admin-leads-list" aria-label="Leads">
            <AdminToolbar>
              <AdminSearch label="Search leads" value={query} onChange={setQuery} placeholder="Name, email, company or phone" />
              <div className="admin-toolbar-end">
                <AdminSegmented label="Show" value={filter} onChange={setFilter} options={LEAD_FILTERS.map((f) => ({ ...f, count: counts[f.value] }))} />
              </div>
            </AdminToolbar>
            <AdminDataTable<Lead>
              caption="Leads, most urgent first"
              rows={rows}
              rowKey={(l) => l.id}
              empty={
                leads.length === 0 ? (
                  <AdminEmpty icon={<Inbox size={18} />} title="No leads yet" action={<a className="hub-button hub-button-outline" href="/enquire" target="_blank" rel="noreferrer">See the enquiry form</a>}>
                    When someone fills in the enquiry form, they appear here and the team gets an email.
                  </AdminEmpty>
                ) : (
                  <AdminEmpty icon={<Inbox size={18} />} title="Nothing matches">Try another filter, or clear the search.</AdminEmpty>
                )
              }
              columns={[
                {
                  key: "lead",
                  header: "Lead",
                  primary: true,
                  cell: (l) => (
                    <span className="admin-member-cell">
                      <span className="admin-initials" aria-hidden>{initialsOf(l.name)}</span>
                      <span>{l.name}<span className="admin-cell-sub">{l.company ?? l.email}</span></span>
                    </span>
                  ),
                },
                { key: "interest", header: "Looking for", cell: (l) => <>{INTERESTS[l.interest]}{l.teamSize && <span className="admin-cell-sub">Team of {l.teamSize}</span>}</> },
                { key: "stage", header: "Stage", cell: (l) => <span className="hub-status-badge" data-status={STAGE_TONES[l.stage]}>{STAGE_LABELS[l.stage]}</span> },
                {
                  key: "next",
                  header: "Next",
                  cell: (l) => {
                    const state = followUpState(l, now);
                    if (FOLLOW_LABELS[state]) return <span className="admin-follow" data-state={state}>{FOLLOW_LABELS[state]}</span>;
                    if (isStale(l, now)) return <span className="admin-follow" data-state="quiet">Gone quiet</span>;
                    return <span className="admin-cell-sub">{l.stage === "new" ? "Reply to them" : "—"}</span>;
                  },
                },
                { key: "came", header: "Came in", hideOnMobile: true, cell: (l) => <>{whenLabel(l.createdAt, now)}<span className="admin-cell-sub">{SOURCES[l.source]}</span></> },
                { key: "owner", header: "With", hideOnMobile: true, cell: (l) => ownerOf(l.ownerId) ?? <span className="admin-cell-sub">Nobody yet</span> },
                {
                  key: "open",
                  header: "",
                  align: "end",
                  cell: (l) => (
                    <button type="button" className="hub-button hub-button-outline admin-member-open" onClick={() => setOpenId(l.id)} aria-label={`Open ${l.name}`}>
                      Open
                    </button>
                  ),
                },
              ]}
            />
          </section>
        </>
      )}

      {open && <LeadSheet key={open.id} lead={open} staff={staff} today={today} now={now} actions={actions} onSaved={save} onClose={close} />}
      {adding && <AddLeadDialog today={today} save={actions.add} onClose={() => setAdding(false)} onSaved={(lead) => { save(lead); setOpenId(lead.id); }} />}
    </div>
  );
}
