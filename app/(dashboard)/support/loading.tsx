import { Skeleton } from "@/components/ui/skeleton";

export default function SupportLoading() {
  return <div className="hub-page hub-loading" role="status" aria-label="Loading support"><div className="hub-page-heading"><div className="w-full space-y-3"><Skeleton className="h-3 w-44" /><Skeleton className="h-9 w-full max-w-80" /><Skeleton className="h-3 w-60" /></div></div><div className="hub-support-grid"><Skeleton className="h-[650px] w-full rounded-2xl" /><div className="space-y-5"><Skeleton className="h-80 w-full rounded-2xl" /><Skeleton className="h-60 w-full rounded-2xl" /></div></div></div>;
}
