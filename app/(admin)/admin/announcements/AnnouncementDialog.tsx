"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ANNOUNCEMENT_TYPES, getAnnouncementType } from "@/lib/announcement-types";
import {
  MESSAGE_MAX,
  TITLE_MAX,
  dateKeyLabel,
  endDateKey,
  endPresets,
  validateAnnouncement,
  type Announcement,
  type AnnouncementErrors,
  type AnnouncementField,
} from "@/lib/admin-announcements";
import type { AnnouncementSaveResult } from "./actions";
import { NoticeboardItem, TypeIcon } from "./Noticeboard";

function Counter({ value, max }: { value: string; max: number }) {
  return <small data-near={value.length > max * 0.9 || undefined} aria-hidden>{value.length}/{max}</small>;
}

export function AnnouncementDialog({
  announcement,
  today,
  save,
  onClose,
  onSaved,
}: {
  announcement: Announcement | null;
  today: string;
  save: (data: FormData) => Promise<AnnouncementSaveResult>;
  onClose: () => void;
  onSaved: (saved: Announcement) => void;
}) {
  const initialEnd = announcement?.expiresAt ? endDateKey(announcement.expiresAt) : "";
  const [values, setValues] = useState<Record<AnnouncementField, string>>({
    type: announcement?.type ?? "general",
    title: announcement?.title ?? "",
    message: announcement?.message ?? "",
    endsOn: initialEnd,
  });
  const [errors, setErrors] = useState<AnnouncementErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [draftDate] = useState(() => new Date().toISOString());
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const editing = announcement !== null;
  const changed =
    announcement === null ||
    values.type !== announcement.type ||
    values.title !== announcement.title ||
    values.message !== announcement.message ||
    values.endsOn !== initialEnd;

  const set = (field: AnnouncementField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const showErrors = (next: AnnouncementErrors) => {
    setErrors(next);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const checked = validateAnnouncement(values, today);
    if ("errors" in checked) return showErrors(checked.errors);

    const data = new FormData();
    if (announcement) data.set("id", announcement.id);
    for (const [field, value] of Object.entries(values)) data.set(field, value);

    startTransition(async () => {
      setError(null);
      try {
        const result = await save(data);
        if (result.fieldErrors) showErrors(result.fieldErrors);
        if (result.error || !result.saved) {
          setError(result.error ?? "Couldn’t save the announcement. Please try again.");
          return;
        }
        const saved = result.saved;
        onSaved(saved);
        toast.success(editing ? "Announcement updated" : "Announcement posted", {
          description:
            saved.status === "archived"
              ? "It’s archived, so members won’t see it until you restore it."
              : values.endsOn
                ? `On the member noticeboard until ${dateKeyLabel(values.endsOn)}.`
                : "It’s on the member noticeboard now.",
        });
        onClose();
      } catch {
        setError("Couldn’t reach the server. Please try again.");
      }
    });
  };

  const describedBy = (field: AnnouncementField) => (errors[field] ? `announce-${field}-error` : undefined);
  const title = values.title.trim();
  const message = values.message.trim();

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent className="hub-dialog admin-room-dialog admin-announce-dialog" overlayClassName="hub-booking-overlay">
        <DialogHeader className="admin-room-dialog-head">
          <p className="hub-eyebrow">Announcements</p>
          <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>
            {editing ? "Changes reach the member noticeboard as soon as you save." : "It goes up on every member’s dashboard as soon as you post it."}
          </DialogDescription>
        </DialogHeader>

        <form id="announce-form" ref={formRef} onSubmit={submit} className="admin-room-form admin-announce-form" noValidate>
          <div className="admin-announce-fields">
            <fieldset className="admin-type-picker">
              <legend className="admin-form-label">Category</legend>
              <div>
                {ANNOUNCEMENT_TYPES.map((t) => (
                  <label key={t.key} className="admin-typed" data-type={t.key} data-on={values.type === t.key || undefined}>
                    <input type="radio" name="announce-type" value={t.key} checked={values.type === t.key} onChange={() => set("type", t.key)} />
                    <TypeIcon type={t.key} size={14} />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
              <p className={errors.type ? "hub-field-error" : "admin-form-hint"}>{errors.type ?? `${getAnnouncementType(values.type).description}.`}</p>
            </fieldset>

            <div className="admin-announce-field">
              <label htmlFor="announce-title" className="admin-form-label">Title<Counter value={values.title} max={TITLE_MAX} /></label>
              <input
                id="announce-title"
                className="admin-text-input"
                value={values.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={TITLE_MAX}
                autoComplete="off"
                placeholder="e.g. Lift maintenance this Friday"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={describedBy("title")}
              />
              {errors.title && <p id="announce-title-error" className="hub-field-error"><AlertCircle size={12} aria-hidden />{errors.title}</p>}
            </div>

            <div className="admin-announce-field">
              <label htmlFor="announce-message" className="admin-form-label">Message<Counter value={values.message} max={MESSAGE_MAX} /></label>
              <textarea
                id="announce-message"
                className="admin-text-input"
                rows={5}
                value={values.message}
                onChange={(e) => set("message", e.target.value)}
                maxLength={MESSAGE_MAX}
                placeholder="What do members need to know?"
                aria-invalid={errors.message ? true : undefined}
                aria-describedby={describedBy("message")}
              />
              {errors.message && <p id="announce-message-error" className="hub-field-error"><AlertCircle size={12} aria-hidden />{errors.message}</p>}
            </div>

            <fieldset className="admin-announce-field">
              <legend className="admin-form-label">Take it down</legend>
              <div className="admin-end-presets">
                {endPresets(today).map((preset) => (
                  <button key={preset.label} type="button" aria-pressed={values.endsOn === preset.value} onClick={() => set("endsOn", preset.value)}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <label htmlFor="announce-endsOn" className="sr-only">End date</label>
              <input
                id="announce-endsOn"
                type="date"
                className="admin-text-input admin-date-input"
                min={today}
                value={values.endsOn}
                onChange={(e) => set("endsOn", e.target.value)}
                aria-invalid={errors.endsOn ? true : undefined}
                aria-describedby="announce-endsOn-hint"
              />
              <p id="announce-endsOn-hint" className={errors.endsOn ? "hub-field-error" : "admin-form-hint"} aria-live="polite">
                {errors.endsOn ? (
                  <><AlertCircle size={12} aria-hidden />{errors.endsOn}</>
                ) : values.endsOn ? (
                  `Comes down at 11:59 pm on ${dateKeyLabel(values.endsOn)}, Melbourne time.`
                ) : (
                  "Stays up until you archive it."
                )}
              </p>
            </fieldset>

            {error && <p className="hub-inline-error" role="alert">{error}</p>}
          </div>

          <aside className="admin-announce-preview" aria-label="Preview">
            <p className="admin-form-label">Preview</p>
            <div className="hub-surface admin-preview-card" aria-hidden>
              <div className="hub-feed-heading">
                <div><p className="hub-eyebrow">From the community</p><h2>The noticeboard</h2></div>
              </div>
              <div className="hub-announcements">
                <NoticeboardItem
                  type={values.type}
                  title={title || "Your title"}
                  message={message || "Your message shows here."}
                  createdAt={announcement?.createdAt ?? draftDate}
                  placeholder={{ title: !title, message: !message }}
                />
              </div>
            </div>
            <p className="admin-form-hint">How it looks on the member dashboard.</p>
          </aside>
        </form>

        <footer className="admin-room-dialog-foot">
          <span className="admin-form-hint" aria-live="polite">{editing ? (changed ? "Unsaved changes" : "No changes yet") : "Members see it straight away"}</span>
          <button type="button" className="hub-button hub-button-outline" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="announce-form" className="hub-button hub-button-primary" disabled={pending || !changed}>
            {pending ? <><Loader2 size={14} className="hub-spin" aria-hidden />{editing ? "Saving…" : "Posting…"}</> : editing ? "Save changes" : "Post announcement"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
