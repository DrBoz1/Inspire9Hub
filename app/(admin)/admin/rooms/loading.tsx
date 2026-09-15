import { Skeleton } from "@/components/ui/skeleton";

export default function RoomsLoading() {
  return (
    <div className="hub-page admin-rooms-page hub-loading" aria-busy="true" aria-label="Loading spaces">
      <div className="admin-page-heading">
        <div>
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-9 w-72 max-w-full" />
          <Skeleton className="mt-3 h-3 w-96 max-w-full" />
        </div>
      </div>
      <div className="admin-rooms-bar">
        <div className="admin-toolbar"><Skeleton className="h-10 w-80 max-w-full" /><Skeleton className="h-10 w-56" /></div>
      </div>
      <div className="admin-room-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="hub-surface admin-room-tile">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="admin-room-body">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-32" />
              <div className="flex gap-2"><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-24" /></div>
              <Skeleton className="mt-2 h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
