import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, inArray, or, and, notInArray, ilike } from "drizzle-orm";
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

    const members = await db.query.member.findMany({
        where: eq(schema.member.userId, session.user.id),
        columns: { id: true, role: true, studioId: true }
    });
    
    const adminRoles = ["owner", "admin", "developer", "manager", "receptionist"];
    const hasAdminRole = members.some((m: any) => adminRoles.includes(m.role));
    const canReassign = members.some((m: any) => ["owner", "admin", "developer", "manager"].includes(m.role));

    // For Drizzle, we will do the query slightly differently or manually filter if relations are complex.
    // Wait, Drizzle doesn't have deep ILIKE directly in `findMany` across relation tables easily without manual joins,
    // but we can query `booking` and just do the base conditions, then filter in memory for search, or do a joined query.
    // Since this is for tasks, let's just use `db.query.booking.findMany` and fetch, then filter `q` in memory to be safe 
    // and keep it simple for Drizzle's relational query API.

    const adminStudioIds = members.filter((m: any) => adminRoles.includes(m.role)).map((m: any) => m.studioId);
    
    const condition = hasAdminRole
        ? or(
            and(
                eq(schema.booking.memberId, ""), // Drizzle null check or empty check? It's likely a null or empty string, let's just fetch both if possible, actually let's use a function to filter in memory for now to guarantee no errors, or just let Drizzle do it.
                adminStudioIds.length > 0 ? inArray(schema.booking.studioId, adminStudioIds) : undefined
            ),
            inArray(schema.booking.studioId, members.map((m: any) => m.studioId)) // A bit broader, we'll filter in JS to be exactly correct based on memberId.
        )
        : undefined; // We will fetch the user's bookings. Wait, `member: { userId: session.user.id }` means we need to find bookings where `memberId` is in the user's member IDs.
    
    const userMemberIds = members.map((m: any) => m.id);

    // Let's do a simpler approach: fetch all bookings for studios the user is in, and then filter.
    const allStudioIds = members.map((m: any) => m.studioId);
    
    const allBookings = allStudioIds.length > 0 ? await db.query.booking.findMany({
        where: and(
            inArray(schema.booking.studioId, allStudioIds),
            notInArray(schema.booking.bookingStatus, ["COMPLETED", "CANCELLED"]),
            notInArray(schema.booking.deliveryStatus, ["DELIVERED"])
        ),
        with: {
            client: true,
            service: true,
            studio: {
                with: {
                    members: {
                        with: { user: true }
                    }
                }
            }
        },
        orderBy: (bookings, { asc }) => [asc(bookings.bookingDate)]
    }) : [];

    const ownerStudioIds = members.filter((m: any) => m.role === "owner").map((m: any) => m.studioId);

    // Memory filter
    const myBookings = allBookings.filter((b: any) => {
        // Base where:
        const isUnassignedInOwnerStudio = (!b.memberId) && ownerStudioIds.includes(b.studioId);
        const isAssignedToMe = userMemberIds.includes(b.memberId);
        const matchesBase = isUnassignedInOwnerStudio || isAssignedToMe;

        if (!matchesBase) return false;

        // Search filter
        if (q) {
            const qLower = q.toLowerCase();
            const clientMatch = b.client?.name?.toLowerCase().includes(qLower);
            const serviceMatch = b.service?.name?.toLowerCase().includes(qLower);
            if (!clientMatch && !serviceMatch) return false;
        }

        return true;
    });

    const isOwner = ownerStudioIds.length > 0;
    const title = isOwner ? "Studio Tasks" : "My Tasks";
    const desc = isOwner ? "Manage unassigned bookings and your own assigned tasks." : "Manage and view your assigned bookings.";

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
                                        {canReassign && <TableHead className="w-50">Assign To</TableHead>}
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {myBookings.map((booking: any) => (
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
                                                        members={booking.studio?.members.map((m: any) => {
                                                            const member = m as { id: string; role: string; studioId: string; createdAt: Date | string; user: { name: string; email: string; } };
                                                            return {
                                                                id: member.id,
                                                                name: member.user.name,
                                                                email: member.user.email,
                                                                role: member.role as MemberRole,
                                                                studioId: member.studioId,
                                                                createdAt: typeof member.createdAt === 'string' ? member.createdAt : member.createdAt.toISOString(),
                                                                updatedAt: typeof member.createdAt === 'string' ? member.createdAt : member.createdAt.toISOString()
                                                            }
                                                        }) || []} 
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
                            {myBookings.map((booking: any) => (
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
                                                    members={booking.studio?.members.map((m: any) => {
                                                        const member = m as { id: string; role: string; studioId: string; createdAt: Date | string; user: { name: string; email: string; } };
                                                        return {
                                                            id: member.id,
                                                            name: member.user.name,
                                                            email: member.user.email,
                                                            role: member.role as MemberRole,
                                                            studioId: member.studioId,
                                                            createdAt: typeof member.createdAt === 'string' ? member.createdAt : member.createdAt.toISOString(),
                                                            updatedAt: typeof member.createdAt === 'string' ? member.createdAt : member.createdAt.toISOString()
                                                        }
                                                    }) || []} 
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
