import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="w-full space-y-8 font-poppins pb-10 animate-pulse">

      {/* Hero skeleton — matches the dark rounded-[40px] hero */}
      <div className="rounded-[40px] bg-slate-900 px-8 py-10 md:px-12 md:py-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div className="space-y-4">
          <Skeleton className="h-5 w-32 rounded-full bg-white/10" />
          <Skeleton className="h-12 w-64 rounded-xl bg-white/10" />
          <Skeleton className="h-4 w-44 rounded-lg bg-white/10" />
        </div>
        <div className="flex gap-3 shrink-0">
          <Skeleton className="h-10 w-24 rounded-xl bg-white/10" />
          <Skeleton className="h-10 w-36 rounded-xl bg-white/10" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4"
          >
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-7 w-40 rounded-lg" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Recent Activity card */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-50 px-8 py-6 flex justify-between items-center">
          <Skeleton className="h-5 w-36 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <div className="p-8 space-y-7">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
