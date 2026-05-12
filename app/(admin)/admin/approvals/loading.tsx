import { Skeleton } from "@/components/ui/skeleton";

export default function ApprovalsLoading() {
  return (
    <div className="space-y-8 font-poppins pb-10 animate-pulse">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-40 rounded-2xl" />
        <Skeleton className="h-10 w-36 rounded-2xl" />
      </div>

      {/* Card */}
      <div className="rounded-[32px] bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-8 flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36 rounded-lg" />
            <Skeleton className="h-4 w-52 rounded" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        {/* Table rows */}
        <div className="divide-y divide-slate-50">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-4 px-8 py-7 items-center"
            >
              {/* Resident */}
              <div className="space-y-2">
                <Skeleton className="h-5 w-36 rounded" />
                <Skeleton className="h-3 w-44 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
              {/* Workplace */}
              <Skeleton className="h-4 w-28 rounded" />
              {/* Medical */}
              <Skeleton className="h-16 w-full rounded-2xl" />
              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-12 w-28 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
