"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="admin-toolbar">{children}</div>;
}

export function AdminSearch({
  label,
  value,
  onChange,
  placeholder = "Search",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="hub-search admin-search">
      <Search size={15} aria-hidden />
      <span className="sr-only">{label}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search">
          <X size={14} aria-hidden />
        </button>
      )}
    </label>
  );
}

export type AdminSegment<T extends string> = { value: T; label: string; count?: number; href?: string };

/** Filter pills. Give options an `href` to filter through the URL, or handle `onChange` locally. */
export function AdminSegmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: AdminSegment<T>[];
  value: T;
  onChange?: (value: T) => void;
}) {
  return (
    <div className="admin-segmented" role="group" aria-label={label}>
      {options.map((option) => {
        const content = (
          <>
            {option.label}
            {option.count !== undefined && <small>{option.count}</small>}
          </>
        );
        return option.href ? (
          <Link key={option.value} href={option.href} scroll={false} aria-current={option.value === value ? "page" : undefined}>
            {content}
          </Link>
        ) : (
          <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange?.(option.value)}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
