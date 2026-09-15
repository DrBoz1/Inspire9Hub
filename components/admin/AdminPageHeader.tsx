import type { ReactNode } from "react";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-heading">
      <div>
        <p className="hub-eyebrow">{eyebrow}</p>
        <h1>{title}<span className="hub-red">.</span></h1>
        {description && <p className="admin-page-lede">{description}</p>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </header>
  );
}
