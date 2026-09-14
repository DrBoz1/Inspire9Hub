import { Skeleton } from "@/components/ui/skeleton";
import BookingsHero from "./BookingsHero";
import { CalendarDays, LayoutGrid } from "lucide-react";

export default function BookingsLoading() {
  return <div className="hub-page hub-bookings hub-loading" role="status" aria-label="Loading your spaces" aria-busy="true">
    <div aria-hidden="true" inert>
      <BookingsHero />
      <div className="hub-loading-tabs-layout">
        <div className="hub-tabs"><span className="hub-loading-tab"><LayoutGrid size={16} />Browse rooms<Skeleton className="h-[19px] w-[21px]" /></span><span className="hub-loading-tab"><CalendarDays size={16} />My schedule<Skeleton className="h-[19px] w-[21px]" /></span></div>
        <div>
          <div className="hub-browse-tools"><div className="hub-search"><Skeleton className="size-4 shrink-0" /><Skeleton className="h-3 w-48 max-w-full" /></div><div className="hub-capacity"><Skeleton className="h-3 w-10" /><Skeleton className="h-10 w-28 rounded-lg" /></div><span className="hub-record-note"><Skeleton className="h-3 w-12" /></span></div>
          <div className="hub-room-grid">{[0, 1, 2].map(i => <div key={i} className="hub-room-card hub-surface">
            <Skeleton className="hub-room-photo rounded-none" />
            <div className="hub-room-body">
              <div className="hub-room-location"><Skeleton className="h-3 w-28" /></div>
              <h2><Skeleton className="h-[30px] w-40 max-w-full" /></h2>
              <div className="hub-room-features"><Skeleton className="h-[15px] w-16" /><Skeleton className="h-[15px] w-24" /></div>
              <div className="hub-room-rate"><Skeleton className="h-[34px] w-28" /><Skeleton className="h-3 w-32" /></div>
              <Skeleton className="hub-room-book rounded-lg" />
            </div>
          </div>)}</div>
        </div>
      </div>
    </div>
  </div>;
}
