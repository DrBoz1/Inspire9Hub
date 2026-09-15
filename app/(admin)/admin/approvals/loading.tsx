import { Skeleton } from "@/components/ui/skeleton";

export default function ComplianceLoading() {
  return (
    <div className="hub-page admin-compliance hub-loading" role="status" aria-busy="true" aria-label="Loading compliance">
      <div className="admin-page-heading">
        <div>
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-9 w-56 max-w-full" />
          <Skeleton className="mt-3 h-3 w-96 max-w-full" />
        </div>
      </div>
      <div className="admin-compliance-bar"><Skeleton className="h-10 w-56" /></div>
      <div className="admin-review-grid">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="hub-surface admin-review-card">
            <div className="admin-review-head">
              <Skeleton className="h-8.5 w-8.5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-2.5 w-24" /></div>
            </div>
            <div className="admin-review-facts">
              {Array.from({ length: 4 }, (_, j) => <div key={j} className="space-y-2"><Skeleton className="h-2 w-14" /><Skeleton className="h-3 w-32" /></div>)}
            </div>
            <div className="admin-review-note"><Skeleton className="h-2.5 w-44" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-2 h-3 w-2/3" /></div>
            <div className="admin-review-foot"><Skeleton className="h-9.5 w-24" /><Skeleton className="h-9.5 w-28" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
