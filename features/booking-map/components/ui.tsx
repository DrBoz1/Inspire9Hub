import React from 'react';
import type { Availability } from '../booking/types';

export const STATUS_LABEL: Record<Availability, string> = {
  available: 'Available',
  partial: 'Partly booked',
  booked: 'Fully booked',
  mine: 'Your booking',
  closed: 'Not bookable',
};

export const STATUS_STYLE: Record<Availability, { bg: string; fg: string; dot: string }> = {
  available: {
    bg: 'var(--color-status-available-wash)',
    fg: 'var(--color-status-available-ink)',
    dot: 'var(--color-status-available)',
  },
  partial: {
    bg: 'var(--color-status-partial-wash)',
    fg: 'var(--color-status-partial-ink)',
    dot: 'var(--color-status-partial)',
  },
  booked: {
    bg: 'var(--color-status-full-wash)',
    fg: 'var(--color-status-full-ink)',
    dot: 'var(--color-status-full)',
  },
  mine: {
    bg: 'var(--color-status-mine-wash)',
    fg: 'var(--color-status-mine-ink)',
    dot: 'var(--color-status-mine)',
  },
  closed: { bg: 'var(--color-surface-2)', fg: 'var(--color-ink-500)', dot: 'var(--color-ink-400)' },
};

/** Ordinal texture ladder — none → hatch → cross-hatch — as a CSS background. */
export const STATUS_TEXTURE: Record<Availability, string> = {
  available: 'none',
  partial:
    'repeating-linear-gradient(45deg, rgb(194 116 10 / .5) 0 1px, transparent 1px 6px)',
  booked:
    'repeating-linear-gradient(45deg, rgb(91 102 112 / .45) 0 1px, transparent 1px 6px),' +
    'repeating-linear-gradient(-45deg, rgb(91 102 112 / .45) 0 1px, transparent 1px 6px)',
  mine: 'none',
  closed: 'none',
};

export function StatusPill({ status, children }: { status: Availability; children?: React.ReactNode }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: s.dot }}
      />
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}

/** Legend/list swatch — shows the actual rendered fill *and* its hatch. */
export function StatusSwatch({ status, size = 14 }: { status: Availability; size?: number }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: s.bg,
        backgroundImage: STATUS_TEXTURE[status],
        border: `1px ${status === 'closed' ? 'dashed' : 'solid'} ${s.dot}`,
      }}
    />
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'quiet', size = 'md', className = '', ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-semibold transition-colors ' +
    'disabled:cursor-not-allowed disabled:opacity-55 rounded-md whitespace-nowrap';
  const sizes = size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-10 px-3.5 text-[14px]';
  const variants: Record<string, string> = {
    primary: 'text-white bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] active:bg-[var(--color-brand-press)]',
    ghost:
      'text-[var(--color-brand)] bg-transparent border border-[var(--color-border)] hover:bg-[var(--color-brand-wash)]',
    quiet: 'text-[var(--color-ink-700)] bg-transparent hover:bg-[var(--color-surface-2)]',
    danger: 'text-white bg-[var(--color-danger)] hover:brightness-95',
  };
  return <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest} />;
}

export function Chip({
  active,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      aria-pressed={active}
      className={
        'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[12px] font-semibold ' +
        'border transition-colors whitespace-nowrap ' +
        (active
          ? 'border-[var(--color-brand)] bg-[var(--color-brand-wash)] text-[var(--color-brand)] '
          : 'border-[var(--color-border)] bg-[var(--color-surface-0)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-2)] ') +
        className
      }
      {...rest}
    />
  );
}

export function SrOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
