import { Skeleton } from "@/components/ui/skeleton"

export default function StudioDetailLoading() {
  return (
    <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
      {/* Back Button + Title */}
      <div className="flex items-center justify-center gap-2 w-full">
        <Skeleton className="h-10 w-24 rounded-lg" />
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-7 w-48" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
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

      {/* Tabs Skeleton */}
      <div className="space-y-4">
        <div className="flex gap-2 pb-2">
          {["Overview", "Services", "Clients", "Staffs", "Bookings", "Settings"].map(
            (tab) => (
              <Skeleton key={tab} className="h-9 w-20 rounded-lg" />
            )
          )}
        </div>

        {/* Tab Content — Overview card skeleton */}
        <div className="rounded-xl bg-card shadow-xs">
          <div className="p-6 space-y-4">
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
