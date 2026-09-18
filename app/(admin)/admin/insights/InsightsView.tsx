import Link from "next/link";
import { ArrowUpRight, CalendarCheck2, CalendarX2, ChartLine, CircleDollarSign, DoorOpen, Download, Gauge, Inbox, Info, TriangleAlert, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStat, AdminStats } from "@/components/admin/AdminStat";
import { AdminSegmented, AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { TrendChart } from "@/components/admin/charts/TrendChart";
import { TREND_VIEWBOX } from "@/components/admin/charts/trend-geometry";
import { Heatmap, type HeatmapRow } from "@/components/admin/charts/Heatmap";
import { BarList } from "@/components/admin/charts/BarList";
import { Meter } from "@/components/admin/charts/Meter";
import { TableView } from "@/components/admin/charts/TableView";
import { Delta } from "@/components/admin/charts/Delta";
import { formatTime } from "@/features/booking-map/booking/time";
import { weekdayOfKey } from "@/features/booking-map/zoned-time";
import {
  RANGE_KEYS,
  cancellations,
  formatCents,
  formatDollars,
  formatHours,
  formatPercent,
  heatExtremes,
  heatLevel,
  hourHeat,
  insightsHref,
  leadTimes,
  niceTicks,
  percentChange,
  pointsChange,
  resolveRange,
  revenueSeries,
  roomStats,
  shortDay,
  sparkPaths,
  spendByConverted,
  summarise,
  topSpenders,
  windowLabel,
  type HeatGrid,
  type RoomStat,
  type Spender,
} from "@/lib/admin-insights";
import { channelBreakdown, daysToWin, funnel } from "@/lib/admin-leads";
import type { InsightsData } from "./insights-data";

const PATH = "/admin/insights";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_PLURALS: Record<string, string> = { Mon: "Mondays", Tue: "Tuesdays", Wed: "Wednesdays", Thu: "Thursdays", Fri: "Fridays", Sat: "Saturdays", Sun: "Sundays" };

export function InsightsView({ data }: { data: InsightsData }) {
  const now = new Date(data.now);
  const { range, bookings, sellableRooms, room } = data;
  const roomId = room?.id ?? null;

  const current = summarise(bookings, range, sellableRooms);
  const previous = summarise(bookings, range.previous, sellableRooms);
  const cancel = cancellations(bookings, range);
  const previousCancel = cancellations(bookings, range.previous);
  const against = windowLabel(range.previous);

  return (
    <div className="hub-page admin-insights-page">
      <AdminPageHeader
        eyebrow="Reports"
        title="Insights"
        description={`${range.label}, ${windowLabel(range)}, ${room ? room.name : "all spaces"}. Each figure is compared with the ${range.days} days before.`}
        actions={
          // A plain link: the browser handles the download, and the route checks the caller itself.
          <a className="hub-button hub-button-outline" href={insightsHref(`${PATH}/export`, { range: range.key, room: roomId })} download>
            Export CSV
            <Download size={15} aria-hidden />
          </a>
        }
      />

      <AdminToolbar>
        <AdminSegmented
          label="Period"
          value={range.key}
          options={RANGE_KEYS.map((key) => ({ value: key, label: resolveRange(key, now).label, href: insightsHref(PATH, { range: key, room: roomId }) }))}
        />
        {data.rooms.length > 1 && (
          <AdminSegmented
            label="Space"
            value={roomId ?? "all"}
            options={[
              { value: "all", label: "All spaces", href: insightsHref(PATH, { range: range.key }) },
              ...data.rooms.map((r) => ({ value: r.id, label: r.name, href: insightsHref(PATH, { range: range.key, room: r.id }) })),
            ]}
          />
        )}
      </AdminToolbar>

      {data.truncated && (
        <p className="admin-insights-note" data-tone="warning" role="status">
          <TriangleAlert size={15} aria-hidden />
          This period has more bookings than the report reads at once, so the figures below are incomplete. Choose a shorter period.
        </p>
      )}
      {!data.auditColumns && (
        <p className="admin-insights-note" role="status">
          <Info size={15} aria-hidden />
          Booking lead time and cancellation timing start recording once add_booking_audit_columns.sql has been run in Supabase.
        </p>
      )}

      <AdminStats label={`${range.label} at a glance`}>
        <AdminStat
          label="Net revenue"
          value={formatDollars(current.netRevenue)}
          tone="red"
          icon={<CircleDollarSign size={16} />}
          hint={<Delta change={percentChange(current.netRevenue, previous.netRevenue)} better="up" against={against} />}
        />
        <AdminStat
          label="Bookings"
          value={current.bookings}
          icon={<CalendarCheck2 size={16} />}
          hint={<Delta change={percentChange(current.bookings, previous.bookings)} better="up" against={against} />}
        />
        <AdminStat
          label="Utilisation"
          value={formatPercent(current.utilisation)}
          icon={<Gauge size={16} />}
          hint={<Delta change={pointsChange(current.utilisation, previous.utilisation)} better="up" against={against} />}
        />
        <AdminStat
          label="Cancellation rate"
          value={formatPercent(cancel.rate)}
          icon={<CalendarX2 size={16} />}
          hint={<Delta change={pointsChange(cancel.rate, previousCancel.rate)} better="down" against={against} />}
        />
      </AdminStats>

      <div className="admin-insights-grid">
        <RevenuePanel data={data} gross={current.grossRevenue} net={current.netRevenue} refunded={current.refunded} />
        <SpendersPanel spenders={topSpenders(bookings, range)} />
        <RoomsPanel rooms={roomStats(data.scope, bookings, range)} scoped={Boolean(room)} />
        <HeatPanel grid={hourHeat(bookings, range, sellableRooms)} sellableRooms={sellableRooms} />
        <BehaviourPanel data={data} cancel={cancel} />
        {/* Leads aren't per room, so the funnel only shows for the whole hub. */}
        {!room && <LeadsPanel data={data} />}
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

// ─── Revenue over time ───────────────────────────────────────────────────────

function RevenuePanel({ data, gross, net, refunded }: { data: InsightsData; gross: number; net: number; refunded: number }) {
  const { points, bucketDays } = revenueSeries(data.bookings, data.range);
  const { top, ticks } = niceTicks(Math.max(0, ...points.map((p) => p.value)));
  const { width, height } = TREND_VIEWBOX;
  const paths = sparkPaths(points.map((p) => p.value), width, height, top);
  const label = (key: string) => (bucketDays === 1 ? `${WEEKDAYS[weekdayOfKey(key)]} ${shortDay(key)}` : `Week of ${shortDay(key)}`);

  return (
    <section className="hub-surface admin-panel admin-insights-revenue" aria-labelledby="revenue-title">
      <PanelHead id="revenue-title" eyebrow="Revenue" title={bucketDays === 1 ? "Money in, day by day" : "Money in, week by week"} />
      {gross === 0 ? (
        <AdminEmpty icon={<ChartLine size={18} />} title="No paid bookings in this period">Revenue shows here as members pay for bookings.</AdminEmpty>
      ) : (
        <div className="admin-insights-body">
          <dl className="admin-insights-figures">
            <div><dt>Net</dt><dd>{formatDollars(net)}</dd></div>
            <div><dt>Taken</dt><dd>{formatDollars(gross)}</dd></div>
            <div><dt>Refunded</dt><dd>{formatDollars(refunded)}</dd></div>
          </dl>
          <TrendChart
            label={`Net revenue ${bucketDays === 1 ? "per day" : "per week"}, ${windowLabel(data.range)}`}
            line={paths.line}
            area={paths.area}
            points={points.map((p, i) => ({
              label: label(p.key),
              display: formatCents(p.value),
              x: (paths.points[i].x / width) * 100,
              y: (paths.points[i].y / height) * 100,
            }))}
            ticks={ticks.map((value) => ({ label: formatDollars(value), y: 100 - (value / top) * 100 }))}
          />
          <p className="admin-insights-caption">Counted on the day each booking takes place, after refunds.</p>
          <TableView label="Net revenue as a table">
            <table className="admin-mini-table">
              <thead><tr><th scope="col">{bucketDays === 1 ? "Day" : "Week"}</th><th scope="col">Net revenue</th></tr></thead>
              <tbody>{points.map((p) => <tr key={p.key}><th scope="row">{label(p.key)}</th><td>{formatCents(p.value)}</td></tr>)}</tbody>
            </table>
          </TableView>
        </div>
      )}
    </section>
  );
}

// ─── People ──────────────────────────────────────────────────────────────────

function SpendersPanel({ spenders }: { spenders: Spender[] }) {
  return (
    <section className="hub-surface admin-panel admin-insights-spenders" aria-labelledby="spenders-title">
      <PanelHead id="spenders-title" eyebrow="Members" title="Top spenders" action={<Link href="/admin/members" className="hub-text-link">All members<ArrowUpRight size={15} aria-hidden /></Link>} />
      {spenders.length === 0 ? (
        <AdminEmpty icon={<Users size={18} />} title="No spending yet">Members who pay for bookings in this period appear here.</AdminEmpty>
      ) : (
        // A ranked list rather than a table: three short columns in a narrow panel would fold into tall cards.
        <ol className="admin-rank" aria-label="Members who spent the most in this period, after refunds">
          {spenders.map((s, i) => (
            <li key={s.memberId}>
              <span className="admin-rank-n" aria-hidden>{i + 1}</span>
              <span className="admin-rank-who">
                <strong>{s.name}</strong>
                <span>{[s.company, `${s.bookings} booking${s.bookings === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="admin-rank-value admin-num">{formatCents(s.net)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

function RoomsPanel({ rooms, scoped }: { rooms: RoomStat[]; scoped: boolean }) {
  return (
    <section className="hub-surface admin-panel admin-insights-rooms" aria-labelledby="rooms-title">
      <PanelHead
        id="rooms-title"
        eyebrow="Spaces"
        title={scoped ? "How this space is used" : "How each space is used"}
        action={<Link href="/admin/rooms" className="hub-text-link">Manage spaces<ArrowUpRight size={15} aria-hidden /></Link>}
      />
      <AdminDataTable<RoomStat>
        caption="Use of each space in this period, busiest first"
        rows={rooms}
        rowKey={(r) => r.id}
        empty={<AdminEmpty icon={<DoorOpen size={18} />} title="No spaces to report on">Add rooms in Space management and they’ll appear here.</AdminEmpty>}
        columns={[
          { key: "space", header: "Space", primary: true, cell: (r) => <>{r.name}{!r.sellable && <span className="admin-cell-sub">Not bookable now</span>}</> },
          {
            key: "use",
            header: "Utilisation",
            cell: (r) => (
              <span className="admin-meter-cell">
                <Meter fraction={r.utilisation} />
                <span className="admin-num">{formatPercent(r.utilisation)}</span>
              </span>
            ),
          },
          { key: "hours", header: "Booked", cell: (r) => <span className="admin-num">{formatHours(r.bookedMinutes)}</span> },
          { key: "count", header: "Bookings", cell: (r) => <span className="admin-num">{r.bookings}</span> },
          { key: "cancelled", header: "Cancelled", hideOnMobile: true, cell: (r) => <span className="admin-num">{r.cancelled}</span> },
          { key: "revenue", header: "Revenue", align: "end", cell: (r) => <span className="admin-num">{formatCents(r.revenue)}</span> },
        ]}
      />
    </section>
  );
}

// ─── Busy hours ──────────────────────────────────────────────────────────────

function hourSpan(hour: number) {
  return `${formatTime(hour * 60)}–${formatTime(hour * 60 + 60)}`;
}

function heatRows(grid: HeatGrid): HeatmapRow[] {
  return grid.rows.map((row) => ({
    label: row.label,
    cells: row.cells.map((cell, i) => {
      const when = `${row.label} ${hourSpan(grid.hours[i])}`;
      if (cell.state === "closed") return { state: "closed", level: 0, text: `${when}: closed` };
      if (cell.state === "none") return { state: "none", level: 0, text: `${when}: no ${WEEKDAY_PLURALS[row.label] ?? "days like this"} in this period` };
      return { state: "open", level: heatLevel(cell.occupancy), text: `${when}: ${formatPercent(cell.occupancy)} booked${cell.minutes ? `, ${formatHours(cell.minutes)} in total` : ""}` };
    }),
  }));
}

function HeatPanel({ grid, sellableRooms }: { grid: HeatGrid; sellableRooms: number }) {
  const { busiest, idleHours, openHours } = heatExtremes(grid);
  return (
    <section className="hub-surface admin-panel admin-insights-heat" aria-labelledby="heat-title">
      <PanelHead id="heat-title" eyebrow="Busy hours" title="When the space is in use" />
      {sellableRooms === 0 ? (
        <AdminEmpty icon={<Gauge size={18} />} title="Nothing to sell here">This space isn’t bookable, so it has no hours to fill.</AdminEmpty>
      ) : (
        <div className="admin-insights-body">
          <p className="admin-insights-lede">
            {busiest
              ? <>Busiest: <strong>{busiest.label} {hourSpan(busiest.hour)}</strong>, {formatPercent(busiest.occupancy)} booked. </>
              : <>Nothing was booked in this period. </>}
            {openHours > 0 && <>{idleHours} of {openHours} open hours in the week sold nothing.</>}
          </p>
          <Heatmap label="Share of each open hour that was booked, by weekday" hours={grid.hours.map((h) => formatTime(h * 60))} rows={heatRows(grid)} />
          <TableView label="Busy hours as a table">
            <table className="admin-mini-table">
                <thead>
                  <tr><th scope="col">Day</th>{grid.hours.map((h) => <th key={h} scope="col">{formatTime(h * 60)}</th>)}</tr>
                </thead>
                <tbody>
                  {grid.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {row.cells.map((cell, i) => <td key={i}>{cell.state === "open" ? formatPercent(cell.occupancy) : cell.state === "closed" ? "Closed" : "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
            </table>
          </TableView>
        </div>
      )}
    </section>
  );
}

// ─── Behaviour ───────────────────────────────────────────────────────────────

function share(count: number, total: number) {
  return total > 0 ? ` · ${formatPercent(count / total)}` : "";
}

function BehaviourPanel({ data, cancel }: { data: InsightsData; cancel: ReturnType<typeof cancellations> }) {
  const lead = leadTimes(data.bookings, data.range);
  return (
    <section className="hub-surface admin-panel admin-insights-behaviour" aria-labelledby="behaviour-title">
      <PanelHead id="behaviour-title" eyebrow="Behaviour" title="How people book" />
      <div className="admin-insights-body">
        <h3 className="admin-insights-subhead">How far ahead</h3>
        {!data.auditColumns ? (
          <p className="admin-insights-caption">Starts recording once add_booking_audit_columns.sql has been run.</p>
        ) : lead.known === 0 ? (
          <p className="admin-insights-caption">
            {lead.unknown > 0 ? `None of the ${lead.unknown} bookings here were made after booking dates started being recorded.` : "No bookings in this period."}
          </p>
        ) : (
          <>
            <BarList label="How many days ahead bookings were made" items={lead.buckets.map((b) => ({ key: b.key, label: b.label, value: b.count, display: `${b.count}${share(b.count, lead.known)}` }))} />
            {lead.unknown > 0 && <p className="admin-insights-caption">From {lead.known} bookings. {lead.unknown} earlier ones were made before booking dates were recorded.</p>}
          </>
        )}

        <h3 className="admin-insights-subhead">Cancellations</h3>
        <p className="admin-insights-lede">
          {cancel.paid === 0
            ? "No paid bookings in this period."
            : <><strong>{cancel.cancelled}</strong> of {cancel.paid} paid booking{cancel.paid === 1 ? " was" : "s were"} cancelled.</>}
        </p>
        {cancel.cancelled > 0 && (
          <>
            <BarList label="How much notice cancellations gave" items={cancel.notice.map((b) => ({ key: b.key, label: b.label, value: b.count, display: `${b.count}` }))} />
            {cancel.noticeUnknown > 0 && <p className="admin-insights-caption">{cancel.noticeUnknown} cancelled before cancellation times were recorded.</p>}
          </>
        )}
        <p className="admin-insights-caption">
          {cancel.abandoned === 0
            ? "No checkouts were left unpaid."
            : `${cancel.abandoned} checkout${cancel.abandoned === 1 ? " was" : "s were"} started and never paid${cancel.abandonRate === null ? "" : ` (${formatPercent(cancel.abandonRate)} of checkouts)`}. These aren’t counted as cancellations.`}
        </p>
      </div>
    </section>
  );
}

// ─── Leads ───────────────────────────────────────────────────────────────────

function LeadsPanel({ data }: { data: InsightsData }) {
  const leads = data.leads;
  return (
    <section className="hub-surface admin-panel admin-insights-leads" aria-labelledby="leads-title">
      <PanelHead id="leads-title" eyebrow="Leads" title="From enquiry to member" action={<Link href="/admin/leads" className="hub-text-link">Leads board<ArrowUpRight size={15} aria-hidden /></Link>} />
      {leads === null ? (
        <AdminEmpty icon={<Inbox size={18} />} title="Leads aren’t set up yet">Run add_leads.sql in Supabase, and enquiries from the website will be counted here.</AdminEmpty>
      ) : leads.length === 0 ? (
        <AdminEmpty icon={<Inbox size={18} />} title="No enquiries in this period">Leads from the enquiry form, or added by staff, are counted here.</AdminEmpty>
      ) : (
        <LeadsBody data={data} leads={leads} />
      )}
    </section>
  );
}

function LeadsBody({ data, leads }: { data: InsightsData; leads: NonNullable<InsightsData["leads"]> }) {
  const { steps, open, lost, winRate } = funnel(leads);
  const days = daysToWin(leads);
  const spend = spendByConverted(data.bookings, data.range, new Set(data.convertedMemberIds));
  const channels = channelBreakdown(leads, "heardVia").slice(0, 6);
  return (
    <div className="admin-insights-body">
      <dl className="admin-insights-figures">
        <div><dt>Enquiries</dt><dd>{leads.length}</dd></div>
        {/* Of closed leads, not of every enquiry: the funnel below shows the share of all enquiries, so both say which they mean. */}
        <div><dt>Win rate, closed leads</dt><dd>{formatPercent(winRate)}</dd></div>
        <div><dt>Days to win</dt><dd>{days === null ? "—" : days}</dd></div>
        <div><dt>Spent by converted members</dt><dd>{formatDollars(spend.net)}</dd></div>
      </dl>
      <div className="admin-insights-split">
        <div>
          <h3 className="admin-insights-subhead">How far enquiries got</h3>
          <BarList
            label="How many enquiries reached each stage"
            items={steps.map((s) => ({ key: s.stage, label: s.label, value: s.count, display: s.stage === "new" || s.fromStart === null ? `${s.count}` : `${s.count} · ${formatPercent(s.fromStart)}` }))}
          />
          <p className="admin-insights-caption">
            A lead counts at every stage it reached, so one lost after a tour still counts as a tour. {open} still open, {lost} lost.
            {spend.members > 0 && ` ${spend.members} member${spend.members === 1 ? "" : "s"} who came in as leads paid for bookings in this period.`}
          </p>
        </div>
        <div>
          <h3 className="admin-insights-subhead">How they found us</h3>
          <table className="admin-mini-table">
            <caption className="sr-only">Enquiries and wins by how they heard about Inspire9</caption>
            <thead><tr><th scope="col">Channel</th><th scope="col">Enquiries</th><th scope="col">Won</th><th scope="col">Win rate</th></tr></thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.key}><th scope="row">{c.label}</th><td>{c.leads}</td><td>{c.won}</td><td>{formatPercent(c.winRate)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="admin-insights-caption">Win rate counts only leads that have closed, won or lost.</p>
        </div>
      </div>
    </div>
  );
}
