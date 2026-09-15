import type { ReactNode } from "react";

export type AdminColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** The row's title. Spans the full card on narrow screens. */
  primary?: boolean;
  /** Right-aligned on wide screens; a full-width row (e.g. actions) on narrow ones. */
  align?: "start" | "end";
  hideOnMobile?: boolean;
};

/**
 * A real table when there's room, labelled cards when there isn't. It responds to
 * the width of its container, not the screen, so it works inside narrow panels too.
 */
export function AdminDataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
}: {
  caption: string;
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <>{empty ?? null}</>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" data-align={c.align}>
                {c.header || <span className="sr-only">{c.key}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  data-label={c.header}
                  data-primary={c.primary || undefined}
                  data-align={c.align}
                  data-hide-mobile={c.hideOnMobile || undefined}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
