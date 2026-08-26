
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { addDays, formatDateLong, formatDateShort, relativeDay, todayKey } from '../booking/time';

export type ViewMode = 'map' | 'schedule';

interface Props {
  date: string;
  onDateChange: (d: string) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  memberName: string;
}

export function TopBar({ date, onDateChange, view, onViewChange, memberName }: Props) {
  const rel = relativeDay(date);
  return (
    <header
      className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-4 sm:px-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold text-white"
          style={{ background: 'var(--color-brand)' }}
        >
          i9
        </span>
        <span
          className="hidden truncate text-[15px] font-semibold sm:inline"
          style={{ color: 'var(--color-ink-900)' }}
        >
          Inspire9
        </span>
        <span aria-hidden className="hidden lg:inline" style={{ color: 'var(--color-ink-300)' }}>
          /
        </span>
        <span
          className="hidden truncate text-[14px] lg:inline"
          style={{ color: 'var(--color-ink-500)' }}
        >
          Level 1 · Cremorne
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          aria-label="Previous day"
          onClick={() => onDateChange(addDays(date, -1))}
          className="rounded p-1.5 hover:bg-[var(--color-surface-2)]"
          style={{ color: 'var(--color-ink-600)' }}
        >
          <ChevronLeft size={18} />
        </button>
        <div
          className="flex h-9 items-center gap-2 rounded-md border px-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <CalendarDays size={15} aria-hidden style={{ color: 'var(--color-ink-500)' }} />
          <span
            className="whitespace-nowrap text-[14px] font-semibold"
            style={{ color: 'var(--color-ink-900)' }}
          >
            <span className="hidden sm:inline">{rel ? `${rel} · ` : ''}</span>
            {formatDateShort(date)}
            <span className="hidden sm:inline">{formatDateLong(date).slice(formatDateShort(date).length)}</span>
          </span>
          <input
            type="date"
            aria-label="Pick a date"
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="w-5 cursor-pointer bg-transparent text-transparent outline-none"
            style={{ colorScheme: 'light' }}
          />
        </div>
        <button
          aria-label="Next day"
          onClick={() => onDateChange(addDays(date, 1))}
          className="rounded p-1.5 hover:bg-[var(--color-surface-2)]"
          style={{ color: 'var(--color-ink-600)' }}
        >
          <ChevronRight size={18} />
        </button>
        {date !== todayKey() && (
          <button
            onClick={() => onDateChange(todayKey())}
            className="ml-1 hidden rounded px-2 py-1 text-[12px] font-semibold hover:bg-[var(--color-surface-2)] md:block"
            style={{ color: 'var(--color-brand)' }}
          >
            Today
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        <div
          role="tablist"
          aria-label="View"
          className="flex items-center rounded-md border p-0.5"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {([
            ['map', 'Map', MapIcon],
            ['schedule', 'Schedule', LayoutGrid],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => onViewChange(id)}
              className="flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-semibold transition-colors"
              style={
                view === id
                  ? { background: 'var(--color-brand-wash)', color: 'var(--color-brand)' }
                  : { color: 'var(--color-ink-500)' }
              }
            >
              <Icon size={14} aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <div
          className="hidden h-8 items-center gap-2 rounded-full border px-2.5 xl:flex"
          style={{ borderColor: 'var(--color-border)' }}
          title={memberName}
        >
          <span
            aria-hidden
            className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white"
            style={{ background: 'var(--color-ink-600)' }}
          >
            {memberName.slice(0, 1)}
          </span>
          <span className="text-[13px]" style={{ color: 'var(--color-ink-600)' }}>
            {memberName}
          </span>
        </div>
      </div>
    </header>
  );
}
