import { Skeleton } from "@/components/ui/skeleton";

export default function AnnouncementsLoading() {
  return (
    <div className="hub-page admin-announcements-page hub-loading" aria-busy="true" aria-label="Loading announcements">
      <div className="admin-page-heading">
        <div>
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-9 w-64 max-w-full" />
          <Skeleton className="mt-3 h-3 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="admin-announce-layout">
        <div className="hub-surface admin-panel">
          <div className="admin-toolbar"><Skeleton className="h-10 w-80 max-w-full" /></div>
          <ul className="admin-announce-list">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="admin-announce">
                <Skeleton className="h-9 w-9 rounded-[10px]" />
                <div className="admin-announce-body">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-3 h-4 w-3/5" />
                  <Skeleton className="mt-2.5 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-2/5" />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="hub-surface admin-noticeboard">
          <div className="hub-feed-heading">
            <div><Skeleton className="h-2.5 w-24" /><Skeleton className="mt-3 h-5 w-40" /></div>
          </div>
          <div className="hub-announcements">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="hub-announcement">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="mt-3 h-3.5 w-3/4" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
