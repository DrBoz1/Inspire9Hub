"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import "./fallback.css";

/**
 * The root layout itself failed, so this replaces it entirely: no fonts, no
 * theme provider, no globals.css. Everything it needs is in fallback.css and
 * the markup below, including the html and body tags Next requires here.
 *
 * Nothing links into the app: if the root layout can't render, neither can the
 * page you'd send someone to, so the only honest action is to reload.
 */
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error("[app] root layout failed:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="fallback">
        <title>Something went wrong · Inspire9 Hub</title>
        <main className="fallback-card">
          <p className="fallback-eyebrow">Inspire9 Hub</p>
          <h1>The hub is having a moment<span>.</span></h1>
          <p>
            Something failed before the page could be built. Try again in a few seconds; if it keeps
            happening, the team can look it up with the reference below.
          </p>
          <div className="fallback-actions">
            <button type="button" className="fallback-button fallback-button-primary" onClick={() => unstable_retry()}>
              Try again
            </button>
            <a className="fallback-button fallback-button-outline" href="/dashboard">Reload the hub</a>
          </div>
          {error.digest && (
            <p className="fallback-ref">
              Reference: <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
