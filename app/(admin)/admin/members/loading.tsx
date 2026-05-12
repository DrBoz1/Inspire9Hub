import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <div className="space-y-8 font-poppins animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-4 w-64 rounded-lg" />
      </div>

      {/* Search + button row */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 flex-1 max-w-md rounded-2xl" />
        <Skeleton className="h-12 w-52 rounded-2xl" />
      </div>

      {/* Members table */}
      <div className="rounded-[32px] bg-white border border-slate-100 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="bg-slate-50/50 border-b border-slate-50 grid grid-cols-4 px-8 py-5 gap-4">
          {["Resident", "Status", "Workplace", "Action"].map((h) => (
            <Skeleton key={h} className="h-3 w-20 rounded" />
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-50">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-4 px-8 py-6 gap-4 items-center"
            >
              <div className="space-y-2">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-44 rounded" />
              </div>
              <div className="flex justify-center">
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-28 rounded" />
              <div className="flex justify-end">
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
