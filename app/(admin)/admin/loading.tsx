import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-10 font-poppins pb-10 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-4 w-64 rounded-lg" />
      </div>

      {/* Stat cards */}
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
                <Skeleton className="h-8 w-10 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming bookings */}
        <div className="lg:col-span-2 rounded-[32px] bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
            <Skeleton className="h-5 w-44 rounded-lg" />
          </div>
          <div className="divide-y divide-slate-50">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-8 py-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-3 w-40 rounded" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Pending panel */}
        <div className="rounded-[32px] bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
            <Skeleton className="h-5 w-24 rounded-lg" />
          </div>
          <div className="divide-y divide-slate-50">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-4">
                <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
