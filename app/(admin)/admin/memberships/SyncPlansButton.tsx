"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { syncPlansFromStripe, type SyncPlansResult } from "./actions";

export function SyncPlansButton({ sync = syncPlansFromStripe }: { sync?: () => Promise<SyncPlansResult> }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = () =>
    startTransition(async () => {
      try {
        const result = await sync();
        if ("error" in result) {
          toast.error("Couldn’t sync plans", { description: result.error });
          return;
        }
        toast.success(`Synced ${result.saved} plan${result.saved === 1 ? "" : "s"} from Stripe`, {
          description: [
            result.switchedOff ? `${result.switchedOff} no longer on sale, switched off.` : null,
            result.skipped.length ? `${result.skipped.length} tagged price${result.skipped.length === 1 ? " was" : "s were"} skipped: ${result.skipped[0]}` : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
        });
        router.refresh();
      } catch {
        toast.error("Couldn’t reach the server. Please try again.");
      }
    });

  return (
    <button type="button" className="hub-button hub-button-primary" onClick={run} disabled={pending}>
      {pending ? "Syncing…" : "Sync from Stripe"}
      {pending ? <Loader2 size={15} className="hub-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
    </button>
  );
}
