"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import "./fallback.css";

/**
 * The last stop before global-error: anything thrown while a route group's own
 * layout renders lands here, so a bad query in the member or admin layout shows
 * this rather than the browser's blank error page.
 *
 * It deliberately borrows nothing from the hub or admin stylesheets, because
 * whatever failed may be the layout that loads them.
 */
export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error("[app] render failed:", error);
  }, [error]);

  return (
    <div className="fallback">
      <main className="fallback-card">
        <span className="fallback-mark" aria-hidden><TriangleAlert size={18} /></span>
        <p className="fallback-eyebrow">Something went wrong</p>
        <h1>We couldn’t load that<span>.</span></h1>
        <p>
          The page stopped part way through. It’s usually a passing glitch, so trying again often works.
          Nothing you’d saved has been lost.
        </p>
        <div className="fallback-actions">
          <button type="button" className="fallback-button fallback-button-primary" onClick={() => unstable_retry()}>
            <RotateCw size={14} aria-hidden />Try again
          </button>
          <Link href="/dashboard" className="fallback-button fallback-button-outline">Go to the hub</Link>
        </div>
        {error.digest && (
          <p className="fallback-ref">
            If it keeps happening, send the team this reference: <code>{error.digest}</code>
          </p>
        )}
      </main>
    </div>
  );
}
