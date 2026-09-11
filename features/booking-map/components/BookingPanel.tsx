import React, { useMemo, useState } from 'react';
import {
  AlertCircle, Building2, Check, Clock, DoorClosed, GraduationCap, LayoutGrid, Minus, Phone,
  Plus, Presentation, Sofa, Users, X,
} from 'lucide-react';
import type { Availability, Booking, Space, SpaceKind } from '../booking/types';
import { AMENITY_LABELS } from '../data/spaces';
import {
  bookingsOnDay, formatDateLong, formatDuration, formatRange, formatTime, nextAvailableStart,
  splitISO, todayKey, validateBooking, SLOT,
} from '../booking/time';
import { Button, StatusPill } from './ui';

const KIND_ICON: Record<SpaceKind, React.ComponentType<{ size?: number }>> = {
  desk: LayoutGrid,
  workpoint: LayoutGrid,
  collab_table: Users,
  lounge_pod: Sofa,
  team_bay: Users,
  phone_booth: Phone,
  meeting_room: Presentation,
  boardroom: Presentation,
  training_room: GraduationCap,
  private_office: DoorClosed,
  amenity: Building2,
};

interface Props {
  space: Space;
  status: Availability;
  date: string;
  from: number;
  to: number;
  bookings: Booking[];
  memberName: string;
  /** Off until booking from the plan goes through the real checkout. When off, the
   *  panel points to the Bookings page instead of faking a booking. */
  bookingEnabled: boolean;
  onClose: () => void;
  onChangeWindow: (from: number, to: number) => void;
  onBook: (space: Space, title: string) => void;
  onCancel: (bookingId: string) => void;
  /** Set after a successful booking so the panel can confirm in place. */
  justBooked: Booking | null;
  onDismissConfirmation: () => void;
  /** 'rail' docks beside the map; 'sheet' is the mobile bottom sheet. */
  variant?: 'rail' | 'sheet';
}

export function BookingPanel({
  space, status, date, from, to, bookings, memberName, bookingEnabled,
  onClose, onChangeWindow, onBook, onCancel, justBooked, onDismissConfirmation,
  variant = 'rail',
}: Props) {
  const [title, setTitle] = useState('');
  const Icon = KIND_ICON[space.kind];

  const dayBookings = useMemo(
    () => bookingsOnDay(bookings, space.id, date),
    [bookings, date, space.id],
  );

  const error = useMemo(
    () => (space.bookable ? validateBooking(space, bookings, { date, from, to }) : null),
    [bookings, date, from, space, to],
  );

  const nextStart = useMemo(() => {
    if (!space.bookable || !error) return null;
    return nextAvailableStart(space, bookings, date, to - from, from);
  }, [bookings, date, error, from, space, to]);

  const myBooking = dayBookings.find((b) => b.mine && b.from < to && from < b.to);

  const duration = to - from;
  const step = space.minMinutes && space.minMinutes >= 60 ? 30 : SLOT;

  if (justBooked) {
    return (
      <PanelShell onClose={onClose} space={space} status="mine" Icon={Icon} variant={variant}>
        <div className="p-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'var(--color-status-mine-wash)', color: 'var(--color-status-mine-ink)' }}
          >
            <Check size={20} aria-hidden />
          </div>
          <h3 className="mt-3 text-[20px] font-semibold" style={{ color: 'var(--color-ink-900)' }}>
            Booked
          </h3>
          <p className="mt-1 text-[14px]" style={{ color: 'var(--color-ink-700)' }}>
            {space.name} · {formatDateLong(date)} ·{' '}
            <span className="tnum">
              {formatRange(splitISO(justBooked.start).mins, splitISO(justBooked.end).mins)}
            </span>
          </p>
          <p className="mt-3 text-[13px]" style={{ color: 'var(--color-ink-500)' }}>
            It is on the map now, ticked and in your colour.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={onDismissConfirmation}>
              Done
            </Button>
            <Button variant="ghost" onClick={() => onCancel(justBooked.id)}>
              Cancel booking
            </Button>
          </div>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell onClose={onClose} space={space} status={status} Icon={Icon} variant={variant}>
      <div className="i9-scroll min-h-0 flex-1 overflow-y-auto">
        {error && error.code === 'conflict' && (
          <div
            className="m-3 rounded-md p-3"
            style={{ background: 'var(--color-danger-wash)', borderLeft: '3px solid var(--color-danger)' }}
          >
            <p
              className="flex items-center gap-1.5 text-[14px] font-semibold"
              style={{ color: 'var(--color-danger-ink)' }}
            >
              <AlertCircle size={16} aria-hidden />
              Already taken
            </p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--color-ink-700)' }}>
              {error.message}
            </p>
            {nextStart !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => onChangeWindow(nextStart, nextStart + duration)}
              >
                Jump to {formatTime(nextStart)}
              </Button>
            )}
          </div>
        )}
        {error && error.code !== 'conflict' && (
          <div
            className="m-3 rounded-md p-3"
            style={{ background: 'var(--color-warn-wash)', borderLeft: '3px solid var(--color-warn-ink)' }}
          >
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-warn-ink)' }}>
              {error.message}
            </p>
            {error.code === 'too_long' && space.maxMinutes && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => onChangeWindow(from, from + space.maxMinutes!)}
              >
                Set to {formatDuration(space.maxMinutes)}
              </Button>
            )}
            {error.code === 'too_short' && space.minMinutes && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => onChangeWindow(from, from + space.minMinutes!)}
              >
                Set to {formatDuration(space.minMinutes)}
              </Button>
            )}
          </div>
        )}

        <div className="px-4 py-3">
          <p className="text-[13px]" style={{ color: 'var(--color-ink-700)' }}>
            {space.description}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
            <Meta label="Capacity" value={`${space.capacity} ${space.capacity === 1 ? 'person' : 'people'}`} />
            <Meta label="Zone" value={space.zone} />
            <Meta label="Reference" value={space.code} mono />
            <Meta
              label="Rate"
              value={space.ratePerHour ? `$${space.ratePerHour}/hr` : 'Included'}
            />
          </dl>
        </div>

        {space.amenities.length > 0 && (
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="eyebrow">In this space</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {space.amenities.map((a) => (
                <li
                  key={a}
                  className="rounded border px-1.5 py-0.5 text-[12px]"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
                >
                  {AMENITY_LABELS[a]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {space.bookable && (
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="eyebrow">When</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Clock size={15} aria-hidden style={{ color: 'var(--color-ink-500)' }} />
              <span className="tnum text-[15px] font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                {formatRange(from, to)}
              </span>
              <div
                className="ml-auto flex items-center rounded-md border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <button
                  aria-label="Shorten booking"
                  onClick={() => onChangeWindow(from, Math.max(from + SLOT, to - step))}
                  className="px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
                  style={{ color: 'var(--color-ink-600)' }}
                >
                  <Minus size={14} />
                </button>
                <span
                  className="tnum w-16 text-center text-[13px] font-semibold"
                  style={{ color: 'var(--color-ink-700)' }}
                >
                  {formatDuration(duration)}
                </span>
                <button
                  aria-label="Lengthen booking"
                  onClick={() => onChangeWindow(from, to + step)}
                  className="px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
                  style={{ color: 'var(--color-ink-600)' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="eyebrow">Booking title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={space.kind === 'desk' ? 'Desk booking' : 'Team meeting'}
                className="mt-1 h-9 w-full rounded-md border px-2.5 text-[14px] outline-none focus:border-[var(--color-border-strong)]"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
              />
            </label>
          </div>
        )}

        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <p className="eyebrow">{formatDateLong(date)}</p>
          {dayBookings.length === 0 ? (
            <p className="mt-1.5 text-[13px]" style={{ color: 'var(--color-ink-500)' }}>
              Nothing booked all day.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {dayBookings.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-[13px]">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: b.mine ? 'var(--color-status-mine)' : 'var(--color-status-full)',
                    }}
                  />
                  <span className="tnum shrink-0" style={{ color: 'var(--color-ink-600)' }}>
                    {formatRange(b.from, b.to)}
                  </span>
                  <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--color-ink-700)' }}>
                    {b.title}
                  </span>
                  {b.mine && (
                    <button
                      onClick={() => onCancel(b.id)}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[12px] font-semibold hover:bg-[var(--color-danger-wash)]"
                      style={{ color: 'var(--color-danger-ink)' }}
                    >
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {space.unlinked && (
        <div
          className="shrink-0 border-t p-3"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
        >
          <p className="text-[12.5px] leading-5" style={{ color: 'var(--color-ink-600)' }}>
            {space.name} isn’t open for booking yet.{' '}
            <a href="/bookings" className="font-semibold underline underline-offset-2" style={{ color: 'var(--color-brand)' }}>
              See rooms you can book
            </a>
          </p>
        </div>
      )}

      {space.bookable && (
        <div
          className="shrink-0 border-t p-3"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-0)' }}
        >
          {!bookingEnabled ? (
            <div
              className="rounded-md px-3 py-2.5 text-[12.5px] leading-5"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-ink-600)' }}
              role="status"
            >
              {myBooking
                ? `You have ${space.name} booked ${formatRange(myBooking.from, myBooking.to)}.`
                : error
                  ? error.message
                  : `Free for ${formatDuration(duration)}. Booking straight from the floor plan is switched on in the next update.`}{' '}
              <a href="/bookings" className="font-semibold underline underline-offset-2" style={{ color: 'var(--color-brand)' }}>
                {myBooking ? 'Manage it in Bookings' : 'Book from Bookings'}
              </a>
            </div>
          ) : myBooking ? (
            <Button variant="ghost" className="w-full" onClick={() => onCancel(myBooking.id)}>
              Cancel your {formatRange(myBooking.from, myBooking.to)} booking
            </Button>
          ) : (
            <>
              {/* The full explanation sits at the top of the panel, which scrolls out
                  of view by the time you reach this button. Without a reason here a
                  disabled "Unavailable" just reads as a broken button. */}
              {error && (
                <p
                  className="mb-2 text-center text-[12px] font-medium"
                  style={{ color: 'var(--color-danger-ink)' }}
                  role="status"
                >
                  {error.message}
                </p>
              )}
              <Button
                variant="primary"
                className="w-full"
                disabled={!!error}
                onClick={() => onBook(space, title.trim() || (space.kind === 'desk' ? 'Desk booking' : 'Booking'))}
              >
                {error ? 'Unavailable' : `Book · ${formatDuration(duration)}`}
              </Button>
            </>
          )}
          {bookingEnabled && (
            <p className="mt-1.5 text-center text-[12px]" style={{ color: 'var(--color-ink-500)' }}>
              Booking as {memberName}
              {date === todayKey() ? '' : ` for ${formatDateLong(date)}`}
            </p>
          )}
        </div>
      )}
    </PanelShell>
  );
}

function PanelShell({
  space, status, Icon, onClose, children, variant,
}: {
  space: Space;
  status: Availability;
  Icon: React.ComponentType<{ size?: number }>;
  onClose: () => void;
  children: React.ReactNode;
  variant: 'rail' | 'sheet';
}) {
  const sheet = variant === 'sheet';
  return (
    <aside
      className={
        sheet
          ? 'pointer-events-auto flex max-h-full w-full flex-col rounded-t-xl border-t'
          : 'flex h-full w-[380px] shrink-0 flex-col border-l'
      }
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface-0)',
        boxShadow: sheet ? 'var(--shadow-e4)' : undefined,
      }}
      aria-label={`${space.name} details`}
    >
      {sheet && (
        <div className="flex justify-center pt-2" aria-hidden>
          <span className="h-1 w-9 rounded-full" style={{ background: 'var(--color-border-strong)' }} />
        </div>
      )}
      <div
        className="flex shrink-0 items-start gap-2.5 border-b p-3"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <span
          aria-hidden
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md"
          style={{
            background: `var(--color-cat-${space.kind}-wash, var(--color-surface-2))`,
            color: `var(--color-cat-${space.kind}-ink, var(--color-ink-600))`,
          }}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-[20px] font-semibold leading-tight"
            style={{ color: 'var(--color-ink-900)' }}
            tabIndex={-1}
          >
            {space.name}
          </h2>
          <div className="mt-1">
            <StatusPill status={status} />
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="rounded p-1.5 hover:bg-[var(--color-surface-2)]"
          style={{ color: 'var(--color-ink-500)' }}
        >
          <X size={16} />
        </button>
      </div>
      {children}
    </aside>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd
        className="mt-0.5 text-[13px] font-medium"
        style={{
          color: 'var(--color-ink-700)',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
        }}
      >
        {value}
      </dd>
    </div>
  );
}
