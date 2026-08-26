import React, { useCallback, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  DAY_END, DAY_START, SLOT, formatDuration, formatRange, formatTime, nowMinutes, openingFor,
  todayKey,
} from '../booking/time';

interface Props {
  date: string;
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
  onJumpNow: () => void;
  /** Right-hand slot copy, e.g. "24 of 63 available". */
  summary: React.ReactNode;
}

type Drag = { mode: 'from' | 'to' | 'move'; grabOffset: number } | null;

const SPAN = DAY_END - DAY_START;

/**
 * The scrubbable day rail. Every colour on the map is a function of this
 * window, so it gets its own always-visible band directly under the app bar
 * (spec §4.7) and recolours the map live as you drag.
 */
export function TimeRail({ date, from, to, onChange, onJumpNow, summary }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const hours = openingFor(date);
  const isToday = date === todayKey();
  const now = nowMinutes();

  const pct = (m: number) => ((m - DAY_START) / SPAN) * 100;

  const minsAt = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return DAY_START;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round((DAY_START + ratio * SPAN) / SLOT) * SLOT;
  }, []);

  const clampWindow = useCallback(
    (a: number, b: number) => {
      const lo = hours.open ?? DAY_START;
      const hi = hours.close ?? DAY_END;
      let f = Math.max(lo, Math.min(a, hi - SLOT));
      let t = Math.min(hi, Math.max(b, f + SLOT));
      if (t - f < SLOT) t = f + SLOT;
      return [f, t] as const;
    },
    [hours.close, hours.open],
  );

  const onPointerDown = (mode: 'from' | 'to' | 'move') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ mode, grabOffset: minsAt(e.clientX) - (mode === 'to' ? to : from) });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const m = minsAt(e.clientX);
    if (drag.mode === 'from') {
      const [f, t] = clampWindow(Math.min(m, to - SLOT), to);
      onChange(f, t);
    } else if (drag.mode === 'to') {
      const [f, t] = clampWindow(from, Math.max(m, from + SLOT));
      onChange(f, t);
    } else {
      // Slide the whole window, keeping its length. This used to clamp twice --
      // clampWindow pins the start against `hi - SLOT`, then the line below
      // pinned it again against `hi - width`. With a window longer than one slot
      // the two disagree, so dragging near the end of the day snapped the window
      // to one bound and then the other: the jump you can see. One clamp only.
      const width = to - from;
      const lo = hours.open ?? DAY_START;
      const hi = hours.close ?? DAY_END;
      const nf = Math.max(lo, Math.min(m - drag.grabOffset, hi - width));
      onChange(nf, nf + width);
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    setDrag(null);
  };

  const nudge = (which: 'from' | 'to', delta: number) => {
    if (which === 'from') {
      const [f, t] = clampWindow(Math.min(from + delta, to - SLOT), to);
      onChange(f, t);
    } else {
      const [f, t] = clampWindow(from, Math.max(to + delta, from + SLOT));
      onChange(f, t);
    }
  };

  const handleKey = (which: 'from' | 'to') => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 60 : SLOT;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); nudge(which, -step); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); nudge(which, step); }
  };

  const closedBefore = hours.open !== null ? Math.max(DAY_START, hours.open) : DAY_END;
  const closedAfter = hours.close !== null ? Math.min(DAY_END, hours.close) : DAY_START;

  return (
    <div
      className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
    >
      <button
        onClick={onJumpNow}
        className="shrink-0 rounded px-2 py-1 text-[12px] font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-2)]"
        title="Jump to now (t)"
      >
        Now
      </button>

      <div className="relative min-w-0 flex-1 select-none py-2">
        <div
          ref={trackRef}
          className="relative h-6 cursor-pointer rounded"
          style={{ background: 'var(--color-surface-2)' }}
          onPointerDown={(e) => {
            const m = minsAt(e.clientX);
            const width = to - from;
            const [f] = clampWindow(m - width / 2, m + width / 2);
            const lo = hours.open ?? DAY_START;
            const hi = hours.close ?? DAY_END;
            const nf = Math.max(lo, Math.min(f, hi - width));
            onChange(nf, nf + width);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* Closed hours: hatched, and the handles clamp rather than refuse. */}
          {closedBefore > DAY_START && (
            <div
              className="absolute inset-y-0 left-0 rounded-l"
              style={{
                width: `${pct(closedBefore)}%`,
                backgroundColor: 'var(--color-surface-3)',
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgb(124 135 148 / .35) 0 1px, transparent 1px 5px)',
              }}
            />
          )}
          {closedAfter < DAY_END && (
            <div
              className="absolute inset-y-0 right-0 rounded-r"
              style={{
                left: `${pct(closedAfter)}%`,
                backgroundColor: 'var(--color-surface-3)',
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgb(124 135 148 / .35) 0 1px, transparent 1px 5px)',
              }}
            />
          )}

          {/* Hour ticks */}
          {Array.from({ length: SPAN / 60 + 1 }, (_, i) => DAY_START + i * 60).map((m) => (
            <div
              key={m}
              className="absolute top-0 h-full"
              style={{ left: `${pct(m)}%`, width: 1, background: 'var(--color-border)' }}
            />
          ))}

          {isToday && now >= DAY_START && now <= DAY_END && (
            <div
              className="absolute -top-0.5 h-7 w-0.5"
              style={{ left: `${pct(now)}%`, background: 'var(--color-danger)' }}
              title={`Now · ${formatTime(now)}`}
            />
          )}

          {/* Selected window */}
          <div
            className="absolute inset-y-0 cursor-grab active:cursor-grabbing rounded"
            style={{
              left: `${pct(from)}%`,
              width: `${((to - from) / SPAN) * 100}%`,
              background: 'var(--color-brand)',
              opacity: 0.9,
            }}
            onPointerDown={onPointerDown('move')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />

          {(['from', 'to'] as const).map((which) => {
            const m = which === 'from' ? from : to;
            return (
              <div
                key={which}
                role="slider"
                tabIndex={0}
                aria-label={which === 'from' ? 'Start time' : 'End time'}
                aria-valuemin={hours.open ?? DAY_START}
                aria-valuemax={hours.close ?? DAY_END}
                aria-valuenow={m}
                aria-valuetext={formatTime(m)}
                onKeyDown={handleKey(which)}
                onPointerDown={onPointerDown(which)}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="absolute -top-1 h-8 w-3 -translate-x-1/2 cursor-ew-resize rounded-sm border shadow-sm"
                style={{
                  left: `${pct(m)}%`,
                  background: 'var(--color-surface-0)',
                  borderColor: 'var(--color-brand)',
                }}
              />
            );
          })}
        </div>

        {/* Tick labels */}
        <div className="pointer-events-none relative mt-0.5 h-3">
          {Array.from({ length: SPAN / 60 + 1 }, (_, i) => DAY_START + i * 60)
            .filter((m) => m % 120 === 0)
            .map((m) => (
              <span
                key={m}
                className={`tnum absolute -translate-x-1/2 text-[10px] font-medium ${
                  m % 240 === 0 ? '' : 'hidden sm:inline'
                }`}
                style={{ left: `${pct(m)}%`, color: 'var(--color-ink-500)' }}
              >
                {formatTime(m)}
              </span>
            ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-3">
        <span
          className="tnum inline-block min-w-[9.5rem] whitespace-nowrap text-right text-[13px] font-semibold"
          style={{ color: 'var(--color-ink-900)' }}
        >
          {formatRange(from, to)}
        </span>
        <span
          className="tnum hidden min-w-[5.5rem] rounded px-1.5 py-0.5 text-center text-[12px] font-semibold whitespace-nowrap sm:inline-block"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-ink-600)' }}
        >
          {formatDuration(to - from)}
        </span>
        <span
          className="hidden min-w-[6.5rem] whitespace-nowrap text-right text-[13px] xl:inline-block"
          style={{ color: 'var(--color-ink-500)' }}
        >
          {summary}
        </span>
        <button
          onClick={onJumpNow}
          title="Reset to the next hour"
          aria-label="Reset the time window"
          className="rounded p-1.5 text-[var(--color-ink-500)] hover:bg-[var(--color-surface-2)]"
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );
}
