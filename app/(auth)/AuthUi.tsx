"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, Check, Loader2, Mail, UserRound } from "lucide-react";

const ICONS = { mail: Mail, user: UserRound };

export function TextField({
  id,
  label,
  icon,
  onValueChange,
  ...input
}: {
  id: string;
  name: string;
  label: string;
  icon: keyof typeof ICONS;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const Icon = ICONS[icon];
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input">
        <Icon size={16} strokeWidth={1.8} aria-hidden />
        <input id={id} {...input} onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined} />
      </div>
    </div>
  );
}

export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-submit" disabled={pending} aria-busy={pending}>
      <span>{pending ? pendingLabel : children}</span>
      {pending ? <Loader2 size={16} className="auth-spin" aria-hidden /> : <ArrowRight size={16} aria-hidden />}
    </button>
  );
}

export function PasswordChecks({ id, items }: { id: string; items: { label: string; met: boolean }[] }) {
  return (
    <ul id={id} className="auth-checks">
      {items.map((item) => (
        <li key={item.label} data-met={item.met}>
          <span className="auth-check-dot" aria-hidden>{item.met && <Check size={9} strokeWidth={3} />}</span>
          {item.label}
          <span className="sr-only">{item.met ? ", done" : ", not yet"}</span>
        </li>
      ))}
    </ul>
  );
}
