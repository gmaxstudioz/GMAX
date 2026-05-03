import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GenericEmptyState } from "@/components/web/generic-empty-state";
import { BackButton } from "@/components/web/back-button";
import { Calendar01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ReassignMemberDropdown } from "@/app/(dashboard)/studios/[slug]/bookings/[date]/ReassignMemberDropdown";
import { RescheduleTimePicker } from "@/app/(dashboard)/studios/[slug]/bookings/[date]/RescheduleTimePicker";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuTrigger } from "@/components/ui/context-menu";
import { UpdateBookingDialog } from "@/components/web/bookings/UpdateBookingDialog";
import { ClientOutput, ClientType } from "@/lib/schemas/client";
import { MemberRole, MembersOutput, StudioMetadata, StudioOutput } from "@/lib/schemas/studio";
import { ServiceOutput, ServiceType } from "@/lib/schemas/service";

export const metadata: Metadata = {
    title: "Global Daily Bookings",
};

interface Props {
    params: Promise<{
        date: string; // Format: YYYY-MM-DD
    }>;
}

export default async function GlobalDailyBookingsPage({ params }: Props) {
    const { date } = await params;
    
    const targetDate = parseISO(date);
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    // 1. Fetch bookings with comprehensive relations
    const dailyBookings = await prisma.booking.findMany({
        where: {
            bookingDate: {
                gte: start,
                lte: end,
            }
        },
        include: {
            client: true,
            addons: true,
            studio: {
                include: {
                    members: {
                        include: { user: { select: { name: true, email: true } } }
                    },
                    clients: {
                        select: { id: true, name: true, phone: true, email: true, image: true, type: true }
                    },
                    categories: {
                        include: {
                            services: true
                        }
                    }
                }
            },
            service: {
                include: {
                    studioSession: true
                }
            }
        },
        orderBy: [
            { studio: { name: 'asc' } },
            { bookingDate: 'asc' }
        ]
    });

    // 2. Group bookings by studio and prepare specific lists for UI components
    const groupedBookings = dailyBookings.reduce((acc, booking) => {
        const studioId = booking.studio.id;
        
        if (!acc[studioId]) {
            // Flatten services from categories
            const allServices = booking.studio.categories.flatMap(cat => cat.services);
            const ownerMember = booking.studio.members.find(m => m.role === "owner");
            
            acc[studioId] = {
                studio: {
                    id: booking.studio.id,
                    name: booking.studio.name,
                    slug: booking.studio.slug,
                    logo: booking.studio.logo ?? undefined,
                    metadata: booking.studio.metadata as StudioMetadata,
                    ownerId: ownerMember?.userId ?? "",
                    createdAt: booking.studio.createdAt.toISOString(),
                    updatedAt: booking.studio.updatedAt.toISOString(),
                },
                bookings: [],
                totalMinutes: 0,
                // These are passed to the UpdateBookingDialog
                studioClients: booking.studio.clients.map(c => ({
                    id: c.id,
                    name: c.name,
                    phone: c.phone,
                    clientType: c.type as ClientType,
                    email: c.email ?? undefined,
                    image: c.image ?? undefined,
                })),
                studioServices: allServices.map(s => ({
                    ...s,
                    type: s.type as ServiceType,
                    salePrice: s.salePrice ?? undefined,
                })),
                studioMembers: booking.studio.members.map(m => ({
                    id: m.id,
                    name: m.user.name,
                    email: m.user.email,
                    role: m.role as MemberRole,
                    studioId: m.studioId,
                    createdAt: m.createdAt.toISOString(),
                    updatedAt: m.createdAt.toISOString()
                }))
            };
        }
        
        acc[studioId].bookings.push(booking);
        const duration = booking.service?.studioSession?.duration || 45;
        acc[studioId].totalMinutes += (duration * booking.sessionCount);
        
        return acc;
    }, {} as Record<string, {
        studio: StudioOutput,
        bookings: typeof dailyBookings,
        totalMinutes: number,
        studioClients: ClientOutput[],
        studioServices: ServiceOutput[],
        studioMembers: MembersOutput[]
    }>);

    const studios = Object.values(groupedBookings);

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <div className="flex items-center gap-4">
                <BackButton href="/bookings" />
                <div>
                    <h1 className="text-2xl font-bold">System Bookings for {format(targetDate, "MMM do, yyyy")}</h1>
                    <p className="text-muted-foreground">All Studios</p>
                </div>
            </div>

            {studios.length === 0 ? (
                <GenericEmptyState
                    className="border border-dashed"
                    icon={<HugeiconsIcon icon={Calendar01Icon} />}
                    title="No Bookings"
                    description={`No bookings found for ${format(targetDate, "MMM do, yyyy")}.`}
                />
            ) : (
                <div className="flex flex-col gap-8">
                    {studios.map((group) => {
                        const totalCapacity = 720;
                        const remainingMinutes = Math.max(0, totalCapacity - group.totalMinutes);
                        const percentFilled = Math.min(100, (group.totalMinutes / totalCapacity) * 100);

                        return (
                            <div key={group.studio.id} className="space-y-4">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl font-bold">{group.studio.name}</h2>
                                        <Badge variant={percentFilled >= 100 ? "destructive" : "secondary"}>
                                            {percentFilled >= 100 ? "Fully Booked" : `${remainingMinutes} mins left`}
                                        </Badge>
                                    </div>
                                    <Button variant="ghost" size="sm" asChild>
                                        <Link href={`/studios/${group.studio.slug}/bookings/${date}`}>
                                            View in Studio
                                        </Link>
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {group.bookings.map((booking) => (
                                        <ContextMenu key={booking.id}>
                                            <ContextMenuTrigger>
                                                <Card className="@container/card h-fit">
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
                                                            <ReassignMemberDropdown 
                                                                bookingId={booking.id} 
                                                                currentMemberId={booking.memberId} 
                                                                members={group.studioMembers} 
                                                            />
                                                        </div>
                                                        <Button variant="outline" size="sm" className="w-full gap-1.5 mt-1" asChild>
                                                            <Link href={`/studios/${group.studio.slug}/bookings/detail/${booking.id}`}>
                                                                <ExternalLinkIcon className="h-3.5 w-3.5" />
                                                                View Details
                                                            </Link>
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            </ContextMenuTrigger>
                                            <ContextMenuContent>
                                                <ContextMenuGroup>
                                                    <ContextMenuLabel>Actions</ContextMenuLabel>
                                                    <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                                                       {/* Note: UpdateBookingDialog is usually a Dialog, so ensure it works correctly inside a ContextMenu (often requires a DialogTrigger wrap) */}
                                                        <UpdateBookingDialog
                                                            bookingId={booking.id}
                                                            clients={group.studioClients}
                                                            services={group.studioServices}
                                                            members={group.studioMembers}
                                                            currentData={{
                                                                notes: booking.notes || "",
                                                                sessionCount: booking.sessionCount,
                                                                bookingStatus: booking.bookingStatus,
                                                                paymentStatus: booking.paymentStatus,
                                                                deliveryStatus: booking.deliveryStatus,
                                                                clientId: booking.clientId,
                                                                serviceId: booking.serviceId,
                                                                memberId: booking.memberId || "",
                                                                bookingDate: booking.bookingDate.toISOString(),
                                                                addonIds: booking.addons.map(addon => addon.id)
                                                            }}
                                                        />
                                                    </div>
                                                    <ContextMenuItem className="text-destructive">Delete</ContextMenuItem>
                                                    <ContextMenuItem>Cancel</ContextMenuItem>
                                                </ContextMenuGroup>
                                            </ContextMenuContent>
                                        </ContextMenu>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}