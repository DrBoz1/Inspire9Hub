'use client';

import React, { useCallback, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { Slider as SliderPrimitive } from 'radix-ui';
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

const SPAN = DAY_END - DAY_START;

/**
 * The scrubbable day rail. Every colour on the map is a function of this window,
 * so it gets its own always-visible band under the app bar and recolours the map
 * live as you drag.
 *
 * The two thumbs are Radix's range slider rather than hand-rolled pointer code.
 * The previous version owned its own capture, clamping and keyboard handling, and
 * carried a bug where the window clamped twice against different bounds and so
 * jumped near the end of the day. Radix makes capture, thumb ordering, step
 * snapping and keyboard support (arrows, Home/End, PageUp/Down) invariants, so
 * that class of bug cannot come back.
 *
 * The scale stays pinned to DAY_START..DAY_END so the hour ticks do not shift
 * between a weekday and a Saturday. Opening hours are enforced in the change
 * handler instead, and drawn as the hatched regions.
 */
export function TimeRail({ date, from, to, onChange, onJumpNow, summary }: Props) {
  const hours = openingFor(date);
  const isToday = date === todayKey();
  const now = nowMinutes();
  const trackRef = useRef<HTMLSpanElement | null>(null);

  const pct = (m: number) => ((m - DAY_START) / SPAN) * 100;

  const lo = hours.open ?? DAY_START;
  const hi = hours.close ?? DAY_END;

  /** One clamp, applied once. Radix already stops the thumbs crossing. */
  const commit = useCallback(
    (a: number, b: number) => {
      const f = Math.max(lo, Math.min(a, hi - SLOT));
      const t = Math.min(hi, Math.max(b, f + SLOT));
      onChange(f, t);
    },
    [hi, lo, onChange],
  );

  // Slide the whole window without resizing it. Radix owns the thumbs, so this
  // lives on a small grip centred between them and the two never contend for the
  // same pointer.
  const onGripDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = to - from;
    const startX = e.clientX;
    const startFrom = from;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const deltaMins = ((ev.clientX - startX) / rect.width) * SPAN;
      const raw = Math.round((startFrom + deltaMins) / SLOT) * SLOT;
      const f = Math.max(lo, Math.min(raw, hi - width));
      onChange(f, f + width);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const hatch =
    'repeating-linear-gradient(45deg, rgb(124 135 148 / .35) 0 1px, transparent 1px 5px)';

  return (
    <div
      className="fp-time-rail flex h-14 shrink-0 items-center gap-2 border-b px-3 @xl:gap-3 @xl:px-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
    >
      <button
        onClick={onJumpNow}
        className="shrink-0 rounded px-2 py-1 text-[12px] font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-2)]"
        title="Jump to now (t)"
      >
        Now
      </button>

      <div className="fp-time-track relative min-w-0 flex-1 select-none py-2">
        <div className="relative h-6">
          <SliderPrimitive.Root
            className="absolute inset-0 flex touch-none items-center select-none"
            value={[from, to]}
            min={DAY_START}
            max={DAY_END}
            step={SLOT}
            minStepsBetweenThumbs={1}
            onValueChange={([a, b]) => commit(a, b)}
          >
            <SliderPrimitive.Track
              ref={trackRef}
              className="relative h-6 w-full grow overflow-hidden rounded"
              style={{ background: 'var(--color-surface-2)' }}
            >
              {/* Closed hours, hatched. Thumbs clamp to them rather than refuse. */}
              {lo > DAY_START && (
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${pct(lo)}%`,
                    backgroundColor: 'var(--color-surface-3)',
                    backgroundImage: hatch,
                  }}
                />
              )}
              {hi < DAY_END && (
                <div
                  className="absolute inset-y-0 right-0"
                  style={{
                    left: `${pct(hi)}%`,
                    backgroundColor: 'var(--color-surface-3)',
                    backgroundImage: hatch,
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

              <SliderPrimitive.Range
                className="absolute inset-y-0 rounded"
                style={{ background: 'var(--color-brand)', opacity: 0.9 }}
              />
            </SliderPrimitive.Track>

            {(['Start time', 'End time'] as const).map((label) => (
              <SliderPrimitive.Thumb
                key={label}
                aria-label={label}
                className="block h-8 w-3 cursor-ew-resize rounded-sm border shadow-sm focus-visible:ring-2 focus-visible:outline-none"
                style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-brand)' }}
              />
            ))}
          </SliderPrimitive.Root>

          {/* Now marker, above the fill and never interactive. */}
          {isToday && now >= DAY_START && now <= DAY_END && (
            <div
              className="pointer-events-none absolute -top-0.5 z-10 h-7 w-0.5"
              style={{ left: `${pct(now)}%`, background: 'var(--color-danger)' }}
              title={`Now · ${formatTime(now)}`}
            />
          )}

          {/* Grip for moving the window whole. Hidden when the window is too short
              for it to sit clear of both thumbs. */}
          {to - from >= 60 && (
            <div
              role="button"
              tabIndex={-1}
              aria-label="Move the time window"
              title="Drag to move the whole window"
              onPointerDown={onGripDown}
              className="absolute top-0 z-20 h-6 w-7 -translate-x-1/2 cursor-grab rounded active:cursor-grabbing"
              style={{ left: `${pct((from + to) / 2)}%` }}
            />
          )}
        </div>

        {/* Tick labels */}
        <div className="pointer-events-none relative mt-0.5 h-3">
          {Array.from({ length: SPAN / 60 + 1 }, (_, i) => DAY_START + i * 60)
            .filter((m) => m % 120 === 0)
            .map((m) => (
              <span
                key={m}
                className={`tnum absolute -translate-x-1/2 text-[10px] font-medium ${
                  m % 240 === 0 ? '' : 'hidden @xl:inline'
                }`}
                style={{ left: `${pct(m)}%`, color: 'var(--color-ink-500)' }}
              >
                {formatTime(m)}
              </span>
            ))}
        </div>
      </div>

      {/* Every value here changes width as the window moves. Reserving space keeps
          the flex-1 track a fixed size, so the rail cannot re-lay-out mid-drag. */}
      <div className="fp-time-summary flex shrink-0 items-center justify-end gap-3">
        <span
          className="tnum inline-block min-w-[9.5rem] whitespace-nowrap text-right text-[13px] font-semibold"
          style={{ color: 'var(--color-ink-900)' }}
        >
          {formatRange(from, to)}
        </span>
        <span
          className="tnum hidden min-w-[5.5rem] rounded px-1.5 py-0.5 text-center text-[12px] font-semibold whitespace-nowrap @xl:inline-block"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-ink-600)' }}
        >
          {formatDuration(to - from)}
        </span>
        <span
          className="hidden min-w-[6.5rem] whitespace-nowrap text-right text-[13px] @5xl:inline-block"
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
