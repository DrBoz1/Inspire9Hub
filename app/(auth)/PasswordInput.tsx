"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

export function PasswordInput({
  name,
  id,
  placeholder = "Your password",
  required = true,
  minLength,
  autoComplete = "current-password",
  onValueChange,
  describedBy,
}: {
  name: string;
  id: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: "current-password" | "new-password";
  onValueChange?: (value: string) => void;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-input auth-input-password">
      <LockKeyhole size={16} strokeWidth={1.8} aria-hidden />
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
      />
      <button
        type="button"
        className="auth-reveal"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={id}
      >
        {visible ? <EyeOff size={16} strokeWidth={1.8} aria-hidden /> : <Eye size={16} strokeWidth={1.8} aria-hidden />}
      </button>
    </div>
  );
}
