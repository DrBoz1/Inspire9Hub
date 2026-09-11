"use client";

import dynamic from "next/dynamic";
// Type-only, so it's erased: importing App itself here would pull it into the
// server-rendered bundle and defeat the dynamic import below.
import type { MapProps } from "./App";

/**
 * The map is rendered client-only, on purpose.
 *
 * It measures its own width and reads the hub's clock, both of which differ between
 * the server render and hydration. React saw the mismatch, discarded the whole tree
 * and rebuilt it — "Hydration failed because the server rendered HTML didn't match
 * the client" — which showed up as a flash on every load.
 *
 * There is nothing to gain from server-rendering it: it is an interactive canvas
 * with no SEO value, driven entirely by pointer events and browser APIs. Its data
 * is loaded on the server by the page and passed in as props.
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

export default function BookingMapClient(props: MapProps) {
  return <BookingMap {...props} />;
}
