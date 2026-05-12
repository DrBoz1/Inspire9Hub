import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="w-full space-y-8 font-poppins pb-10 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-4 w-48 rounded-lg" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-7 w-32 rounded-lg" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Recent Activity card */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-50 px-8 py-6 flex justify-between items-center">
          <Skeleton className="h-5 w-36 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <div className="p-8 space-y-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-6">
              <Skeleton className="h-3 w-3 rounded-full shrink-0 mt-1.5" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <Skeleton className="h-3 w-64 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
