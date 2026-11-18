import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function FinancesLoading() {
    return (
        <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
            {/* Header & Controls Skeleton */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                            <Skeleton className="h-8 w-32 rounded-lg" />
                            <Skeleton className="h-5 w-24 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-64 max-w-sm rounded" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-8 w-36 rounded-lg" />
                        <Skeleton className="h-8 w-56 rounded-lg" />
                    </div>
                </div>
            </div>

            {/* Tabs List Skeleton */}
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-64 rounded-lg" />
            </div>

            <div className="flex flex-col gap-6">
                {/* 6 Metric Cards Skeleton */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                <Skeleton className="h-4 w-24 rounded" />
                                <Skeleton className="size-4 rounded-full" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-7 w-28 rounded" />
                                <Skeleton className="h-3 w-36 rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Revenue Trend Chart Skeleton */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-40 rounded" />
                            <Skeleton className="h-4 w-64 rounded" />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <Skeleton className="h-3 w-24 rounded" />
                            <Skeleton className="h-6 w-32 rounded" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                        <Skeleton className="h-[260px] w-full rounded-lg" />
                    </CardContent>
                </Card>

                {/* Revenue by Source Skeleton */}
                <Card>
                    <CardHeader className="space-y-2">
                        <Skeleton className="h-5 w-48 rounded" />
                        <Skeleton className="h-4 w-80 rounded" />
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-28 rounded" />
                                    <Skeleton className="h-4 w-20 rounded" />
                                </div>
                                <Skeleton className="h-2 w-full rounded-full" />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Studio Performance Table Skeleton */}
                <Card>
                    <CardHeader className="space-y-2">
                        <Skeleton className="h-5 w-40 rounded" />
                        <Skeleton className="h-4 w-72 rounded" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-between border-b pb-2">
                                <Skeleton className="h-4 w-24 rounded" />
                                <Skeleton className="h-4 w-20 rounded" />
                                <Skeleton className="h-4 w-20 rounded" />
                                <Skeleton className="h-4 w-20 rounded" />
                                <Skeleton className="h-4 w-20 rounded" />
                            </div>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex justify-between py-2 border-b last:border-b-0">
                                    <Skeleton className="h-4 w-28 rounded" />
                                    <Skeleton className="h-4 w-16 rounded" />
                                    <Skeleton className="h-4 w-16 rounded" />
                                    <Skeleton className="h-4 w-16 rounded" />
                                    <Skeleton className="h-4 w-16 rounded" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
