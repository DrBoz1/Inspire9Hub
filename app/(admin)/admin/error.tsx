"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

/** Shown inside the admin frame when a page fails to load, so the sidebar stays usable. */
export default function AdminError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="hub-page">
      <section className="hub-surface admin-error" aria-labelledby="admin-error-title">
        <span className="admin-empty-icon" aria-hidden><TriangleAlert size={18} /></span>
        <h1 id="admin-error-title">This page didn’t load</h1>
        <p>Something went wrong while loading it. Try again in a moment. If it keeps happening, the reference below helps track it down.</p>
        <div className="admin-error-actions">
          <button type="button" className="hub-button hub-button-primary" onClick={() => unstable_retry()}>
            <RotateCw size={14} aria-hidden />Try again
          </button>
          <Link href="/admin" className="hub-button hub-button-outline">Back to the dashboard</Link>
        </div>
        {error.digest && <p className="admin-error-code">Reference {error.digest}</p>}
      </section>
    </div>
  );
}
