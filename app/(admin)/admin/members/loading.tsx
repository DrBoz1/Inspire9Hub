import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <div className="hub-page admin-members-page hub-loading" aria-busy="true" aria-label="Loading members">
      <div className="admin-page-heading">
        <div>
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-9 w-48" />
          <Skeleton className="mt-3 h-3 w-96 max-w-full" />
        </div>
        <div className="admin-page-actions"><Skeleton className="h-10 w-40" /></div>
      </div>
      <section className="hub-surface admin-panel">
        <div className="admin-toolbar"><Skeleton className="h-10 w-80 max-w-full" /><Skeleton className="h-10 w-96 max-w-full" /></div>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-(--hub-line) px-4.5 py-3.5">
            <Skeleton className="h-8.5 w-8.5 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-2.5 w-52" /></div>
            <Skeleton className="hidden h-3 w-24 md:block" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </section>
    </div>
  );
}
