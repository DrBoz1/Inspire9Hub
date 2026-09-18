"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HEARD_VIA, INTERESTS, SOURCES, validateLead, type Lead, type LeadErrors, type LeadField } from "@/lib/admin-leads";
import type { AddLeadResult } from "./actions";

const FIELDS: LeadField[] = ["name", "email", "phone", "company", "interest", "teamSize", "heardVia", "source", "nextFollowUp", "message"];
/** Staff log walk-ins and calls; the website fills in its own. */
const STAFF_SOURCES = Object.entries(SOURCES).filter(([key]) => key !== "website" && key !== "support_form");

export function AddLeadDialog({ today, save, onClose, onSaved }: { today: string; save: (data: FormData) => Promise<AddLeadResult>; onClose: () => void; onSaved: (lead: Lead) => void }) {
  const [values, setValues] = useState<Record<LeadField, string>>(() => Object.fromEntries(FIELDS.map((f) => [f, f === "source" ? "walk_in" : f === "interest" ? "hot_desk" : ""])) as Record<LeadField, string>);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const set = (field: LeadField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const showErrors = (next: LeadErrors) => {
    setErrors(next);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // The same rules the server applies, so mistakes show before the round trip.
    const checked = validateLead(values, { staff: true, today });
    if ("errors" in checked) return showErrors(checked.errors);
    const data = new FormData();
    for (const [field, value] of Object.entries(values)) data.set(field, value);
    startTransition(async () => {
      setError(null);
      try {
        const result = await save(data);
        if (result.fieldErrors) showErrors(result.fieldErrors);
        if (result.error || !result.saved) return setError(result.error ?? "Couldn’t add the lead. Please try again.");
        onSaved(result.saved);
        toast.success("Lead added", { description: `${result.saved.name} is on the board, with you looking after them.` });
        onClose();
      } catch {
        setError("Couldn’t reach the server. Please try again.");
      }
    });
  };

  const field = (id: LeadField) => ({
    id: `lead-${id}`,
    value: values[id],
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": errors[id] ? `lead-${id}-error` : undefined,
  });
  const problem = (id: LeadField) => errors[id] && <p id={`lead-${id}-error`} className="hub-field-error"><AlertCircle size={12} aria-hidden />{errors[id]}</p>;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent className="hub-dialog admin-room-dialog admin-lead-dialog" overlayClassName="hub-booking-overlay">
        <DialogHeader className="admin-room-dialog-head">
          <p className="hub-eyebrow">Leads</p>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>Someone who walked in, rang or was referred. Website enquiries arrive on their own.</DialogDescription>
        </DialogHeader>

        <form id="lead-form" ref={formRef} onSubmit={submit} className="admin-room-form admin-lead-form" noValidate>
          <div className="admin-lead-grid">
            <div className="admin-announce-field">
              <label htmlFor="lead-name" className="admin-form-label">Name</label>
              <input {...field("name")} className="admin-text-input" autoComplete="off" maxLength={120} onChange={(e) => set("name", e.target.value)} />
              {problem("name")}
            </div>
            <div className="admin-announce-field">
              <label htmlFor="lead-email" className="admin-form-label">Email</label>
              <input {...field("email")} type="email" className="admin-text-input" autoComplete="off" maxLength={254} onChange={(e) => set("email", e.target.value)} />
              {problem("email")}
            </div>
            <div className="admin-announce-field">
              <label htmlFor="lead-phone" className="admin-form-label">Phone <small>optional</small></label>
              <input {...field("phone")} type="tel" className="admin-text-input" autoComplete="off" maxLength={30} onChange={(e) => set("phone", e.target.value)} />
              {problem("phone")}
            </div>
            <div className="admin-announce-field">
              <label htmlFor="lead-company" className="admin-form-label">Company <small>optional</small></label>
              <input {...field("company")} className="admin-text-input" autoComplete="off" maxLength={120} onChange={(e) => set("company", e.target.value)} />
              {problem("company")}
            </div>
            <div className="admin-announce-field">
              <label htmlFor="lead-source" className="admin-form-label">Came in through</label>
              <select {...field("source")} className="admin-text-input" onChange={(e) => set("source", e.target.value)}>
                {STAFF_SOURCES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              {problem("source")}
            </div>
            <div className="admin-announce-field">
              <label htmlFor="lead-interest" className="admin-form-label">Looking for</label>
              <select {...field("interest")} className="admin-text-input" onChange={(e) => set("interest", e.target.value)}>
                {Object.entries(INTERESTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              {problem("interest")}
            </div>
            <div className="admin-announce-field">
              <label htmlFor="lead-teamSize" className="admin-form-label">Team size <small>optional</small></label>
              <input {...field("teamSize")} type="number" inputMode="numeric" min={1} max={500} className="admin-text-input" onChange={(e) => set("teamSize", e.target.value)} />
              {problem("teamSize")}
            </div>
            <div className="admin-announce-field">
              <label htmlFor="lead-heardVia" className="admin-form-label">Heard about us <small>optional</small></label>
              <select {...field("heardVia")} className="admin-text-input" onChange={(e) => set("heardVia", e.target.value)}>
                <option value="">Didn’t say</option>
                {Object.entries(HEARD_VIA).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              {problem("heardVia")}
            </div>
            <div className="admin-announce-field">
              <label htmlFor="lead-nextFollowUp" className="admin-form-label">Follow up on <small>optional</small></label>
              <input {...field("nextFollowUp")} type="date" min={today} className="admin-text-input admin-date-input" onChange={(e) => set("nextFollowUp", e.target.value)} />
              {problem("nextFollowUp")}
            </div>
          </div>
          <div className="admin-announce-field">
            <label htmlFor="lead-message" className="admin-form-label">What they’re after <small>optional</small></label>
            <textarea {...field("message")} className="admin-text-input" rows={4} maxLength={2000} onChange={(e) => set("message", e.target.value)} />
            {problem("message")}
          </div>
          {error && <p className="hub-inline-error" role="alert"><AlertCircle size={14} aria-hidden />{error}</p>}
        </form>

        <footer className="admin-room-dialog-foot">
          <span className="admin-form-hint">You’ll be down as looking after them.</span>
          <button type="button" className="hub-button hub-button-outline" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="lead-form" className="hub-button hub-button-primary" disabled={pending}>
            {pending ? <><Loader2 size={14} className="hub-spin" aria-hidden />Adding…</> : "Add lead"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
