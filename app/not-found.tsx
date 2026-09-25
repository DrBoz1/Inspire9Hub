import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import "./fallback.css";

export const metadata: Metadata = { title: "Page not found | Inspire9 Hub" };

/**
 * A URL that matches nothing, and anything that calls notFound(). Signed-out
 * visitors are sent to the login page by the proxy, so the links here are the
 * two places a signed-in member actually wants: the hub, or their bookings.
 */
export default function NotFound() {
  return (
    <div className="fallback">
      <main className="fallback-card">
        <span className="fallback-mark" aria-hidden><Compass size={18} /></span>
        <p className="fallback-eyebrow">404</p>
        <h1>That page isn’t here<span>.</span></h1>
        <p>
          The link may be out of date, or the page may have moved. Everything in the hub is a click or
          two from the dashboard.
        </p>
        <div className="fallback-actions">
          <Link href="/dashboard" className="fallback-button fallback-button-primary">Go to the hub</Link>
          <Link href="/bookings" className="fallback-button fallback-button-outline">My bookings</Link>
        </div>
      </main>
    </div>
  );
}
