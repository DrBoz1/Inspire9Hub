import type { Metadata } from "next";
import BookingMap from "@/features/booking-map/BookingMapClient";

export const metadata: Metadata = {
  title: "Floor Plan | Inspire9 Hub",
};

export default function SpacesPage() {
  return (
    <div className="space-y-6 font-poppins">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
          Floor Plan
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
          Pick a space on the plan to see what&apos;s free and book it.
        </p>
      </div>

      {/*
        The map inherits its height from this box — it has no intrinsic size and
        would collapse in normal document flow. The dashboard shell is h-screen
        with a header and p-8 padding, so subtract those to fill what's left.
      */}
      <div className="h-[calc(100vh-15rem)] min-h-[520px] overflow-hidden rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <BookingMap />
      </div>
    </div>
  );
}
