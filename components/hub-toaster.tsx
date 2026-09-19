"use client";

import type { CSSProperties } from "react";
import { Toaster } from "sonner";
import { Check, CircleAlert, Info, Loader2, TriangleAlert, X } from "lucide-react";

/**
 * Six seconds rather than sonner's four: several messages carry a reason to act
 * on ("add a monthly price to it…"), and four seconds is too short to read one.
 * Hovering or focusing a message pauses it, and it can always be closed.
 */
const DURATION_MS = 6000;

/**
 * The hub's pop-up messages, shared by the member and admin areas. Sonner does
 * the timing, stacking and swiping; the look is the hub's own, under "Toasts"
 * in member-pages.css. It sits under the 72px header rather than on top of it.
 */
export function HubToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      duration={DURATION_MS}
      offset={{ top: 84, right: 24 }}
      mobileOffset={{ top: 68, left: 12, right: 12 }}
      className="hub-toaster"
      // Read by the time line along the bottom of each message.
      style={{ "--hub-toast-duration": `${DURATION_MS}ms` } as CSSProperties}
      toastOptions={{ classNames: { toast: "hub-toast" } }}
      icons={{
        success: <Check size={16} strokeWidth={2.4} aria-hidden />,
        error: <CircleAlert size={16} aria-hidden />,
        warning: <TriangleAlert size={16} aria-hidden />,
        info: <Info size={16} aria-hidden />,
        loading: <Loader2 size={16} className="hub-spin" aria-hidden />,
        close: <X size={14} aria-hidden />,
      }}
    />
  );
}
