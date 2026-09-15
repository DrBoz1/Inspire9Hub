"use client";

import { useState } from "react";
import { updatePassword } from "../actions";
import { PasswordInput } from "../PasswordInput";
import { PasswordChecks, SubmitButton } from "../AuthUi";
import { passwordChecks } from "../auth-mode";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <form action={updatePassword} className="auth-form">
      <div className="auth-field">
        <label htmlFor="new-password">New password</label>
        <PasswordInput id="new-password" name="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} onValueChange={setPassword} describedBy="new-password-checks" />
      </div>
      <div className="auth-field">
        <label htmlFor="confirm-password">Confirm password</label>
        <PasswordInput id="confirm-password" name="confirm_password" autoComplete="new-password" placeholder="Type it once more" minLength={8} onValueChange={setConfirm} describedBy="new-password-checks" />
        <PasswordChecks
          id="new-password-checks"
          items={[
            { label: "8+ characters", met: passwordChecks(password).length },
            { label: "Passwords match", met: confirm.length > 0 && confirm === password },
          ]}
        />
      </div>
      <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
    </form>
  );
}
