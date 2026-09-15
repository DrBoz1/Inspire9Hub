import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarCheck2, CalendarDays, CalendarRange, CheckCircle2, ClipboardCheck, DoorOpen, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStat, AdminStats } from "@/components/admin/AdminStat";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { formatTime } from "@/features/booking-map/booking/time";
import { initialsOf } from "@/lib/member-forms";
import {
  TIMELINE_TICKS,
  bookingPhase,
  dashboardSummary,
  dateTile,
  formatBooked,
  formatLongDay,
  formatRange,
  greetingFor,
  hubDateKey,
  oldestWaitingHint,
  roomTimelines,
  startsIn,
  timelinePercent,
  todayOverview,
  waitingDays,
  waitingLabel,
  type DashboardData,
} from "@/lib/admin-dashboard";

type Props = DashboardData & { adminName: string | null };

export function AdminDashboardView({ adminName, ...data }: Props) {
  const now = new Date(data.now);
  const todayKey = hubDateKey(now);
  const overview = todayOverview(data.today, now);
  const firstName = adminName?.trim().split(" ")[0];

  return (
    <div className="hub-page admin-dashboard">
      <AdminPageHeader
        eyebrow={`Admin portal · ${formatLongDay(now)}`}
        title={firstName ? `${greetingFor(now)}, ${firstName}` : greetingFor(now)}
        description={dashboardSummary(data.pendingCount, overview.total, overview.roomsInUse)}
        actions={
          data.pendingCount > 0 ? (
            <>
              <Link href="/admin/bookings" className="hub-button hub-button-outline">Booking schedule</Link>
              <Link href="/admin/approvals" className="hub-button hub-button-primary">Review inductions<ArrowRight size={15} aria-hidden /></Link>
            </>
          ) : (
            <>
              <Link href="/admin/announcements" className="hub-button hub-button-outline">Post an announcement</Link>
              <Link href="/admin/bookings" className="hub-button hub-button-primary">Booking schedule<ArrowRight size={15} aria-hidden /></Link>
            </>
          )
        }
      />

      <AdminStats label="Today at a glance">
        <AdminStat label="Inductions to review" value={data.pendingCount} tone={data.pendingCount ? "amber" : "neutral"} icon={<ClipboardCheck size={16} />} href="/admin/approvals" hint={oldestWaitingHint(data.pending, todayKey)} />
        <AdminStat label="Bookings today" value={overview.total} tone="red" icon={<CalendarDays size={16} />} href="/admin/bookings" hint={overview.total ? `${overview.inUse} in use · ${overview.toCome} to come` : "Nothing booked"} />
        <AdminStat label="Active members" value={data.activeMembers} tone="green" icon={<Users size={16} />} href="/admin/members" hint={`Of ${data.totalMembers} member account${data.totalMembers === 1 ? "" : "s"}`} />
        <AdminStat label="Next 7 days" value={data.nextWeekCount} icon={<CalendarRange size={16} />} href="/admin/bookings" hint="Confirmed bookings ahead" />
      </AdminStats>

      <div className="admin-dash-grid">
        <div className="admin-dash-col">
          <TodayPanel data={data} now={now} />
          <SpacesPanel data={data} now={now} />
        </div>
        <div className="admin-dash-col">
          <ReviewPanel data={data} todayKey={todayKey} />
          <ComingUpPanel data={data} />
        </div>
      </div>
    </div>
  );
}

function PanelHead({ id, eyebrow, title, action }: { id: string; eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <header className="admin-panel-head">
      <div><p className="hub-eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div>
      {action}
    </header>
  );
}

function TodayPanel({ data, now }: { data: DashboardData; now: Date }) {
  return (
    <section className="hub-surface admin-panel admin-dash-today" aria-labelledby="today-title">
      <PanelHead id="today-title" eyebrow="Today" title="At the hub" action={<Link href="/admin/bookings" className="hub-text-link">Booking schedule<ArrowUpRight size={15} aria-hidden /></Link>} />
      {data.today.length === 0 ? (
        <AdminEmpty icon={<CalendarCheck2 size={18} />} title="No bookings today">Every room is free. New bookings appear here.</AdminEmpty>
      ) : (
        <ol className="admin-schedule">
          {data.today.map((b) => {
            const phase = bookingPhase(b, now);
            return (
              <li key={b.id} data-phase={phase}>
                <div className="admin-schedule-when">
                  <time dateTime={b.start}>{formatRange(b.start, b.end)}</time>
                  <small>{phase === "in_use" ? <><i className="admin-live-dot" aria-hidden />In use</> : phase === "finished" ? "Finished" : startsIn(b.start, now)}</small>
                </div>
                <div className="admin-schedule-what"><strong>{b.room}</strong><span>{b.member}</span></div>
                <span className="hub-status-badge" data-status={b.status}>{b.status === "pending" ? "Awaiting payment" : "Confirmed"}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function SpacesPanel({ data, now }: { data: DashboardData; now: Date }) {
  const { rows, hidden, nowPct } = roomTimelines(data.rooms, data.today, now);
  return (
    <section className="hub-surface admin-panel admin-dash-spaces" aria-labelledby="spaces-title">
      <PanelHead id="spaces-title" eyebrow="Spaces today" title="Room timeline" action={<Link href="/admin/rooms" className="hub-text-link">Manage spaces<ArrowUpRight size={15} aria-hidden /></Link>} />
      {rows.length === 0 ? (
        <AdminEmpty icon={<DoorOpen size={18} />} title="No bookable spaces yet">Add rooms in Space management and they’ll appear here.</AdminEmpty>
      ) : (
        <div className="admin-rooms">
          <div className="admin-rooms-axis" aria-hidden>
            <span />
            <ol>{TIMELINE_TICKS.map((m) => <li key={m} style={{ left: `${timelinePercent(m)}%` }}>{formatTime(m)}</li>)}</ol>
            <span />
          </div>
          <ul>
            {rows.map((room) => (
              <li key={room.id} className="admin-room">
                <span className="admin-room-name">{room.inUse && <i className="admin-live-dot" aria-hidden />}{room.name}</span>
                <span className="admin-room-track" role="img" aria-label={room.segments.length ? `${room.name}: ${room.segments.map((s) => s.label).join("; ")}` : `${room.name}: nothing booked today`}>
                  {room.segments.map((s) => (
                    <span key={s.id} style={{ left: `${s.left}%`, width: `${s.width}%` }} data-phase={s.phase} data-status={s.status} title={s.label} />
                  ))}
                  {nowPct !== null && <i className="admin-room-now" style={{ left: `${nowPct}%` }} />}
                </span>
                <span className="admin-room-hours">{formatBooked(room.bookedMinutes)}</span>
              </li>
            ))}
          </ul>
          <ul className="admin-rooms-legend" aria-label="Timeline key">
            <li><i data-kind="booked" />Booked</li>
            <li><i data-kind="in_use" />In use</li>
            <li><i data-kind="pending" />Awaiting payment</li>
            <li><i data-kind="now" />Now</li>
          </ul>
          {hidden > 0 && <p className="admin-rooms-more">{hidden} more space{hidden === 1 ? "" : "s"} not shown. <Link href="/admin/bookings">See the full schedule</Link></p>}
        </div>
      )}
    </section>
  );
}

function ReviewPanel({ data, todayKey }: { data: DashboardData; todayKey: string }) {
  const shown = data.pending.slice(0, 5);
  return (
    <section className="hub-surface admin-panel admin-dash-review" aria-labelledby="review-title">
      <PanelHead id="review-title" eyebrow="Compliance" title="Needs review" action={data.pendingCount > 0 ? <span className="admin-nav-count">{data.pendingCount}</span> : undefined} />
      {shown.length === 0 ? (
        <AdminEmpty icon={<CheckCircle2 size={18} />} title="All caught up">No inductions waiting. New submissions land here first.</AdminEmpty>
      ) : (
        <>
          <ul className="admin-queue">
            {shown.map((m) => {
              const days = waitingDays(m.submittedOn, todayKey);
              return (
                <li key={m.id}>
                  <Link href="/admin/approvals">
                    <span className="admin-initials" aria-hidden>{initialsOf(m.name)}</span>
                    <span className="admin-queue-who"><strong>{m.name}</strong><span>{m.company ?? "No company given"}</span></span>
                    <span className="admin-wait" data-urgent={days !== null && days >= 3 ? true : undefined}>
                      <span className="sr-only">Waiting </span>{waitingLabel(days)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="admin-panel-foot">
            <Link href="/admin/approvals" className="hub-button hub-button-primary">
              {data.pendingCount === 1 ? "Review induction" : `Review all ${data.pendingCount}`}<ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function ComingUpPanel({ data }: { data: DashboardData }) {
  return (
    <section className="hub-surface admin-panel admin-dash-upcoming" aria-labelledby="upcoming-title">
      <PanelHead id="upcoming-title" eyebrow="After today" title="Coming up" />
      {data.upcoming.length === 0 ? (
        <AdminEmpty title="Nothing booked after today" />
      ) : (
        <ul className="admin-upcoming">
          {data.upcoming.map((b) => {
            const tile = dateTile(b.start);
            return (
              <li key={b.id}>
                <span className="hub-date-tile" aria-hidden><span>{tile.month}</span><strong>{tile.day}</strong></span>
                <span className="admin-upcoming-what">
                  <strong>{b.room}</strong>
                  <span>{tile.weekday} {tile.day} {tile.month} · {formatRange(b.start, b.end)} · {b.member}</span>
                </span>
                {b.status === "pending" && <span className="hub-status-badge" data-status="pending">Unpaid</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
