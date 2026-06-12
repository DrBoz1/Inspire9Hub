import { Skeleton } from "@/components/ui/skeleton";

export default function SupportLoading() {
  return (
    <div className="w-full space-y-8 pb-16">
      <Skeleton className="h-72 w-full rounded-[2.5rem]" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-44 rounded-3xl" />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
        <Skeleton className="h-[28rem] rounded-[2rem] lg:col-span-2" />
      </div>
    </div>
  );
}
