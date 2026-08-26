
import type { Availability, Booking, Space } from '../booking/types';
import { bookingsOnDay, DAY_END, DAY_START, formatRange, formatTime, openingFor } from '../booking/time';
import { KIND_META } from '../data/spaces';
import { StatusSwatch } from './ui';

const SPAN = DAY_END - DAY_START;
const ROW_H = 34;

interface Props {
  spaces: Space[];
  bookings: Booking[];
  status: Map<string, Availability>;
  date: string;
  from: number;
  to: number;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onPickSlot: (spaceId: string, start: number) => void;
}

/**
 * Grid view — the same data as the map, read as a day timeline. Useful when the
 * question is "when", not "where"; the map remains the default.
 */
export function ScheduleView({
  spaces, bookings, status, date, from, to, selectedId, hoveredId, onSelect, onHover, onPickSlot,
}: Props) {
  const hours = openingFor(date);
  const pct = (m: number) => ((m - DAY_START) / SPAN) * 100;
  const rows = spaces.filter((s) => s.bookable);

  return (
    <div className="i9-scroll h-full overflow-auto" style={{ background: 'var(--color-surface-1)' }}>
      <div className="min-w-[1240px]">
        <div
          className="sticky top-0 z-20 flex border-b"
          style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}
        >
          {/* Pinned: at narrow widths the grid scrolls sideways, and an unpinned
              name column slides out of view under the sidebar. z-30 keeps it above
              the row cells it overlaps while scrolling. */}
          <div
            className="sticky left-0 z-30 w-60 shrink-0 border-r px-3 py-2 text-[12px] font-semibold"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-ink-500)',
              background: 'var(--color-surface-0)',
            }}
          >
            Space
          </div>
          <div className="relative flex-1">
            {Array.from({ length: SPAN / 60 + 1 }, (_, i) => DAY_START + i * 60).map((m) => (
              <span
                key={m}
                className="tnum absolute top-2 -translate-x-1/2 text-[11px] font-medium"
                style={{ left: `${pct(m)}%`, color: 'var(--color-ink-500)' }}
              >
                {formatTime(m)}
              </span>
            ))}
          </div>
        </div>

        {rows.map((s) => {
          const day = bookingsOnDay(bookings, s.id, date);
          const st = status.get(s.id) ?? 'available';
          const isSel = selectedId === s.id;
          return (
            <div
              key={s.id}
              className="flex border-b"
              style={{
                borderColor: 'var(--color-border-subtle)',
                background: isSel
                  ? 'var(--color-brand-wash)'
                  : hoveredId === s.id
                    ? 'var(--color-surface-2)'
                    : 'var(--color-surface-0)',
              }}
              onPointerEnter={() => onHover(s.id)}
              onPointerLeave={() => onHover(null)}
            >
              <button
                onClick={() => onSelect(s.id)}
                className="sticky left-0 z-20 flex w-60 shrink-0 items-center gap-2 border-r px-3 text-left"
                style={{
                  borderColor: 'var(--color-border)',
                  height: ROW_H,
                  // Opaque, and matching the row, so the timeline cannot bleed
                  // through the pinned column as it scrolls underneath.
                  background: isSel
                    ? 'var(--color-brand-wash)'
                    : hoveredId === s.id
                      ? 'var(--color-surface-2)'
                      : 'var(--color-surface-0)',
                }}
              >
                <StatusSwatch status={st} size={12} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                  {s.name}
                </span>
                <span className="shrink-0 text-[11px]" style={{ color: 'var(--color-ink-400)' }}>
                  {KIND_META[s.kind].label}
                </span>
              </button>

              <div className="relative flex-1" style={{ height: ROW_H }}>
                {/* closed hours */}
                {hours.open !== null && hours.open > DAY_START && (
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{ width: `${pct(hours.open)}%`, background: 'var(--color-surface-3)' }}
                  />
                )}
                {hours.close !== null && hours.close < DAY_END && (
                  <div
                    className="absolute inset-y-0 right-0"
                    style={{ left: `${pct(hours.close)}%`, background: 'var(--color-surface-3)' }}
                  />
                )}
                {/* hour gridlines */}
                {Array.from({ length: SPAN / 60 + 1 }, (_, i) => DAY_START + i * 60).map((m) => (
                  <div
                    key={m}
                    className="absolute inset-y-0 w-px"
                    style={{ left: `${pct(m)}%`, background: 'var(--color-border-subtle)' }}
                  />
                ))}
                {/* selected window */}
                <div
                  className="pointer-events-none absolute inset-y-0"
                  style={{
                    left: `${pct(from)}%`,
                    width: `${((to - from) / SPAN) * 100}%`,
                    background: 'var(--color-brand)',
                    opacity: 0.09,
                    borderLeft: '1px solid var(--color-brand)',
                    borderRight: '1px solid var(--color-brand)',
                  }}
                />
                {/* click-to-book layer */}
                <button
                  aria-label={`Pick a time in ${s.name}`}
                  className="absolute inset-0 cursor-copy"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - r.left) / r.width;
                    const m = Math.round((DAY_START + ratio * SPAN) / 15) * 15;
                    onPickSlot(s.id, m);
                  }}
                />
                {day.map((b) => (
                  <div
                    key={b.id}
                    className="pointer-events-none absolute top-1 bottom-1 overflow-hidden rounded px-1.5"
                    style={{
                      left: `${pct(b.from)}%`,
                      width: `${((b.to - b.from) / SPAN) * 100}%`,
                      background: b.mine ? 'var(--color-status-mine-wash)' : 'var(--color-status-full-wash)',
                      border: `1px solid ${b.mine ? 'var(--color-status-mine)' : 'var(--color-status-full)'}`,
                      color: b.mine ? 'var(--color-status-mine-ink)' : 'var(--color-status-full-ink)',
                    }}
                    title={`${b.title} · ${formatRange(b.from, b.to)} · ${b.owner}`}
                  >
                    <span className="block truncate text-[11px] font-semibold leading-6">{b.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
