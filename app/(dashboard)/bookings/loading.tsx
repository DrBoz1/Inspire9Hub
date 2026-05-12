import { Skeleton } from "@/components/ui/skeleton";

export default function BookingsLoading() {
  return (
    <div className="space-y-10 font-poppins pb-20 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-lg" />
      </div>

      {/* Tab bar */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-14 w-72 rounded-2xl" />
        <Skeleton className="h-4 w-40 rounded" />
      </div>

      {/* Room card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-[40px] bg-white shadow-xl overflow-hidden flex flex-col"
          >
            {/* Image area */}
            <Skeleton className="h-52 w-full rounded-none" />

            {/* Content */}
            <div className="p-7 flex flex-col gap-4 flex-1">
              <div className="flex justify-between items-start">
                <Skeleton className="h-7 w-36 rounded-lg" />
                <Skeleton className="h-4 w-8 rounded" />
              </div>

              {/* Capacity + location chips */}
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 rounded-xl" />
                <Skeleton className="h-8 w-28 rounded-xl" />
              </div>

              {/* Amenity grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[...Array(8)].map((_, j) => (
                  <Skeleton key={j} className="h-3 w-28 rounded" />
                ))}
              </div>

              {/* Book button */}
              <div className="mt-auto pt-2">
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
