import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Availability } from '../booking/types';
import { StatusSwatch, STATUS_LABEL } from './ui';

const ORDER: Availability[] = ['available', 'partial', 'booked', 'mine', 'closed'];
const STORE_KEY = 'i9.legend.open';

interface Props {
  counts: Record<Availability, number>;
  hidden: Availability[];
  onToggle: (s: Availability) => void;
}

/**
 * Skedda's legend is inert decoration. Ours is the fastest filter in the
 * product: every row toggles, and the counts follow the selected window.
 */
export function Legend({ counts, hidden, onToggle }: Props) {
  // Collapsed by default: the map column is only ~800 px tall at 900 px
  // viewport height, and an open legend would sit over real bookable spaces.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORE_KEY);
      if (v !== null) setOpen(v === '1');
    } catch {
      /* storage unavailable — keep the default */
    }
  }, []);

  const setOpenPersisted = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem(STORE_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="w-52 overflow-hidden rounded-lg border"
      style={{
        background: 'var(--color-surface-0)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-e1)',
      }}
    >
      <button
        onClick={() => setOpenPersisted(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-2.5 py-1.5"
      >
        <span className="eyebrow">Legend</span>
        {open ? (
          <ChevronDown size={14} aria-hidden style={{ color: 'var(--color-ink-500)' }} />
        ) : (
          <ChevronUp size={14} aria-hidden style={{ color: 'var(--color-ink-500)' }} />
        )}
      </button>

      {open && (
        <>
          <ul className="border-t pb-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {ORDER.map((s) => {
              const off = hidden.includes(s);
              return (
                <li key={s}>
                  <button
                    onClick={() => onToggle(s)}
                    aria-pressed={!off}
                    title={off ? `Show ${STATUS_LABEL[s].toLowerCase()}` : `Hide ${STATUS_LABEL[s].toLowerCase()}`}
                    className="flex w-full items-center gap-2 px-2.5 py-1 text-left hover:bg-[var(--color-surface-2)]"
                  >
                    <StatusSwatch status={s} />
                    <span
                      className="flex-1 text-[12px]"
                      style={{
                        color: off ? 'var(--color-ink-400)' : 'var(--color-ink-700)',
                        textDecoration: off ? 'line-through' : undefined,
                      }}
                    >
                      {STATUS_LABEL[s]}
                    </span>
                    <span
                      className="tnum text-[12px] font-semibold"
                      style={{ color: off ? 'var(--color-ink-300)' : 'var(--color-ink-500)' }}
                    >
                      {counts[s]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div
            className="border-t px-2.5 py-1.5"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            {([
              ['Hot desk zone', 'var(--color-zone-hotdesk-key)'],
              ['Open lounges', 'var(--color-zone-lounge-key)'],
            ] as const).map(([label, color]) => (
              <div key={label} className="flex items-center gap-2 py-0.5">
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 rounded-full border"
                  style={{ background: color, borderColor: 'var(--color-ink-400)' }}
                />
                <span className="text-[12px]" style={{ color: 'var(--color-ink-500)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
