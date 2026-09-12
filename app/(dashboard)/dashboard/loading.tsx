import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return <div className="hub-dashboard" role="status" aria-label="Loading your dashboard">
    <div className="hub-page-heading"><div className="w-full space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-3/5 max-w-96" /><Skeleton className="h-3 w-52" /></div></div>
    <div className="hub-feature-grid"><Skeleton className="min-h-[335px] rounded-[18px]" /><div className="hub-surface min-h-40 p-6 space-y-6"><Skeleton className="h-3 w-32" /><Skeleton className="h-16 w-16 rounded-xl" /><Skeleton className="h-6 w-36" /></div></div>
    <div className="hub-membership-strip hub-surface">{[0, 1, 2].map(i => <div key={i} className="hub-membership-item"><Skeleton className="h-9 w-9 rounded-lg" /><div className="space-y-3"><Skeleton className="h-2 w-24" /><Skeleton className="h-3 w-32" /></div></div>)}</div>
    <div className="hub-feed-grid">{[0, 1].map(i => <div key={i} className="hub-surface space-y-6 p-6"><Skeleton className="h-5 w-36" />{[0, 1].map(j => <div key={j} className="space-y-3"><Skeleton className="h-3 w-3/5" /><Skeleton className="h-3 w-full" /></div>)}</div>)}</div>
  </div>;
}
