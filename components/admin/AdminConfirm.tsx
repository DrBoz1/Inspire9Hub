"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConfirmResult = { error?: string | null } | void;

/**
 * The confirm step for anything that can't be undone. If the action returns
 * `{ error }`, the dialog stays open and says why.
 */
export function AdminConfirm({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel = "Working…",
  cancelLabel = "Cancel",
  onConfirm,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<ConfirmResult> | ConfirmResult;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await onConfirm();
      const message = (result as { error?: string | null } | undefined)?.error;
      if (message) {
        setError(message);
        return;
      }
      setOpen(false);
    });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="hub-dialog hub-cancel-dialog admin-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {error && <p className="hub-inline-error" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className="hub-button hub-button-outline" disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <button type="button" className="hub-button hub-button-primary" onClick={confirm} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 size={14} className="hub-spin" aria-hidden />}
            {pending ? pendingLabel : confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
