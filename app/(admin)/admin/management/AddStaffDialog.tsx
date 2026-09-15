"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Search, ShieldCheck, UserCog } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { initialsOf } from "@/lib/member-forms";
import type { AdminRole } from "@/lib/admin-guard";
import { ROLE_INFO, searchCandidates, type StaffCandidate, type StaffMember } from "@/lib/admin-staff";
import type { StaffResult } from "./actions";

const ROLES: AdminRole[] = ["admin", "super_admin"];

export function AddStaffDialog({
  candidates,
  add,
  onClose,
  onAdded,
}: {
  candidates: StaffCandidate[];
  add: (memberId: string, role: AdminRole) => Promise<StaffResult>;
  onClose: () => void;
  onAdded: (saved: StaffMember) => void;
}) {
  const [query, setQuery] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole>("admin");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = searchCandidates(candidates, query);
  const selected = candidates.find((c) => c.id === memberId) ?? null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return setError("Choose who to add.");
    startTransition(async () => {
      setError(null);
      try {
        const result = await add(selected.id, role);
        if (result.error || !result.saved) {
          setError(result.error ?? "Couldn’t add them. Please try again.");
          return;
        }
        onAdded(result.saved);
        toast.success(`${result.saved.name} is now ${role === "super_admin" ? "a super admin" : "an admin"}`, {
          description: "They can sign in to the admin portal straight away.",
        });
        onClose();
      } catch {
        setError("Couldn’t reach the server. Please try again.");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent className="hub-dialog admin-room-dialog admin-staff-dialog" overlayClassName="hub-booking-overlay">
        <DialogHeader className="admin-room-dialog-head">
          <p className="hub-eyebrow">Staff management</p>
          <DialogTitle>Add staff</DialogTitle>
          <DialogDescription>Give someone with a hub account access to the admin portal.</DialogDescription>
        </DialogHeader>

        <form id="staff-form" onSubmit={submit} className="admin-room-form" noValidate>
          <fieldset className="admin-announce-field admin-person-picker">
            <legend className="admin-form-label">Person <small>{candidates.length} with a hub account</small></legend>
            {candidates.length > 0 ? (
              <>
                <label className="hub-search admin-search">
                  <Search size={15} aria-hidden />
                  <span className="sr-only">Search people</span>
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or company" />
                </label>
                <div className="admin-person-list">
                  {matches.length ? (
                    matches.map((c) => {
                      const on = memberId === c.id;
                      return (
                        <label key={c.id} data-on={on || undefined}>
                          <input type="radio" name="staff-member" value={c.id} checked={on} onChange={() => { setMemberId(c.id); setError(null); }} />
                          <span className="admin-initials" aria-hidden>{initialsOf(c.name)}</span>
                          <span className="admin-person-text">
                            <strong>{c.name}</strong>
                            <span>{[c.email, c.company].filter(Boolean).join(" · ") || "No email on file"}</span>
                          </span>
                          <span className="admin-person-check" aria-hidden>{on && <Check size={11} strokeWidth={3} />}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="admin-member-empty">No one matches “{query.trim()}”.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="admin-form-hint">Everyone with a hub account already has access. Ask the new staff member to sign up for a hub account, then add them here.</p>
            )}
          </fieldset>

          <fieldset className="admin-announce-field admin-role-picker">
            <legend className="admin-form-label">Access</legend>
            <div>
              {ROLES.map((r) => (
                <label key={r} data-role={r} data-on={role === r || undefined}>
                  <input type="radio" name="staff-role" value={r} checked={role === r} onChange={() => setRole(r)} />
                  <span className="admin-role-icon" aria-hidden>{r === "super_admin" ? <ShieldCheck size={15} /> : <UserCog size={15} />}</span>
                  <span className="admin-role-text">
                    <strong>{ROLE_INFO[r].label}</strong>
                    <span>{ROLE_INFO[r].summary}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="hub-inline-error" role="alert">{error}</p>}
        </form>

        <footer className="admin-room-dialog-foot">
          <span className="admin-form-hint" aria-live="polite">{selected ? `Adding ${selected.name}` : "Nobody chosen yet"}</span>
          <button type="button" className="hub-button hub-button-outline" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="staff-form" className="hub-button hub-button-primary" disabled={pending || !selected}>
            {pending ? <><Loader2 size={14} className="hub-spin" aria-hidden />Adding…</> : "Give access"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
