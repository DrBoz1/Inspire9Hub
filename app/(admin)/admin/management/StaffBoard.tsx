"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserCog, UserMinus, UserPlus, Users, UserX } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSearch, AdminSegmented, AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { AdminConfirm } from "@/components/admin/AdminConfirm";
import { initialsOf } from "@/lib/member-forms";
import type { AdminRole } from "@/lib/admin-guard";
import {
  ROLE_INFO,
  STAFF_FILTERS,
  removeBlocker,
  roleChangeBlocker,
  searchStaff,
  sortStaff,
  staffCounts,
  type StaffCandidate,
  type StaffFilter,
  type StaffMember,
} from "@/lib/admin-staff";
import { addStaff, changeStaffRole, removeStaff, removeStaleStaff, type StaffResult } from "./actions";
import { AddStaffDialog } from "./AddStaffDialog";

export type StaffActions = {
  add: (memberId: string, role: AdminRole) => Promise<StaffResult>;
  changeRole: (adminId: string, role: AdminRole) => Promise<StaffResult>;
  remove: (adminId: string) => Promise<{ error?: string }>;
  removeStale: (ids: string[]) => Promise<{ error?: string; removed?: number }>;
};

const SERVER_ACTIONS: StaffActions = { add: addStaff, changeRole: changeStaffRole, remove: removeStaff, removeStale: removeStaleStaff };
const OFFLINE = "Couldn’t reach the server. Please try again.";
const ROLES: AdminRole[] = ["admin", "super_admin"];

function RowActions({
  person,
  staff,
  currentId,
  actions,
  onSaved,
  onRemoved,
}: {
  person: StaffMember;
  staff: StaffMember[];
  currentId: string | null;
  actions: StaffActions;
  onSaved: (saved: StaffMember) => void;
  onRemoved: (id: string) => void;
}) {
  if (person.id === currentId) return <span className="admin-form-hint">That’s you</span>;

  const first = person.name.split(" ")[0];
  const next: AdminRole = person.role === "super_admin" ? "admin" : "super_admin";
  const promoting = next === "super_admin";

  const changeRole = async () => {
    const blocked = roleChangeBlocker(person, next, staff, currentId);
    if (blocked) return { error: blocked };
    try {
      const result = await actions.changeRole(person.id, next);
      if (result.error || !result.saved) return { error: result.error ?? "Couldn’t change their access. Please try again." };
      onSaved(result.saved);
      toast.success(`${person.name} is now ${promoting ? "a super admin" : "an admin"}`);
    } catch {
      return { error: OFFLINE };
    }
  };

  const remove = async () => {
    const blocked = removeBlocker(person, staff, currentId);
    if (blocked) return { error: blocked };
    try {
      const result = await actions.remove(person.id);
      if (result.error) return { error: result.error };
      onRemoved(person.id);
      toast.success(`${person.name} no longer has admin access`);
    } catch {
      return { error: OFFLINE };
    }
  };

  return (
    <span className="admin-row-actions">
      <AdminConfirm
        trigger={
          <button type="button" className="hub-button hub-button-outline" aria-label={`${promoting ? "Make super admin" : "Make admin"}: ${person.name}`}>
            {promoting ? <ShieldCheck size={13} aria-hidden /> : <UserCog size={13} aria-hidden />}
            {promoting ? "Make super admin" : "Make admin"}
          </button>
        }
        title={promoting ? `Make ${first} a super admin?` : `Make ${first} an admin?`}
        description={
          promoting
            ? `${person.name} will be able to add and remove staff, including you.`
            : `${person.name} keeps running the hub day to day, but won’t be able to manage staff any more.`
        }
        confirmLabel={promoting ? "Make super admin" : "Make admin"}
        pendingLabel="Saving…"
        onConfirm={changeRole}
      />
      <AdminConfirm
        trigger={
          <button type="button" className="hub-button hub-button-outline admin-danger-button" aria-label={`Remove: ${person.name}`}>
            <UserMinus size={13} aria-hidden />Remove
          </button>
        }
        title={`Remove ${first}’s admin access?`}
        description={`${person.name} won’t be able to use the admin portal any more. If they have a member account, it stays as it is.`}
        confirmLabel="Remove access"
        pendingLabel="Removing…"
        onConfirm={remove}
      />
    </span>
  );
}

export function StaffBoard({
  initialStaff,
  candidates: initialCandidates,
  currentId,
  actions = SERVER_ACTIONS,
}: {
  initialStaff: StaffMember[];
  candidates: StaffCandidate[];
  currentId: string | null;
  actions?: StaffActions;
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StaffFilter>("all");
  const [adding, setAdding] = useState(false);

  // Rows whose login was deleted can't sign in, so they aren't staff. They get their own clean-up card.
  const active = staff.filter((s) => s.hasLogin);
  const stale = staff.filter((s) => !s.hasLogin);
  const counts = staffCounts(active);
  const rows = searchStaff(active.filter((s) => filter === "all" || s.role === filter), query);

  const upsert = (saved: StaffMember) => setStaff((list) => sortStaff([saved, ...list.filter((s) => s.id !== saved.id)]));
  const drop = (ids: string[]) => setStaff((list) => list.filter((s) => !ids.includes(s.id)));

  const cleanUp = async () => {
    try {
      const result = await actions.removeStale(stale.map((s) => s.id));
      if (result.error) return { error: result.error };
      drop(stale.map((s) => s.id));
      toast.success(`Removed ${result.removed ?? stale.length} leftover record${(result.removed ?? stale.length) === 1 ? "" : "s"}`);
    } catch {
      return { error: OFFLINE };
    }
  };

  const supers = counts.super_admin;
  const lede = `${active.length} ${active.length === 1 ? "person has" : "people have"} access to the admin portal. ${supers} ${supers === 1 ? "is a super admin" : "are super admins"}, who can manage staff.`;
  const query_ = query.trim();

  return (
    <>
      <AdminPageHeader
        eyebrow="Team"
        title="Staff management"
        description={lede}
        actions={
          <button type="button" className="hub-button hub-button-primary admin-announce-new" onClick={() => setAdding(true)}>
            <UserPlus size={15} aria-hidden />Add staff
          </button>
        }
      />

      <ul className="admin-role-guide" aria-label="Access levels">
        {ROLES.map((r) => (
          <li key={r} className="hub-surface" data-role={r}>
            <span className="admin-role-icon" aria-hidden>{r === "super_admin" ? <ShieldCheck size={15} /> : <UserCog size={15} />}</span>
            <span className="admin-role-text">
              <strong>{ROLE_INFO[r].label}<small>{counts[r]}</small></strong>
              <span>{ROLE_INFO[r].summary}</span>
            </span>
          </li>
        ))}
      </ul>

      {stale.length > 0 && (
        <section className="hub-surface admin-stale" aria-labelledby="stale-title">
          <span className="admin-stale-icon" aria-hidden><UserX size={16} /></span>
          <div>
            <h2 id="stale-title">{stale.length} leftover admin record{stale.length === 1 ? "" : "s"}</h2>
            <p>Their login was deleted in Supabase, so they can’t sign in. They’re left out of the list below.</p>
            <ul>
              {stale.map((s) => <li key={s.id}>{s.name}<span> · {s.email ?? "no email"}</span></li>)}
            </ul>
          </div>
          <AdminConfirm
            trigger={<button type="button" className="hub-button hub-button-outline">Clean up</button>}
            title={`Remove ${stale.length === 1 ? "this leftover record" : `these ${stale.length} leftover records`}?`}
            description="Each one is checked with Supabase first, so only records without a login are removed."
            confirmLabel="Remove"
            pendingLabel="Removing…"
            onConfirm={cleanUp}
          />
        </section>
      )}

      <section className="hub-surface admin-panel" aria-label="Staff">
        <AdminToolbar>
          <AdminSearch label="Search staff" value={query} onChange={setQuery} placeholder="Search name or email" />
          <AdminSegmented label="Filter staff" value={filter} onChange={setFilter} options={STAFF_FILTERS.map((f) => ({ ...f, count: counts[f.value] }))} />
        </AdminToolbar>
        <AdminDataTable
          caption="Staff"
          rows={rows}
          rowKey={(s) => s.id}
          empty={
            <AdminEmpty icon={<Users size={18} />} title={query_ ? `No staff match “${query_}”` : "Nobody here"}>
              {query_ ? "Try a different name or email." : "Try another filter."}
            </AdminEmpty>
          }
          columns={[
            {
              key: "person",
              header: "Person",
              primary: true,
              cell: (s) => (
                <span className="admin-member-cell">
                  <span className="admin-initials" aria-hidden>{initialsOf(s.name)}</span>
                  <span>
                    {s.name}
                    {s.id === currentId && <span className="admin-you">You</span>}
                    <span className="admin-cell-sub">{s.email ?? "No email on file"}</span>
                  </span>
                </span>
              ),
            },
            {
              key: "access",
              header: "Access",
              cell: (s) => (
                <span className="admin-role-badge" data-role={s.role}>
                  {s.role === "super_admin" && <ShieldCheck size={11} aria-hidden />}
                  {ROLE_INFO[s.role].label}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              align: "end",
              cell: (s) => (
                <RowActions person={s} staff={staff} currentId={currentId} actions={actions} onSaved={upsert} onRemoved={(id) => drop([id])} />
              ),
            },
          ]}
        />
      </section>

      {adding && (
        <AddStaffDialog
          candidates={candidates}
          add={actions.add}
          onClose={() => setAdding(false)}
          onAdded={(saved) => {
            upsert(saved);
            setCandidates((list) => list.filter((c) => c.id !== saved.id));
          }}
        />
      )}
    </>
  );
}
