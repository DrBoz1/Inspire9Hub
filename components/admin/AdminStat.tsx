import Link from "next/link";
import type { ReactNode } from "react";

export type AdminTone = "neutral" | "red" | "green" | "amber";

export function AdminStats({ label, children }: { label: string; children: ReactNode }) {
  return <section className="admin-stats" aria-label={label}>{children}</section>;
}

export function AdminStat({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: AdminTone;
  href?: string;
}) {
  const body = (
    <>
      <span className="admin-stat-top">
        <span className="hub-eyebrow">{label}</span>
        {icon && <span className="admin-stat-icon" aria-hidden>{icon}</span>}
      </span>
      <strong className="admin-stat-value">{value}</strong>
      {hint && <span className="admin-stat-hint">{hint}</span>}
    </>
  );
  return href
    ? <Link href={href} className="hub-surface admin-stat" data-tone={tone}>{body}</Link>
    : <div className="hub-surface admin-stat" data-tone={tone}>{body}</div>;
}
