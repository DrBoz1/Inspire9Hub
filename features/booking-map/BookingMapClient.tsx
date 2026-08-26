"use client";

import dynamic from "next/dynamic";

/**
 * The map is rendered client-only, on purpose.
 *
 * It reads `matchMedia` (false on the server, real on the client) and seeds state
 * from `todayKey()` / `nowMinutes()`, which differ between the server render and
 * hydration. React saw the mismatch, discarded the whole tree and rebuilt it —
 * "Hydration failed because the server rendered HTML didn't match the client" —
 * which showed up as a flash of the desktop shell collapsing into the mobile one
 * on every load.
 *
 * There is nothing to gain from server-rendering it: it is an interactive canvas
 * with no SEO value, driven entirely by pointer events and browser APIs.
 */
const BookingMap = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#E31E24] dark:border-slate-700 dark:border-t-[#E31E24]" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Loading floor plan
        </p>
      </div>
    </div>
  ),
});

export default function BookingMapClient() {
  return <BookingMap />;
}
