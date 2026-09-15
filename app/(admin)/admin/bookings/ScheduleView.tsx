import Link from "next/link";
import Form from "next/form";
import { CalendarSearch, Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSegmented } from "@/components/admin/AdminToolbar";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { bookingPhase, formatRange } from "@/lib/admin-dashboard";
import {
  SCHEDULE_FILTERS,
  SCHEDULE_PAGE_SIZE,
  STATUS_LABELS,
  durationLabel,
  formatMoney,
  groupByDay,
  scheduleActions,
  scheduleHref,
  type ScheduleData,
  type ScheduleRow,
} from "@/lib/admin-bookings";
import { BookingActions } from "./BookingActions";

const EMPTY: Record<ScheduleData["filter"], [string, string]> = {
  upcoming: ["No upcoming bookings", "New bookings appear here as members make them."],
  today: ["Nothing booked today", "Every room is free today."],
  past: ["No past bookings yet", "Bookings move here once they’ve started."],
  cancelled: ["No cancelled bookings", "Cancellations from members or admins appear here."],
  all: ["No bookings yet", "Once members start booking, you’ll see everything here."],
};

export function ScheduleView({ data }: { data: ScheduleData }) {
  const now = new Date(data.now);
  const groups = groupByDay(data.rows, now);
  const [emptyTitle, emptyText] = data.q ? [`No bookings match “${data.q}”`, "Try a different name or email, or clear the search."] : EMPTY[data.filter];

  return (
    <div className="hub-page admin-schedule-page">
      <AdminPageHeader
        eyebrow="Operations"
        title="Booking schedule"
        description="Every room booking, in Melbourne time. Cancel or refund when plans change."
      />

      <section className="hub-surface admin-panel" aria-label="Bookings">
        <div className="admin-toolbar">
          <Form action="/admin/bookings" className="hub-search admin-search" role="search">
            <Search size={15} aria-hidden />
            {data.filter !== "upcoming" && <input type="hidden" name="filter" value={data.filter} />}
            <label htmlFor="schedule-search" className="sr-only">Search bookings by member</label>
            <input id="schedule-search" type="search" name="q" defaultValue={data.q} placeholder="Search member name or email" />
          </Form>
          <AdminSegmented
            label="Show bookings"
            value={data.filter}
            options={SCHEDULE_FILTERS.map((f) => ({ value: f.value, label: f.label, count: data.counts?.[f.value], href: scheduleHref({ filter: f.value, q: data.q }) }))}
          />
        </div>

        {data.q && (
          <p className="admin-schedule-note" role="status">
            {data.total} booking{data.total === 1 ? "" : "s"} for “{data.q}”. <Link href={scheduleHref({ filter: data.filter })}>Clear search</Link>
          </p>
        )}

        {groups.length === 0 ? (
          <AdminEmpty icon={<CalendarSearch size={18} />} title={data.page > 1 ? "Nothing on this page" : emptyTitle} action={data.page > 1 ? <Link href={scheduleHref({ filter: data.filter, q: data.q })} className="hub-button hub-button-outline">Back to the first page</Link> : undefined}>
            {data.page > 1 ? "There aren’t that many bookings." : emptyText}
          </AdminEmpty>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="admin-day">
              <h2 className="admin-day-head">
                <span>{group.label}</span>
                {group.date && <small>{group.date}</small>}
                <em>{group.rows.length} booking{group.rows.length === 1 ? "" : "s"}</em>
              </h2>
              <ul className="admin-bookings">
                {group.rows.map((row) => <BookingRow key={row.id} row={row} now={now} />)}
              </ul>
            </div>
          ))
        )}

        {data.total > SCHEDULE_PAGE_SIZE && (
          <AdminPagination page={data.page} totalPages={data.totalPages} label={`${data.total} bookings`} hrefFor={(page) => scheduleHref({ filter: data.filter, q: data.q, page })} />
        )}
      </section>
    </div>
  );
}

function BookingRow({ row, now }: { row: ScheduleRow; now: Date }) {
  const phase = bookingPhase(row, now);
  const live = row.status !== "cancelled" && phase === "in_use";
  return (
    <li className="admin-booking" data-status={row.status}>
      <div className="admin-booking-when">
        <time dateTime={row.start}>{formatRange(row.start, row.end)}</time>
        <small>{live ? <><i className="admin-live-dot" aria-hidden />In use · </> : null}{durationLabel(row.start, row.end)}</small>
      </div>
      <div className="admin-booking-what"><strong>{row.room}</strong><span>{row.location ?? "Inspire9"}</span></div>
      <div className="admin-booking-who">
        <strong>{row.member}</strong>
        {row.email ? <a href={`mailto:${row.email}`}>{row.email}</a> : <span>No email on file</span>}
      </div>
      <div className="admin-booking-pay" data-state={row.payment.state}>
        {row.payment.state === "paid" && <>{formatMoney(row.payment.amount)}<small>paid</small></>}
        {row.payment.state === "refund_failed" && <>{formatMoney(row.payment.amount)}<small>refund failed</small></>}
        {row.payment.state === "refunded" &&<>{formatMoney(row.payment.refunded ?? row.payment.amount)}<small>refunded</small></>}
        {row.payment.state === "unpaid" && <small>Unpaid</small>}
      </div>
      <span className="hub-status-badge" data-status={row.status}>{STATUS_LABELS[row.status] ?? row.status}</span>
      <BookingActions row={row} allowed={scheduleActions(row, now)} />
    </li>
  );
}
