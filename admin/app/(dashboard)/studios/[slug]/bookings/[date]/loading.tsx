import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DailyBookingsLoading() {
    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <div className="space-y-1.5">
                        <Skeleton className="h-7 w-64 rounded-lg" />
                        <Skeleton className="h-4 w-32 rounded" />
                    </div>
                </div>
                <Skeleton className="h-9 w-20 rounded-md" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Bookings List / Grid Skeleton */}
                <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Card key={i} className="shadow-xs">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <Skeleton className="h-5 w-32 rounded" />
                                            <Skeleton className="h-3.5 w-24 rounded" />
                                        </div>
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-1 border-t pt-2">
                                        <Skeleton className="h-4 w-40 rounded" />
                                        <Skeleton className="h-3 w-20 rounded" />
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t">
                                        <Skeleton className="h-4 w-28 rounded" />
                                        <Skeleton className="h-7 w-24 rounded" />
                                    </div>
                                    <Skeleton className="h-8 w-full rounded mt-1" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Daily Capacity Status Skeleton */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="space-y-2">
                            <Skeleton className="h-5 w-40 rounded" />
                            <Skeleton className="h-3.5 w-48 rounded" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Skeleton className="h-4 w-24 rounded" />
                                    <Skeleton className="h-4 w-20 rounded" />
                                </div>
                                <Skeleton className="h-2.5 w-full rounded-full" />
                            </div>
                            <div className="pt-4 border-t flex justify-between items-center">
                                <Skeleton className="h-4 w-28 rounded" />
                                <Skeleton className="h-7 w-20 rounded" />
                            </div>
                            <div className="pt-4 border-t space-y-3">
                                <Skeleton className="h-4 w-32 rounded" />
                                <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="flex justify-between items-center">
                                            <Skeleton className="h-4 w-36 rounded" />
                                            <Skeleton className="h-5 w-16 rounded-full" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
