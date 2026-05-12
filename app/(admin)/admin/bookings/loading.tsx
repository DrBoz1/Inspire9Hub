import { Skeleton } from "@/components/ui/skeleton";

export default function AdminBookingsLoading() {
  return (
    <div className="space-y-8 font-poppins pb-10 animate-pulse">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52 rounded-xl" />
          <Skeleton className="h-4 w-72 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-2xl" />
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-[32px] bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
          <Skeleton className="h-5 w-40 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-50">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-8 py-5"
            >
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-52 rounded" />
                <Skeleton className="h-3 w-44 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
