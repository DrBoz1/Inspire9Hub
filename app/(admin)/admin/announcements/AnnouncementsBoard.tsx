"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, Loader2, Megaphone, PenLine, Plus, RotateCcw, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSegmented, AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { AdminConfirm } from "@/components/admin/AdminConfirm";
import { getAnnouncementType } from "@/lib/announcement-types";
import {
  ANNOUNCEMENT_FILTERS,
  NOTICEBOARD_LIMIT,
  STATE_LABELS,
  STATE_TONES,
  announcementCounts,
  announcementState,
  endLabel,
  matchesAnnouncementFilter,
  noticeboard,
  postedLabel,
  sortAnnouncements,
  type Announcement,
  type AnnouncementFilter,
} from "@/lib/admin-announcements";
import {
  archiveAnnouncement,
  deleteAnnouncement,
  restoreAnnouncement,
  saveAnnouncement,
  type AnnouncementResult,
  type AnnouncementSaveResult,
} from "./actions";
import { AnnouncementDialog } from "./AnnouncementDialog";
import { NoticeboardItem, TypeIcon } from "./Noticeboard";

export type AnnouncementActions = {
  save: (data: FormData) => Promise<AnnouncementSaveResult>;
  archive: (id: string) => Promise<AnnouncementResult>;
  restore: (id: string) => Promise<AnnouncementResult>;
  remove: (id: string) => Promise<{ error?: string }>;
};

const SERVER_ACTIONS: AnnouncementActions = { save: saveAnnouncement, archive: archiveAnnouncement, restore: restoreAnnouncement, remove: deleteAnnouncement };
const OFFLINE = "Couldn’t reach the server. Please try again.";

const EMPTY: Record<AnnouncementFilter, { title: string; body: string }> = {
  live: { title: "Nothing on the noticeboard", body: "Post an announcement and it shows on every member’s dashboard." },
  ended: { title: "Nothing has ended", body: "Announcements land here once their end date passes." },
  archived: { title: "Nothing archived", body: "Archive an announcement to take it down without losing it." },
  all: { title: "No announcements yet", body: "Post the first one and members see it on their dashboard." },
};

function AnnouncementCard({
  announcement: a,
  now,
  actions,
  onEdit,
  onChange,
  onRemove,
}: {
  announcement: Announcement;
  now: Date;
  actions: AnnouncementActions;
  onEdit: () => void;
  onChange: (saved: Announcement) => void;
  onRemove: (id: string) => void;
}) {
  const [restoring, startRestore] = useTransition();
  const state = announcementState(a, now);
  const headingId = `announcement-${a.id}`;

  const archive = async () => {
    try {
      const result = await actions.archive(a.id);
      if (result.error || !result.saved) return { error: result.error ?? "Couldn’t archive it. Please try again." };
      onChange(result.saved);
      toast.success("Announcement archived", { description: state === "live" ? "It’s off the member noticeboard." : undefined });
    } catch {
      return { error: OFFLINE };
    }
  };

  const restore = () =>
    startRestore(async () => {
      try {
        const result = await actions.restore(a.id);
        if (result.error || !result.saved) {
          toast.error("Couldn’t restore it", { description: result.error });
          return;
        }
        onChange(result.saved);
        toast.success("Back on the noticeboard", {
          description: a.expiresAt && !result.saved.expiresAt ? "Its end date had passed, so it now stays up until you archive it." : undefined,
        });
      } catch {
        toast.error("Couldn’t restore it", { description: OFFLINE });
      }
    });

  const remove = async () => {
    try {
      const result = await actions.remove(a.id);
      if (result.error) return { error: result.error };
      onRemove(a.id);
      toast.success("Announcement deleted");
    } catch {
      return { error: OFFLINE };
    }
  };

  return (
    <article className="admin-announce admin-typed" data-type={a.type} data-state={state} aria-labelledby={headingId}>
      <span className="admin-announce-icon" aria-hidden><TypeIcon type={a.type} size={16} /></span>
      <div className="admin-announce-body">
        <div className="admin-announce-meta">
          <span className="admin-announce-type">{getAnnouncementType(a.type).label}</span>
          <span className="hub-status-badge" data-status={STATE_TONES[state]}>{STATE_LABELS[state]}</span>
        </div>
        <h3 id={headingId}>{a.title}</h3>
        <p className="admin-announce-message">{a.message}</p>
        <p className="admin-announce-dates">{postedLabel(a, now)}<span aria-hidden> · </span>{endLabel(a, now)}</p>
      </div>
      <div className="admin-announce-actions">
        {state === "archived" ? (
          <>
            <button type="button" className="hub-button hub-button-outline" onClick={restore} disabled={restoring} aria-label={`Restore “${a.title}”`}>
              {restoring ? <Loader2 size={13} className="hub-spin" aria-hidden /> : <RotateCcw size={13} aria-hidden />}Restore
            </button>
            <AdminConfirm
              trigger={<button type="button" className="hub-button hub-button-outline admin-danger-button" aria-label={`Delete “${a.title}”`}><Trash2 size={13} aria-hidden />Delete</button>}
              title="Delete this announcement for good?"
              description={<>“{a.title}” will be gone, and it can’t be restored.</>}
              confirmLabel="Delete for good"
              pendingLabel="Deleting…"
              onConfirm={remove}
            />
          </>
        ) : (
          <>
            <button type="button" className="hub-button hub-button-outline" onClick={onEdit} aria-label={`Edit “${a.title}”`}><PenLine size={13} aria-hidden />Edit</button>
            <AdminConfirm
              trigger={<button type="button" className="hub-button hub-button-outline" aria-label={`Archive “${a.title}”`}><Archive size={13} aria-hidden />Archive</button>}
              title="Archive this announcement?"
              description={
                state === "live"
                  ? <>“{a.title}” comes off the member noticeboard straight away. You can restore it later.</>
                  : <>“{a.title}” has already ended, so members can’t see it. Archiving tidies it away, and you can restore it later.</>
              }
              confirmLabel="Archive"
              pendingLabel="Archiving…"
              onConfirm={archive}
            />
          </>
        )}
      </div>
    </article>
  );
}

export function AnnouncementsBoard({
  initial,
  now: nowIso,
  today,
  compose = false,
  actions = SERVER_ACTIONS,
}: {
  initial: Announcement[];
  now: string;
  today: string;
  compose?: boolean;
  actions?: AnnouncementActions;
}) {
  const now = new Date(nowIso);
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<AnnouncementFilter>(() => {
    const counts = announcementCounts(initial, new Date(nowIso));
    return counts.live > 0 || counts.all === 0 ? "live" : "all";
  });
  const [editing, setEditing] = useState<Announcement | "new" | null>(compose ? "new" : null);

  const counts = announcementCounts(items, now);
  const rows = items.filter((a) => matchesAnnouncementFilter(a, filter, now));
  const board = noticeboard(items, now);
  const hidden = counts.live - board.length;

  const upsert = (saved: Announcement) => setItems((list) => sortAnnouncements([saved, ...list.filter((a) => a.id !== saved.id)]));
  const drop = (id: string) => setItems((list) => list.filter((a) => a.id !== id));

  const handleSaved = (saved: Announcement) => {
    upsert(saved);
    const state = announcementState(saved, new Date());
    if (filter !== "all" && filter !== state) setFilter(state);
  };

  const closeComposer = () => {
    setEditing(null);
    // Opened from a "post an announcement" link: drop the ?new=1 so a refresh doesn't reopen it.
    if (window.location.search.includes("new=1")) window.history.replaceState(null, "", window.location.pathname);
  };

  const lede =
    counts.live === 0
      ? "Nothing is on the member noticeboard right now."
      : `${counts.live} live on the member noticeboard${hidden > 0 ? `, but members only see the newest ${NOTICEBOARD_LIMIT}` : ""}.`;
  const newButton = (className: string) => (
    <button type="button" className={`hub-button ${className}`} onClick={() => setEditing("new")}>
      <Plus size={15} aria-hidden />New announcement
    </button>
  );

  return (
    <>
      <AdminPageHeader eyebrow="Community" title="Announcements" description={lede} actions={newButton("hub-button-primary admin-announce-new")} />

      <div className="admin-announce-layout">
        <section className="hub-surface admin-panel" aria-labelledby="announcements-list-title">
          <h2 id="announcements-list-title" className="sr-only">All announcements</h2>
          <AdminToolbar>
            <AdminSegmented
              label="Filter announcements"
              value={filter}
              onChange={setFilter}
              options={ANNOUNCEMENT_FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
            />
          </AdminToolbar>
          {rows.length === 0 ? (
            <AdminEmpty
              icon={<Megaphone size={18} />}
              title={EMPTY[filter].title}
              action={filter === "live" || filter === "all" ? newButton("hub-button-outline") : undefined}
            >
              {EMPTY[filter].body}
            </AdminEmpty>
          ) : (
            <ul className="admin-announce-list">
              {rows.map((a) => (
                <li key={a.id}>
                  <AnnouncementCard announcement={a} now={now} actions={actions} onEdit={() => setEditing(a)} onChange={upsert} onRemove={drop} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="hub-surface admin-noticeboard" aria-labelledby="noticeboard-title">
          <div className="hub-feed-heading">
            <div><p className="hub-eyebrow">Member dashboard</p><h2 id="noticeboard-title">What members see</h2></div>
            <Megaphone size={19} aria-hidden />
          </div>
          {board.length ? (
            <div className="hub-announcements">
              {board.map((a) => <NoticeboardItem key={a.id} type={a.type} title={a.title} message={a.message} createdAt={a.createdAt} />)}
            </div>
          ) : (
            <div className="hub-feed-empty">
              <Megaphone size={24} strokeWidth={1.3} aria-hidden />
              <h3>All quiet for now.</h3>
              <p>Members see an empty noticeboard until you post something.</p>
            </div>
          )}
          {hidden > 0 && (
            <p className="admin-noticeboard-note">
              {hidden} older live announcement{hidden === 1 ? " is" : "s are"} hidden. Members only see the newest {NOTICEBOARD_LIMIT}, so archive what’s done.
            </p>
          )}
        </aside>
      </div>

      {editing && (
        <AnnouncementDialog
          key={editing === "new" ? "new" : editing.id}
          announcement={editing === "new" ? null : editing}
          today={today}
          save={actions.save}
          onClose={closeComposer}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
