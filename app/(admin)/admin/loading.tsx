import { Skeleton } from "@/components/ui/skeleton";

function PanelSkeleton({ className, rows }: { className: string; rows: number }) {
  return (
    <section className={`hub-surface admin-panel ${className}`}>
      <div className="admin-panel-head">
        <div><Skeleton className="h-2.5 w-16" /><Skeleton className="mt-2.5 h-5 w-32" /></div>
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-(--hub-line) px-5.5 py-4 first-of-type:border-t-0">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/5" /><Skeleton className="h-2.5 w-3/5" /></div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </section>
  );
}

export default function AdminDashboardLoading() {
  return (
    <div className="hub-page admin-dashboard hub-loading" aria-busy="true" aria-label="Loading the dashboard">
      <div className="admin-page-heading">
        <div>
          <Skeleton className="h-2.5 w-48" />
          <Skeleton className="mt-3 h-9 w-80 max-w-full" />
          <Skeleton className="mt-3 h-3 w-96 max-w-full" />
        </div>
        <div className="admin-page-actions"><Skeleton className="h-10 w-36" /><Skeleton className="h-10 w-40" /></div>
      </div>
      <div className="admin-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="hub-surface admin-stat">
            <div className="admin-stat-top"><Skeleton className="h-2.5 w-24" /><Skeleton className="h-8 w-8 rounded-[10px]" /></div>
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        ))}
      </div>
      <div className="admin-dash-grid">
        <div className="admin-dash-col">
          <PanelSkeleton className="admin-dash-today" rows={5} />
          <PanelSkeleton className="admin-dash-spaces" rows={4} />
        </div>
        <div className="admin-dash-col">
          <PanelSkeleton className="admin-dash-review" rows={3} />
          <PanelSkeleton className="admin-dash-upcoming" rows={3} />
        </div>
      </div>
    </div>
  );
}
