import { Skeleton } from "@/components/ui/skeleton";

export default function ScheduleLoading() {
  return (
    <div className="hub-page admin-schedule-page hub-loading" aria-busy="true" aria-label="Loading the booking schedule">
      <div className="admin-page-heading">
        <div>
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-9 w-72 max-w-full" />
          <Skeleton className="mt-3 h-3 w-96 max-w-full" />
        </div>
      </div>
      <section className="hub-surface admin-panel">
        <div className="admin-toolbar"><Skeleton className="h-10 w-80 max-w-full" /><Skeleton className="h-10 w-96 max-w-full" /></div>
        {Array.from({ length: 2 }, (_, g) => (
          <div key={g} className="admin-day">
            <div className="admin-day-head"><Skeleton className="h-3 w-40" /></div>
            <ul className="admin-bookings">
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="admin-booking">
                  <div className="admin-booking-when space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-12" /></div>
                  <div className="admin-booking-what space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-2.5 w-16" /></div>
                  <div className="admin-booking-who space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-36" /></div>
                  <div className="admin-booking-pay"><Skeleton className="h-3 w-14" /></div>
                  <Skeleton className="h-5 w-20" />
                  <div className="admin-booking-actions"><Skeleton className="h-8 w-20" /></div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
