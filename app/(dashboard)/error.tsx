"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

/**
 * Shown inside the member hub when a page fails, so the sidebar and header stay
 * put and the member can go somewhere else without reloading. Layout failures
 * are caught a level up, by app/error.tsx.
 */
export default function HubError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error("[hub] page failed:", error);
  }, [error]);

  return (
    <div className="hub-page">
      <section className="hub-surface hub-error" aria-labelledby="hub-error-title">
        <span className="hub-error-mark" aria-hidden><TriangleAlert size={17} /></span>
        <h1 id="hub-error-title">This page didn’t load<span className="hub-red">.</span></h1>
        <p>
          Something went wrong on our side, not yours. Try again in a moment — nothing you’d booked or
          saved has been affected.
        </p>
        <div className="hub-error-actions">
          <button type="button" className="hub-button hub-button-primary" onClick={() => unstable_retry()}>
            <RotateCw size={14} aria-hidden />Try again
          </button>
          <Link href="/dashboard" className="hub-button hub-button-outline">Back to the hub</Link>
        </div>
        {error.digest && <p className="hub-error-ref">Reference {error.digest}</p>}
      </section>
    </div>
  );
}
