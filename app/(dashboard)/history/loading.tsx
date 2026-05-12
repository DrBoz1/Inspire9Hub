import { Skeleton } from "@/components/ui/skeleton";

function CardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-50">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function HistoryLoading() {
  return (
    <div className="w-full space-y-10 font-poppins pb-16 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-4 w-72 rounded-lg" />
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-3xl bg-white border border-slate-100 shadow-sm"
          >
            <div className="p-6 flex items-center gap-4">
              <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-7 w-14 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Booking History */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
          <Skeleton className="h-5 w-40 rounded-lg" />
        </div>
        <CardListSkeleton rows={5} />
      </div>

      {/* Payment History */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
          <Skeleton className="h-5 w-36 rounded-lg" />
        </div>
        <CardListSkeleton rows={4} />
      </div>

      {/* Access Passes */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
          <Skeleton className="h-5 w-32 rounded-lg" />
        </div>
        <CardListSkeleton rows={2} />
      </div>
    </div>
  );
}
