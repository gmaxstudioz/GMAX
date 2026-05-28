import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { GenericEmptyState } from "@/components/web/generic-empty-state";
import { Calendar01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@/components/ui/input";
import { ReassignMemberDropdown } from "../studios/[slug]/bookings/[date]/ReassignMemberDropdown";
import { MemberRole } from "@/lib/schemas/studio";

import { ViewToggle } from "@/components/web/ViewToggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = {
    title: "My Tasks",
    description: "Manage your assigned tasks and bookings.",
};

interface MyTasksProps {
    searchParams: Promise<{ q?: string; view?: string }>;
}

export default async function MyTasksPage({ searchParams }: MyTasksProps) {
    const { q, view } = await searchParams;
    const isListView = view === "list";
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const members = await prisma.member.findMany({
        where: { userId: session.user.id },
        select: { role: true, studioId: true }
    });
    
    const adminRoles = ["owner", "admin", "developer", "manager", "receptionist"];
    const hasAdminRole = members.some(m => adminRoles.includes(m.role));
    const canReassign = members.some(m => ["owner", "admin", "developer", "manager"].includes(m.role));

    const baseWhere = hasAdminRole 
        ? { 
            OR: [
                { memberId: null, studioId: { in: members.filter(m => adminRoles.includes(m.role)).map(m => m.studioId) } },
                { member: { userId: session.user.id } }
            ]
          }
        : { member: { userId: session.user.id } };

    const searchFilter = q ? {
        OR: [
            { client: { name: { contains: q, mode: 'insensitive' as const } } },
            { service: { name: { contains: q, mode: 'insensitive' as const } } },
        ]
    } : {};

    const myBookings = await prisma.booking.findMany({
        where: {
            ...baseWhere,
            ...searchFilter,
            bookingStatus: {
                notIn: ["COMPLETED", "CANCELLED"]
            },
            deliveryStatus: {
                notIn: ["DELIVERED"]
            }
        },
        include: {
            client: true,
            service: true,
            studio: {
                include: {
                    members: {
                        include: { user: true }
                    }
                }
            }
        },
        orderBy: {
            bookingDate: "asc"
        }
    });

    const title = hasAdminRole ? "Studio Tasks" : "My Tasks";
    const desc = hasAdminRole ? "Manage unassigned bookings and your own assigned tasks." : "Manage and view your assigned bookings.";

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{title}</h1>
                    <p className="text-muted-foreground">{desc}</p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <form method="GET" action="/my-tasks" className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                name="q"
                                type="search"
                                defaultValue={q}
                                placeholder="Search client or service..."
                                className="pl-8 bg-background"
                            />
                        </div>
                        <Button type="submit" variant="secondary">Search</Button>
                    </form>
                    <ViewToggle defaultView="grid" />
                </div>
            </div>

            {myBookings.length === 0 ? (
                <GenericEmptyState
                    className="border border-dashed mt-4"
                    icon={<HugeiconsIcon icon={Calendar01Icon} />}
                    title="No Tasks"
                    description="You have no tasks assigned at the moment."
                />
            ) : (
                <div className="mt-4">
                    {isListView ? (
                        <div className="border rounded-lg overflow-hidden bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Service</TableHead>
                                        <TableHead>Studio</TableHead>
                                        <TableHead>Status</TableHead>
                                        {canReassign && <TableHead className="w-[200px]">Assign To</TableHead>}
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {myBookings.map((booking) => (
                                        <TableRow key={booking.id}>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                {format(new Date(booking.bookingDate), "MMM do, yyyy")}
                                                <br />
                                                <span className="text-muted-foreground text-xs">{format(new Date(booking.bookingDate), "hh:mm a")}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-semibold">{booking.client?.name}</div>
                                                {booking.client?.phone && <div className="text-xs text-muted-foreground">{booking.client.phone}</div>}
                                            </TableCell>
                                            <TableCell>
                                                <div>{booking.service?.name}</div>
                                                <div className="text-xs text-muted-foreground">{booking.sessionCount} {booking.sessionCount > 1 ? "Sessions" : "Session"}</div>
                                            </TableCell>
                                            <TableCell>
                                                {booking.studio?.name}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{String(booking.bookingStatus).replace(/_/g, " ")}</Badge>
                                            </TableCell>
                                            {canReassign && (
                                                <TableCell>
                                                    <ReassignMemberDropdown 
                                                        bookingId={booking.id} 
                                                        currentMemberId={booking.memberId} 
                                                        members={booking.studio?.members.map((m) => ({
                                                            id: (m as any).id,
                                                            name: (m as any).user.name,
                                                            email: (m as any).user.email,
                                                            role: (m as any).role as MemberRole,
                                                            studioId: (m as any).studioId,
                                                            createdAt: (m as any).createdAt.toISOString(),
                                                            updatedAt: (m as any).createdAt.toISOString()
                                                        })) || []} 
                                                        disabled={!canReassign}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/studios/${booking.studio?.slug}/bookings/detail/${booking.id}`}>
                                                        View
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {myBookings.map(booking => (
                                <Card key={booking.id} className="@container/card h-fit">
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg">{booking.client?.name}</CardTitle>
                                            <div className="flex flex-col gap-1 items-end">
                                                <Badge>{String(booking.bookingStatus).replace(/_/g, " ")}</Badge>
                                                <Badge variant="secondary">{booking.sessionCount} {booking.sessionCount > 1 ? "Sessions" : "Session"}</Badge>
                                            </div>
                                        </div>
                                        <CardDescription className="flex flex-col gap-1 mt-2">
                                            <span className="font-semibold text-primary">
                                                {format(new Date(booking.bookingDate), "MMM do, yyyy 'at' hh:mm a")}
                                            </span>
                                            <span>{booking.service?.name}</span>
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-3">
                                        {booking.studio && (
                                            <p className="text-sm font-medium text-muted-foreground">Studio: {booking.studio.name}</p>
                                        )}
                                        {canReassign && (
                                            <div>
                                                <ReassignMemberDropdown 
                                                    bookingId={booking.id} 
                                                    currentMemberId={booking.memberId} 
                                                    members={booking.studio?.members.map((m) => ({
                                                        id: (m as any).id,
                                                        name: (m as any).user.name,
                                                        email: (m as any).user.email,
                                                        role: (m as any).role as MemberRole,
                                                        studioId: (m as any).studioId,
                                                        createdAt: (m as any).createdAt.toISOString(),
                                                        updatedAt: (m as any).createdAt.toISOString()
                                                    })) || []} 
                                                    disabled={!canReassign}
                                                />
                                            </div>
                                        )}
                                        <Button variant="outline" size="sm" className="w-full gap-1.5 mt-1" asChild>
                                            <Link href={`/studios/${booking.studio?.slug}/bookings/detail/${booking.id}`}>
                                                <ExternalLinkIcon className="h-3.5 w-3.5" />
                                                View Details
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
