import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReassignMemberDropdown } from "./ReassignMemberDropdown";
import { RescheduleTimePicker } from "./RescheduleTimePicker";
import { GenericEmptyState } from "@/components/web/generic-empty-state";
import { HugeiconsIcon } from "@hugeicons/react";
import { Appointment02Icon } from "@hugeicons/core-free-icons";
import { BackButton } from "@/components/web/back-button";
import { MemberRole } from "@/lib/schemas/studio";

export const metadata: Metadata = {
    title: "Daily Bookings",
};

interface Props {
    params: Promise<{
        slug: string;
        date: string; // Format: YYYY-MM-DD
    }>;
}

export default async function StudioDailyBookingsPage({ params }: Props) {
    const { slug, date } = await params;
    
    // Parse the date
    const targetDate = parseISO(date);
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    // Fetch the studio to confirm it exists and get its ID
    const studio = await prisma.studio.findUnique({
        where: { slug },
        include: {
            members: {
                include: {
                    user: true
                }
            }
        }
    });

    if (!studio) {
        return <div className="p-6">Studio not found.</div>;
    }

    const mappedMembers = studio.members.map(m => ({
        id: m.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role as MemberRole,
        studioId: m.studioId,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.createdAt.toISOString()
    }));

    // Fetch bookings for that day
    const dailyBookings = await prisma.booking.findMany({
        where: {
            studioId: studio.id,
            bookingDate: {
                gte: start,
                lte: end,
            }
        },
        include: {
            client: true,
            service: {
                include: {
                    studioSession: true
                }
            },
            member: {
                include: {
                    user: true
                }
            }
        },
        orderBy: {
            bookingDate: 'asc'
        }
    });

    // Calculate total consumed minutes
    const totalMinutes = dailyBookings.reduce((sum, b) => {
        const duration = b.service?.studioSession?.duration || 45;
        return sum + (duration * b.sessionCount);
    }, 0);

    // Fetch all services for this studio to calculate possible slots
    const studioSessions = await prisma.studio.findUnique({
        where: { id: studio.id },
        include: { 
            studioSessions: true 
        }
    });

    const totalCapacity = 720; // 12 hours * 60
    const remainingMinutes = Math.max(0, totalCapacity - totalMinutes);

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <div className="flex items-center gap-4">
                <BackButton href={`/studios/${slug}`} />
                <div>
                    <h1 className="text-2xl font-bold">Bookings for {format(targetDate, "MMM do, yyyy")}</h1>
                    <p className="text-muted-foreground">{studio.name}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {dailyBookings.length === 0 ? (
                    <GenericEmptyState
                        className="md:col-span-2 border-2 border-dashed"
                        icon={<HugeiconsIcon icon={Appointment02Icon} />}
                        title="No bookings"
                        description="No bookings found"
                        actionLink={`/studios/${slug}?tab=bookings&action=add-booking&date=${targetDate.toISOString()}`}
                        actionText="Add Booking"
                    />
                ) : (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dailyBookings.map((booking) => (
                            <Card key={booking.id} className="@container/card h-fit">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg">{booking.client?.name}</CardTitle>
                                        <div className="flex items-center gap-1">
                                            <Badge variant="secondary">{booking.sessionCount} {booking.sessionCount > 1 ? "Sessions" : "Session"}</Badge>
                                            <Badge>{booking.bookingStatus}</Badge>
                                        </div>
                                    </div>
                                    <CardDescription>{booking.service?.name}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm">Time: {format(new Date(booking.bookingDate), "hh:mm a")}</p>
                                        <RescheduleTimePicker bookingId={booking.id} currentDate={booking.bookingDate} />
                                    </div>
                                    <div>
                                        <ReassignMemberDropdown bookingId={booking.id} currentMemberId={booking.memberId} members={mappedMembers} />
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full gap-1.5 mt-1" asChild>
                                        <Link href={`/studios/${slug}/bookings/detail/${booking.id}`}>
                                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                                            View Details
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Daily Capacity Status</CardTitle>
                            <CardDescription>Based on 8am - 8pm open hours</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium">Time Booked</span>
                                    <span className="text-sm text-muted-foreground">{totalMinutes} / {totalCapacity} min</span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-2.5">
                                    <div 
                                        className="bg-primary h-2.5 rounded-full transition-all" 
                                        style={{ width: `${Math.min(100, (totalMinutes / totalCapacity) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="pt-4 border-t flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">Remaining Time</p>
                                <p className="text-2xl font-bold">{remainingMinutes} mins</p>
                            </div>
                            <div className="pt-4 border-t space-y-3">
                                <p className="text-sm font-semibold">Available Slots Left</p>
                                <div className="space-y-2">
                                    {studioSessions?.studioSessions.map(sessionDuration => {
                                        const dur = sessionDuration.duration || 45;
                                        const possibleSlots = Math.floor(remainingMinutes / dur);
                                        return (
                                            <div key={sessionDuration.id} className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">{studioSessions.name} - {sessionDuration.name} ({dur}m)</span>
                                                <Badge variant={possibleSlots > 0 ? "outline" : "destructive"}>
                                                    {possibleSlots} clients
                                                </Badge>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
