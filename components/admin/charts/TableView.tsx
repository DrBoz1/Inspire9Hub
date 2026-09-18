import type { ReactNode } from "react";

/** The table twin every chart carries, collapsed until asked for. */
export function TableView({ children, label, summary = "Show as table" }: { children: ReactNode; label: string; summary?: string }) {
  return (
    <details className="admin-table-view">
      <summary>{summary}</summary>
      {/* Focusable because it scrolls: a keyboard can only scroll what it can reach. */}
      <div className="admin-table-view-body" tabIndex={0} role="region" aria-label={label}>{children}</div>
    </details>
  );
}
