"use client";

import { AlertCircle, Building2, Mail, Phone, UserRound } from "lucide-react";

const ICONS = { user: UserRound, phone: Phone, building: Building2, mail: Mail };

export function HubInput({
  id,
  label,
  hint,
  error,
  note,
  span,
  icon,
  onValueChange,
  ...input
}: {
  id: string;
  name?: string;
  label: string;
  hint?: string;
  error?: string;
  note?: React.ReactNode;
  span?: "full";
  icon: keyof typeof ICONS;
  value: string;
  onValueChange?: (value: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  maxLength?: number;
}) {
  const Icon = ICONS[icon];
  const describedBy = [error && `${id}-error`, note && `${id}-note`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="hub-field" data-span={span}>
      <label className="hub-field-label" htmlFor={id}>{label}{hint && <small>{hint}</small>}</label>
      <div className="hub-input">
        <Icon size={15} strokeWidth={1.8} aria-hidden />
        <input
          id={id}
          {...input}
          onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
      {error && <p className="hub-field-error" id={`${id}-error`}><AlertCircle size={12} aria-hidden />{error}</p>}
      {note && <p className="hub-field-note" id={`${id}-note`}>{note}</p>}
    </div>
  );
}
