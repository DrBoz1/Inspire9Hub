import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsLoading() {
  return (
    <div className="hub-page admin-leads-page hub-loading" role="status" aria-busy="true" aria-label="Loading leads">
      <div className="admin-page-heading">
        <div>
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-9 w-32" />
          <Skeleton className="mt-3 h-3 w-96 max-w-full" />
        </div>
        <div className="admin-page-actions"><Skeleton className="h-10 w-32" /></div>
      </div>
      <div className="admin-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="hub-surface admin-stat">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        ))}
      </div>
      <div className="hub-surface admin-panel">
        <div className="admin-toolbar p-4">
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="ml-auto h-10 w-96 max-w-full" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-(--hub-line) px-5 py-4 first-of-type:border-t-0">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1"><Skeleton className="h-3 w-40" /><Skeleton className="mt-2 h-2.5 w-28" /></div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
