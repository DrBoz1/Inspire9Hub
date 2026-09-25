import Link from "next/link";
import { Compass } from "lucide-react";

/** A missing page inside the hub keeps the sidebar, so nobody has to go back to square one. */
export default function HubNotFound() {
  return (
    <div className="hub-page">
      <section className="hub-surface hub-error" aria-labelledby="hub-404-title">
        <span className="hub-error-mark" aria-hidden><Compass size={17} /></span>
        <h1 id="hub-404-title">That page isn’t here<span className="hub-red">.</span></h1>
        <p>The link may be out of date, or whatever it pointed at may have been removed since.</p>
        <div className="hub-error-actions">
          <Link href="/dashboard" className="hub-button hub-button-primary">Back to the hub</Link>
          <Link href="/bookings" className="hub-button hub-button-outline">My bookings</Link>
        </div>
      </section>
    </div>
  );
}
