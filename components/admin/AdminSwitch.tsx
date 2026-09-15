"use client";

import type { ReactNode } from "react";

export function AdminSwitch({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="admin-switch-row">
      <div>
        <label htmlFor={id} className="admin-switch-label">{label}</label>
        {description && <p id={`${id}-hint`}>{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-hint` : undefined}
        className="admin-switch"
        onClick={() => onChange(!checked)}
      >
        <span aria-hidden />
      </button>
    </div>
  );
}
