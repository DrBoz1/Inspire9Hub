import { Skeleton } from "@/components/ui/skeleton";

export default function StaffLoading() {
  return (
    <div className="hub-page admin-staff-page hub-loading" aria-busy="true" aria-label="Loading staff">
      <div className="admin-page-heading">
        <div>
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="mt-3 h-9 w-72 max-w-full" />
          <Skeleton className="mt-3 h-3 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="admin-role-guide">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="hub-surface">
            <Skeleton className="h-8 w-8 rounded-[10px]" />
            <div className="flex-1"><Skeleton className="h-3.5 w-24" /><Skeleton className="mt-2.5 h-3 w-full" /></div>
          </div>
        ))}
      </div>
      <div className="hub-surface admin-panel">
        <div className="admin-toolbar"><Skeleton className="h-10 w-80 max-w-full" /><Skeleton className="h-10 w-72 max-w-full" /></div>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-[var(--hub-line)] px-[18px] py-4 last:border-b-0">
            <Skeleton className="h-[34px] w-[34px] rounded-full" />
            <div className="flex-1"><Skeleton className="h-3.5 w-40" /><Skeleton className="mt-2 h-3 w-56 max-w-full" /></div>
            <Skeleton className="hidden h-8 w-48 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
