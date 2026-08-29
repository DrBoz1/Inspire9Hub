import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Amenity, Availability, Space, SpaceGroup, SpaceKind } from '../booking/types';
import { AMENITY_LABELS, GROUP_META, KIND_META } from '../data/spaces';
import { Button, Chip, StatusSwatch, STATUS_LABEL } from './ui';

export interface Filters {
  q: string;
  groups: SpaceGroup[];
  minCapacity: number;
  amenities: Amenity[];
  statuses: Availability[];
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  groups: [],
  minCapacity: 0,
  amenities: [],
  statuses: [],
};

interface Props {
  spaces: Space[];
  matching: Space[];
  status: Map<string, Availability>;
  subline: Map<string, string>;
  filters: Filters;
  onFilters: (f: Filters) => void;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  /** Rendered above the count line. The legend lives here when the sidebar is
      open, instead of floating over the drawing. */
  footer?: React.ReactNode;
}

// Canonical keys (lib/constants.ts). Previously the map's own vocabulary, which
// no space will carry once these come from the database.
const FILTER_AMENITIES: Amenity[] = [
  'whiteboard', 'projector', 'video_conf', 'tv', 'standing', 'monitor', 'accessible', 'quiet',
];

export function Sidebar({
  spaces, matching, status, subline, filters, onFilters,
  selectedId, hoveredId, onSelect, onHover, searchRef, footer}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const grouped = useMemo(() => {
    const byKind = new Map<SpaceKind, Space[]>();
    for (const s of matching) {
      const arr = byKind.get(s.kind) ?? [];
      arr.push(s);
      byKind.set(s.kind, arr);
    }
    const order: SpaceKind[] = [
      'meeting_room', 'boardroom', 'training_room', 'private_office', 'phone_booth',
      'team_bay', 'workpoint', 'lounge_pod', 'collab_table', 'desk', 'amenity',
    ];
    return order.filter((k) => byKind.has(k)).map((k) => [k, byKind.get(k)!] as const);
  }, [matching]);

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const activeCount =
    filters.groups.length +
    filters.amenities.length +
    filters.statuses.length +
    (filters.minCapacity > 0 ? 1 : 0) +
    (filters.q ? 1 : 0);

  const bookableMatches = matching.filter((s) => s.bookable).length;

  return (
    <aside
      className="flex h-full w-80 shrink-0 flex-col border-r"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-1)' }}
    >
      <div className="shrink-0 border-b p-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <div className="relative">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-ink-500)' }}
          />
          <input
            ref={searchRef}
            type="search"
            value={filters.q}
            onChange={(e) => onFilters({ ...filters, q: e.target.value })}
            placeholder="Search spaces, codes, amenities"
            aria-label="Search spaces"
            className="h-9 w-full rounded-md border pl-8 pr-8 text-[14px] outline-none placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-border-strong)]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
          />
          {filters.q && (
            <button
              aria-label="Clear search"
              onClick={() => onFilters({ ...filters, q: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-[var(--color-surface-2)]"
              style={{ color: 'var(--color-ink-500)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip active={filters.groups.length === 0} onClick={() => onFilters({ ...filters, groups: [] })}>
            All
          </Chip>
          {(Object.keys(GROUP_META) as SpaceGroup[]).map((g) => (
            <Chip
              key={g}
              active={filters.groups.includes(g)}
              onClick={() => onFilters({ ...filters, groups: toggle(filters.groups, g) })}
            >
              {GROUP_META[g].label}
            </Chip>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[12px] font-semibold hover:bg-[var(--color-surface-2)]"
            style={{ color: 'var(--color-ink-600)' }}
          >
            <SlidersHorizontal size={13} aria-hidden />
            Capacity & amenities
          </button>
          {activeCount > 0 && (
            <button
              onClick={() => onFilters(EMPTY_FILTERS)}
              className="rounded px-1.5 py-0.5 text-[12px] font-semibold hover:bg-[var(--color-brand-wash)]"
              style={{ color: 'var(--color-brand)' }}
            >
              Clear ({activeCount})
            </button>
          )}
        </div>

        {showAdvanced && (
          <div className="mt-2.5 space-y-2.5">
            <label className="block">
              <span className="eyebrow">Seats at least</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={filters.minCapacity}
                  onChange={(e) => onFilters({ ...filters, minCapacity: Number(e.target.value) })}
                  className="h-1 flex-1 accent-[var(--color-brand)]"
                  aria-label="Minimum capacity"
                />
                <span
                  className="tnum w-8 text-right text-[13px] font-semibold"
                  style={{ color: 'var(--color-ink-700)' }}
                >
                  {filters.minCapacity || 'Any'}
                </span>
              </div>
            </label>
            <div>
              <span className="eyebrow">Amenities</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {FILTER_AMENITIES.map((a) => (
                  <Chip
                    key={a}
                    active={filters.amenities.includes(a)}
                    onClick={() => onFilters({ ...filters, amenities: toggle(filters.amenities, a) })}
                  >
                    {AMENITY_LABELS[a]}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="i9-scroll min-h-0 flex-1 overflow-y-auto">
        {bookableMatches === 0 ? (
          <div className="px-6 py-10 text-center">
            <div
              aria-hidden
              className="mx-auto h-12 w-12"
              style={{
                border: '1px solid var(--color-ink-300)',
                backgroundImage:
                  'repeating-linear-gradient(45deg, var(--color-ink-200) 0 1px, transparent 1px 6px),' +
                  'repeating-linear-gradient(-45deg, var(--color-ink-200) 0 1px, transparent 1px 6px)',
              }}
            />
            <p className="mt-3 text-[15px] font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              No spaces match these filters
            </p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--color-ink-500)' }}>
              Try a shorter booking, a smaller group, or clear a filter.
            </p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => onFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          </div>
        ) : (
          grouped.map(([kind, list]) => (
            <section key={kind}>
              <h2
                className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5"
                style={{ background: 'var(--color-surface-1)' }}
              >
                <span className="eyebrow">{KIND_META[kind].plural}</span>
                <span className="tnum text-[11px] font-semibold" style={{ color: 'var(--color-ink-400)' }}>
                  {list.length}
                </span>
              </h2>
              <ul>
                {list.map((s) => {
                  const st = s.bookable ? status.get(s.id) ?? 'available' : 'closed';
                  const isSel = selectedId === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => onSelect(s.id)}
                        onPointerEnter={() => onHover(s.id)}
                        onPointerLeave={() => onHover(null)}
                        onFocus={() => onHover(s.id)}
                        onBlur={() => onHover(null)}
                        aria-current={isSel}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
                        style={{
                          background: isSel
                            ? 'var(--color-brand-wash)'
                            : hoveredId === s.id
                              ? 'var(--color-surface-2)'
                              : 'transparent',
                          boxShadow: isSel ? 'inset 2px 0 0 var(--color-brand)' : undefined,
                        }}
                      >
                        <StatusSwatch status={st} />
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate text-[14px] font-semibold"
                            style={{ color: 'var(--color-ink-900)' }}
                          >
                            {s.name}
                          </span>
                          <span
                            className="tnum block truncate text-[12px]"
                            style={{ color: 'var(--color-ink-500)' }}
                          >
                            {s.bookable
                              ? `${s.capacity} ${s.capacity === 1 ? 'seat' : 'seats'} · ${subline.get(s.id) ?? STATUS_LABEL[st]}`
                              : 'Not bookable'}
                          </span>
                        </span>
                        <span
                          className="shrink-0 text-[11px] font-medium"
                          style={{ color: 'var(--color-ink-400)', fontFamily: 'var(--font-mono)' }}
                        >
                          {s.code}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {footer && (
        <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {footer}
        </div>
      )}

      <div
        className="shrink-0 border-t px-3 py-2 text-[12px]"
        style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-ink-500)' }}
      >
        Showing <span className="tnum font-semibold">{bookableMatches}</span> of{' '}
        <span className="tnum">{spaces.filter((s) => s.bookable).length}</span> bookable spaces
      </div>
    </aside>
  );
}
