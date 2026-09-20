import { Skeleton } from "@/components/ui/skeleton";

export default function MembershipLoading() {
  return (
    <div className="hub-page hub-account hub-membership hub-loading" role="status" aria-busy="true" aria-label="Loading your membership">
      <div className="hub-page-heading">
        <div>
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="mt-3 h-9 w-56" />
          <Skeleton className="mt-3 h-3 w-80 max-w-full" />
        </div>
      </div>
      <div className="hub-membership-grid">
        <div className="hub-membership-col">
          <Skeleton className="h-2.5 w-20" />
          <div className="hub-surface hub-membership-current">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-3 h-5 w-24 rounded-full" />
            <Skeleton className="mt-4 h-3 w-full" />
          </div>
        </div>
        <div className="hub-membership-col hub-membership-plans">
          <Skeleton className="h-2.5 w-24" />
          <ul>
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="hub-surface hub-plan"><Skeleton className="h-4 w-32" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-5 h-6 w-28" /><Skeleton className="mt-4 h-10 w-full" /></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
