import { Skeleton } from "@/components/ui/skeleton";

export default function AdminRoomsLoading() {
  return (
    <div className="space-y-8 font-poppins pb-10 animate-pulse">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-[32px] bg-white border border-slate-100 shadow-sm overflow-hidden"
          >
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="p-6 space-y-3">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-3 w-24 rounded" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                {[...Array(4)].map((__, j) => (
                  <Skeleton key={j} className="h-3 w-20 rounded" />
                ))}
              </div>
              <Skeleton className="h-11 w-full rounded-xl mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
