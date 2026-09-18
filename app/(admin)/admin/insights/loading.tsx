import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="hub-page admin-insights-page hub-loading" role="status" aria-busy="true" aria-label="Loading insights">
      <div className="admin-page-heading">
        <div>
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="mt-3 h-9 w-44" />
          <Skeleton className="mt-3 h-3 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <div className="admin-toolbar">
        <Skeleton className="h-10 w-96 max-w-full rounded-[9px]" />
      </div>
      <div className="admin-stats mt-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="hub-surface admin-stat">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        ))}
      </div>
      <div className="admin-insights-grid">
        {["admin-insights-revenue", "admin-insights-spenders", "admin-insights-rooms", "admin-insights-heat", "admin-insights-behaviour"].map((area) => (
          <div key={area} className={`hub-surface admin-panel ${area}`}>
            <div className="admin-panel-head">
              <div>
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-2 h-5 w-40" />
              </div>
            </div>
            <div className="admin-insights-body">
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
