import { Skeleton } from "@/components/ui/skeleton"

export default function StudiosLoading() {
  return (
    <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2 space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-20" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex flex-col gap-2 mt-4 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>

      {/* All Studios Card Skeleton */}
      <div className="rounded-xl border bg-card/50 shadow-xs">
        <div className="p-6 space-y-1.5">
          <div className="flex items-center gap-1">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-0 shadow-xs">
              {/* Studio Logo Skeleton */}
              <div className="flex flex-col items-center justify-center p-6">
                <Skeleton className="h-[100px] w-[100px] rounded-xl" />
              </div>
              {/* Studio Info Skeleton */}
              <div className="flex flex-col items-center justify-center text-center px-6 pb-4 space-y-2">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-48" />
                <div className="flex items-center gap-1 mt-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              {/* View Button Skeleton */}
              <div className="p-6 pt-0">
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
