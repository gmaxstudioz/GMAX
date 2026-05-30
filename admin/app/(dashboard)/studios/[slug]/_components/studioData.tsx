"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { Prisma } from "@/lib/generated/prisma/client";
import { InviteMemberInput, InviteMemberSchema } from "@/lib/schemas/studio";
import { zodResolver } from "@hookform/resolvers/zod";
import { Filter, Loading, MoreVerticalIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { BadgeCheck, MailIcon, Phone, PlusIcon, UsersIcon, CalendarCheckIcon, LayersIcon, ArrowRightIcon, SearchIcon, ChevronDown, MessageCircle, ExternalLink, Trash } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import { useTransition, useState, useMemo, useEffect, Suspense } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { CalenderGrid } from "./calender/Calender";
import { DateTimeSlotPicker } from "./DateTimeSlotPicker";
import AddClient from "./AddClient";
import { tryCatch } from "@/hooks/try-catch";
import { DeleteClient, FetchClients } from "@/lib/actions/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateBookingSchema, CreateBookingInput, Booking } from "@/lib/schemas/booking";
import { createBooking } from "@/lib/actions/booking";
import { moveBooking } from "@/lib/actions/calendar";
import { inviteMember } from "@/lib/actions/invitation";
import { FieldLabel } from "@/components/ui/field";
import { EditClientDialog } from "../client/[clientId]/_components/edit-client-dialog";
import UpdateStudio from "./UpdateStudio";
import StudioServices from "./StudioServices";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { CalendarBooking } from "@/lib/schemas/calendar";
import { ClientType } from "@/lib/schemas/client";
import { Reviews } from "./Reviews";
import { ViewToggle } from "@/components/web/ViewToggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPrismaBookingToBooking(b: any): Booking {
    return {
        bookingDate: b.bookingDate,
        sessionCount: b.sessionCount,
        notes: b.notes || undefined,
        totalAmount: Number(b.totalAmount),
        paymentPlan: b.paymentPlan,
        bookingStatus: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        deliveryStatus: b.deliveryStatus,
        serviceId: b.serviceId,
        serviceVariantId: b.serviceVariantId || undefined,
        studioId: b.studioId,
        clientId: b.clientId,
        memberId: b.memberId || undefined,
        createdBy: b.createdBy,
    } as Booking;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPrismaBookingToCalendarBooking(b: any): CalendarBooking {
    return {
        id: b.id,
        bookingDate: b.bookingDate,
        sessionCount: b.sessionCount,
        notes: b.notes || undefined,
        totalAmount: Number(b.totalAmount),
        paymentPlan: b.paymentPlan,
        bookingStatus: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        deliveryStatus: b.deliveryStatus,
        serviceId: b.serviceId,
        serviceVariantId: b.serviceVariantId || undefined,
        studioId: b.studioId,
        clientId: b.clientId,
        memberId: b.memberId || undefined,
        createdBy: b.createdBy,
        client: { name: b.client?.name || "Unknown" },
        service: { name: b.service?.name || "Unknown" },
    } as CalendarBooking;
}

type StudioWithRelations = Prisma.StudioGetPayload<{
  include: {
    members: {
        include: { user: true }
    },
    invitations: true,
    services: {
        include: { 
            studioSession: true,
            variants: { include: { deliverables: true } }
        }
    },
    studioSessions: true,
    clients: {
        include: {
            bookings: true
        }
    },
    bookings: {
      include: {
        client: true,
        service: true
      }
    },
    bookingIntents: true,
  }
}>;

function Overview({ data, setActiveTab, userRole }: { data: StudioWithRelations, setActiveTab: (v: string) => void, userRole: string }) {
    if (userRole === "receptionist") {
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const bookingsCompleted = data.bookings.filter(b => b.bookingStatus === "COMPLETED").length;
        const paymentsCompleted = data.bookings.filter(b => b.paymentStatus === "PAID").length;
        const intentsToday = data.bookingIntents.filter(i => {
            const d = new Date(i.createdAt);
            return d >= todayStart && d <= todayEnd;
        }).length;

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Bookings Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{bookingsCompleted}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Payments Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{paymentsCompleted}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Booking Intents Today</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{intentsToday}</div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Recent Bookings (sort descending by date created)
    const recentBookings = [...data.bookings]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* ── RECENT BOOKINGS ROW ── */}
                <Card className="md:col-span-8 flex flex-col">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="font-bold text-xl">Recent Bookings</CardTitle>
                                <CardDescription>Your latest 5 client bookings at a glance.</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" className="hidden sm:flex" asChild>
                                <a href="#bookings">
                                    View All <ArrowRightIcon className="size-4 ml-1" />
                                </a>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {recentBookings.length === 0 ? (
                            <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground border-2 border-dashed rounded-md bg-secondary/20">
                                <CalendarCheckIcon className="size-10 mb-4 opacity-50" />
                                <p className="font-medium text-foreground">No bookings found</p>
                                <p className="text-sm">You have zero bookings so far. Add a client to get started!</p>
                            </div>
                        ) : (
                            <div className="flex flex-col space-y-4">
                                {recentBookings.map((b) => {
                                    const safeClientName = b.client?.name || "Unknown Client";
                                    return (
                                    <div key={b.id} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="size-10">
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                    {safeClientName.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <p className="text-sm font-semibold">{safeClientName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {/* b.service is typed safely because we injected it, but fallback to Booking ID if somehow missing */}
                                                    {b.service?.name || "Standard Booking"} 
                                                    • {format(new Date(b.bookingDate), "PPp")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge variant={b.bookingStatus === "COMPLETED" ? "default" : "secondary"} className="text-[10px]">
                                                {b.bookingStatus}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border hidden sm:flex">
                                                {b.paymentStatus}
                                            </Badge>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── QUICK ACTIONS ── */}
                <Card className="md:col-span-4">
                    <CardHeader>
                        <CardTitle className="font-bold text-xl">Quick Launch</CardTitle>
                        <CardDescription>Rapidly access common tasks.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <Button variant="outline" className="justify-start shadow-sm h-11" onClick={() => setActiveTab("clients")}>
                            <PlusIcon className="size-4 mr-2" />
                            Register New Client
                        </Button>
                        <Button variant="outline" className="justify-start shadow-sm h-11" onClick={() => setActiveTab("services")}>
                            <LayersIcon className="size-4 mr-2" />
                            Add Studio Service
                        </Button>
                        <Button variant="outline" className="justify-start shadow-sm h-11" onClick={() => setActiveTab("staffs")}>
                            <UsersIcon className="size-4 mr-2" />
                            Invite Staff Member
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


function Clients({ studioData, userRole }: { studioData: StudioWithRelations, userRole: string }) {
    const canAdd = ["owner", "developer", "manager", "admin", "receptionist"].includes(userRole);
    const canEditClient = ["owner", "developer", "manager", "admin"].includes(userRole);
    const [ isPending, startTransition ] = useTransition();
    const searchParamsHooks = useSearchParams();

    function handleDelete(clientId: string) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(DeleteClient(clientId));

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                toast.success("Client deleted successfully");
            } else if (result?.status === "error") {
                toast.error(result?.message);
            }
        });
    };

    function handleRefresh() {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(FetchClients(studioData.id));

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                toast.success("Refreshed Successfully");
            } else if (result?.status === "error") {
                toast.error(result?.message);
            }
        });
    }

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [filterType, setFilterType] = useState<string>("ALL");
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    useEffect(() => {
        const t = setTimeout(() => setPage(1), 0);
        return () => clearTimeout(t);
    }, [debouncedSearch, filterType]);

    const filteredClients = studioData.clients.filter((client) => {
        const query = debouncedSearch.toLowerCase();
        const matchesSearch = client.name.toLowerCase().includes(query) || 
                              (client.email && client.email.toLowerCase().includes(query)) ||
                              client.phone.includes(query);
        const matchesFilter = filterType === "ALL" || client.type === filterType;
        return matchesSearch && matchesFilter;
    });

    const totalClients = filteredClients.length;
    const totalPages = Math.ceil(totalClients / ITEMS_PER_PAGE);
    const paginatedClients = filteredClients.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const allTypes = Array.from(new Set(studioData.clients.map(c => c.type)));

    const isListView = searchParamsHooks.get("view") !== "grid";

    return (
        <Card>
            <CardHeader className="flex flex-col xl:flex-row xl:justify-between items-start xl:items-center gap-4">
                <div className="flex flex-col gap-1 shrink-0">
                    <CardTitle className="font-bold text-xl flex gap-2">Clients <span className="font-extrabold text-primary">{totalClients}</span></CardTitle>
                    <CardDescription>Manage the Clients of this studio</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <form className="relative w-full sm:w-[300px]">
                                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    name="search" 
                                    type="search" 
                                    placeholder="Search clients..." 
                                    className="pl-8 bg-background" 
                                    defaultValue={searchParamsHooks.get("search") || ""}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </form>
                            {canAdd && <AddClient studioId={studioData.id} />}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-10 min-w-32 justify-between">
                                <span className="flex items-center gap-2">
                                    <HugeiconsIcon icon={Filter} className="size-4" />
                                    {filterType === "ALL" ? "All Types" : filterType}
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setFilterType("ALL")}>All Types</DropdownMenuItem>
                            {allTypes.map(t => (
                                <DropdownMenuItem key={t} onClick={() => setFilterType(t)}>{t}</DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ViewToggle defaultView="list" />
                    <Button onClick={handleRefresh} type="button" variant="outline" size="icon" disabled={isPending} className="h-10 w-10 shrink-0">
                        {isPending ? <HugeiconsIcon icon={Loading} className="animate-spin" /> : <HugeiconsIcon icon={Refresh01Icon} />}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {filteredClients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/10 h-64">
                        <SearchIcon className="size-10 text-muted-foreground mb-4 opacity-50" />
                        <p className="font-semibold text-lg">No clients found</p>
                        <p className="text-sm text-muted-foreground max-w-sm mt-2">
                            {search || filterType !== "ALL" ? "Try adjusting your search query or filter to find what you're looking for." : "You haven't added any clients yet."}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {isListView ? (
                            <div className="border rounded-md mt-2">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Bookings</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedClients.map((client) => (
                                            <TableRow key={client.id}>
                                                <TableCell>
                                                    <div className="font-medium">{client.name}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1"><Phone size={12} /> {client.phone}</span>
                                                        {client.email && <span className="flex items-center gap-1"><MailIcon size={12} /> {client.email}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="font-bold text-primary">{client.bookings?.length || 0} Total</span>
                                                        <span className="text-muted-foreground">({client.bookings?.filter(b => b.bookingStatus === "COMPLETED").length || 0} Done)</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px]"><BadgeCheck className="size-3 mr-1" />{client.type}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right flex items-center justify-end gap-1">
                                                    {canEditClient && (
                                                        <>
                                                            <EditClientDialog 
                                                                clientId={client.id}
                                                                initialData={{
                                                                    name: client.name,
                                                                    email: client.email,
                                                                    phone: client.phone,
                                                                    address: client.address,
                                                                    notes: client.notes,
                                                                    type: client.type as ClientType
                                                                }}
                                                                triggerItem={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><HugeiconsIcon icon={MoreVerticalIcon} className="size-4" /></Button>}
                                                            />
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(client.id)}>
                                                                <Trash className="size-4" /> 
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Link href={`/studios/${studioData.slug}/client/${client.id}`}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                            <ArrowRightIcon className="size-4" />
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
                                {paginatedClients.map((client) => (
                                    <ContextMenu key={client.id}>
                                        <ContextMenuTrigger>
                                            <Card className="@container/card">
                                                <CardHeader>
                                                    <div className="w-full flex items-center justify-between">
                                                        <CardTitle className="text-lg font-bold">{client.name}</CardTitle>
                                                        <Badge variant="outline">
                                                            <BadgeCheck data-icon="inline-start" />
                                                            {client.type}
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="text-muted-foreground flex flex-col gap-2">
                                                    <div className="flex flex-col gap-2 mb-2">
                                                        <p className="text-foreground/80 font-semibold">Bookings</p>
                                                        <div className="flex items-center justify-between gap-1 w-full">
                                                            <div className="rounded w-full bg-accent p-2">
                                                                <p className="text-xs">Total</p>
                                                                <p className="font-bold text-primary">{client.bookings?.length || 0}</p>
                                                            </div>
                                                            <div className="rounded w-full bg-accent p-2">
                                                                <p className="text-xs">Completed</p>
                                                                <p className="font-bold text-primary">{client.bookings?.filter((booking) => booking.bookingStatus === "COMPLETED").length || 0}</p>
                                                            </div>
                                                            <div className="rounded w-full bg-accent p-2">
                                                                <p className="text-xs">Cancelled</p>
                                                                <p className="font-bold text-primary">{client.bookings?.filter((booking) => booking.bookingStatus === "CANCELLED").length || 0}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-foreground/80 font-semibold">Contact</p>
                                                        <div className="flex items-center gap-1">
                                                            <Phone size={16} className="text-foreground" />
                                                            <p className="flex gap-1.5">{client.phone}</p>
                                                        </div>
                                                    {client.email && (
                                                        <p className="flex gap-1.5">
                                                            <MailIcon size={16} className="text-foreground" />
                                                            {client.email}
                                                        </p>
                                                    )}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-1 mt-4">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="secondary" size="icon">
                                                                    <HugeiconsIcon icon={MoreVerticalIcon} />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                                                                {canEditClient && (
                                                                    <>
                                                                        <EditClientDialog 
                                                                            clientId={client.id}
                                                                            initialData={{
                                                                                name: client.name,
                                                                                email: client.email,
                                                                                phone: client.phone,
                                                                                address: client.address,
                                                                                notes: client.notes,
                                                                                type: client.type as ClientType
                                                                            }}
                                                                            triggerItem={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>}
                                                                        />
                                                                        <DropdownMenuItem onClick={() =>handleDelete(client.id)} className="text-red-500 font-medium">Delete</DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <Link className={buttonVariants({variant: "default", className: "flex-1 cursor-pointer"})} href={`/studios/${studioData.slug}/client/${client.id}`}>
                                                            View Details
                                                        </Link>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent>
                                            <ContextMenuLabel className="text-xs">Actions</ContextMenuLabel>
                                            {canEditClient && (
                                                <>
                                                    <EditClientDialog 
                                                        clientId={client.id}
                                                        initialData={{
                                                            name: client.name,
                                                            email: client.email,
                                                            phone: client.phone,
                                                            address: client.address,
                                                            notes: client.notes,
                                                            type: client.type as ClientType
                                                        }}
                                                        triggerItem={<ContextMenuItem onSelect={(e) => e.preventDefault()}>Edit</ContextMenuItem>}
                                                    />
                                                    <ContextMenuItem onClick={() =>handleDelete(client.id)} className="text-red-500 font-medium">Delete</ContextMenuItem>
                                                </>
                                            )}
                                        </ContextMenuContent>
                                    </ContextMenu>     
                                ))}
                            </div>
                        )}
                        {totalPages > 1 && (
                            <Pagination className="mt-4">
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                                    </PaginationItem>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                        <PaginationItem key={p}>
                                            <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">
                                                {p}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ))}
                                    <PaginationItem>
                                        <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function Staffs({studioData}: {studioData: StudioWithRelations}) {
    const [ isPending, startTransition ] = useTransition();
    const form = useForm<InviteMemberInput>({
        resolver: zodResolver(InviteMemberSchema),
        defaultValues: {
            email: "",
            role: "photographer",
            studio: studioData.id
        },
    });
    async function handleAddStaff(values: InviteMemberInput) {
        startTransition(async () => {
            const result = await inviteMember(values, studioData.id);
            if (result.status === "error") {
                toast.error(result.message || "Failed to invite staff");
            } else {
                toast.success("Staff invited successfully");
                form.reset();
            }
        });
    }
    function handleDelete(memberId: string) {
        startTransition(async () => {
            const { error } = await authClient.organization.removeMember({
                memberIdOrEmail:memberId,
                organizationId: studioData.id,
            });

            if (error) {
                toast.error(error.message || "Failed to remove staff");
            } else {
                toast.success("Staff removed successfully");
            }
        });
    }
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 6;
    const totalStaff = studioData.members.length;
    const totalPages = Math.ceil(totalStaff / ITEMS_PER_PAGE);
    const paginatedStaff = studioData.members.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
         <Card>
            <CardHeader className="flex justify-between w-full">
                <div className="flex flex-col gap-1">
                    <CardTitle className="font-bold text-xl">Staff Member</CardTitle>
                    <CardDescription>Manage the Staff Members assigned to this studio</CardDescription>
                </div>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <PlusIcon className="mr-2 size-4" />
                            Add Staff
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold">Add Staff</DialogTitle>
                            <DialogDescription>
                                Add a new staff member to your studio.
                            </DialogDescription>
                            <form className="flex flex-col gap-1 mt-4" onSubmit={form.handleSubmit(handleAddStaff)}>
                                <FieldGroup className="flex flex-col gap-2">
                                    <Controller
                                        name="email"
                                        control={form.control}
                                        render={({field}) => (
                                            <Field>
                                                <Label>Email</Label>
                                                <Input {...field} />
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name="phone"
                                        control={form.control}
                                        render={({field}) => (
                                            <Field>
                                                <Label>Phone (Optional for SMS)</Label>
                                                <Input {...field} placeholder="+234..." />
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name="role"
                                        control={form.control}
                                        render={({field}) => (
                                            <Field>
                                                <Label>Role</Label>
                                                <Select
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="manager">Manager</SelectItem>
                                                        <SelectItem value="photographer">Photographer</SelectItem>
                                                        <SelectItem value="videographer">Videographer</SelectItem>
                                                        <SelectItem value="receptionist">Receptionist</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </Field>
                                        )}
                                    />
                                </FieldGroup>
                                <Button type="submit" className="mt-4" disabled={isPending}>{isPending ? <HugeiconsIcon icon={Loading} className="animate-spin" /> : "Add Staff"}</Button>
                            </form>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
                        {paginatedStaff.map((member) => (
                            <ContextMenu key={member.id}>
                                <ContextMenuTrigger>
                                    <Card className="@container/card">
                                        <CardHeader>
                                            <div className="w-full flex justify-between">
                                                <div className="flex items-center gap-1">
                                                    <Avatar>
                                                        <AvatarImage src={member.user.image || "/images/placeholder.jpg"} />
                                                        <AvatarFallback>{member.user.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <CardTitle>{member.user.name}</CardTitle>
                                                        <CardDescription className="text-xs">{member.user.email}</CardDescription>
                                                    </div>
                                                </div>
                                                <Badge>
                                                    <BadgeCheck data-icon="inline-start" />
                                                    {member.role}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-col gap-2 mb-2">
                                                <p className="text-foreground/80 font-semibold">Bookings</p>
                                                <div className="flex items-center justify-between gap-1 w-full">
                                                    <div className="rounded w-full bg-accent p-2">
                                                        <p className="text-xs">Total</p>
                                                        <p className="font-bold text-primary">0</p>
                                                    </div>
                                                    <div className="rounded w-full bg-accent p-2">
                                                        <p className="text-xs">Completed</p>
                                                        <p className="font-bold text-primary">0</p>
                                                    </div>
                                                    <div className="rounded w-full bg-accent p-2">
                                                        <p className="text-xs">Cancelled</p>
                                                        <p className="font-bold text-primary">0</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 mt-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="secondary" size="icon">
                                                            <HugeiconsIcon icon={MoreVerticalIcon} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() =>handleDelete(member.id)}>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <Link className={buttonVariants({variant: "default", className: "flex-1 cursor-pointer"})} href={`/studios/${studioData.slug}/staff/${member.id}`}>
                                                    View Details
                                                </Link>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </ContextMenuTrigger>
                                    <ContextMenuContent>
                                        <ContextMenuLabel className="text-xs">Actions</ContextMenuLabel>
                                        <ContextMenuItem>Edit</ContextMenuItem>
                                        <ContextMenuItem>Delete</ContextMenuItem>
                                </ContextMenuContent>
                            </ContextMenu>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <Pagination className="mt-4">
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                                </PaginationItem>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                    <PaginationItem key={p}>
                                        <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">
                                            {p}
                                        </PaginationLink>
                                    </PaginationItem>
                                ))}
                                <PaginationItem>
                                    <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
function Bookings({ studioData, userRole }: { studioData: StudioWithRelations, userRole: string }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [serviceSearch, setServiceSearch] = useState("");
    const [clientSearch, setClientSearch] = useState("");
    const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
    const [clientOpen, setClientOpen] = useState(false);
    const [serviceOpen, setServiceOpen] = useState(false);
    const canAdd = ["owner", "developer", "manager", "admin", "receptionist"].includes(userRole);
    const searchParams = useSearchParams();

    const form = useForm<CreateBookingInput>({
        resolver: zodResolver(CreateBookingSchema),
        defaultValues: {
            sessionCount: 1,
            extraPicturesCount: 0,
            bookingStatus: "PENDING",
            paymentStatus: "PENDING",
            deliveryStatus: "PENDING",
            notes: "",
            addonIds: [],
            totalAmount: 0,
            paymentPlan: "FULL",
        }
    });

    useEffect(() => {
        if (searchParams.get("action") === "add-booking") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setOpen(true);
            const dateStr = searchParams.get("date");
            if (dateStr && !isNaN(new Date(dateStr).getTime())) {
                form.setValue("bookingDate", new Date(dateStr));
            }
        }
    }, [searchParams, form]);

    const allServices = useMemo(() => studioData.services, [studioData.services]);

    // Split into main services and addons
    const mainServices = useMemo(() => allServices.filter(s => !s.isAddon), [allServices]);
    const addonServices = useMemo(() => allServices.filter(s => s.isAddon), [allServices]);

    // Filter services by search
    const filteredMainServices = useMemo(() => {
        if (!serviceSearch.trim()) return mainServices;
        const q = serviceSearch.toLowerCase();
        return mainServices.filter(s => s.name.toLowerCase().includes(q));
    }, [mainServices, serviceSearch]);

    // Flatten addons into variants
    const flattenedAddons = useMemo(() => {
        return addonServices.flatMap(addon => 
            (addon.variants || []).map((variant) => ({
                compositeId: `${addon.id}:${variant.id}`,
                addon,
                variant
            }))
        );
    }, [addonServices]);

    const filteredAddonVariants = useMemo(() => {
        if (!serviceSearch.trim()) return flattenedAddons;
        const q = serviceSearch.toLowerCase();
        return flattenedAddons.filter(a => a.addon.name.toLowerCase().includes(q) || a.variant.locationType.toLowerCase().includes(q));
    }, [flattenedAddons, serviceSearch]);

    // Filter clients by search
    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return studioData.clients;
        const q = clientSearch.toLowerCase();
        return studioData.clients.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }, [studioData.clients, clientSearch]);

    // Watch reactive values for price calculation
    const watchedServiceId      = useWatch({ control: form.control, name: "serviceId" });
    const watchedServiceVariantId = useWatch({ control: form.control, name: "serviceVariantId" });
    const watchedSessionCount   = useWatch({ control: form.control, name: "sessionCount" }) ?? 1;
    const watchedClientId       = useWatch({ control: form.control, name: "clientId" });
    const watchedPaymentPlan    = useWatch({ control: form.control, name: "paymentPlan" }) ?? "FULL";
    const watchedTotalAmount    = useWatch({ control: form.control, name: "totalAmount" }) ?? 0;

    const selectedService = useMemo(() => allServices.find(s => s.id === watchedServiceId), [allServices, watchedServiceId]);
    const selectedVariant = useMemo(() => selectedService?.variants?.find((v) => v.id === watchedServiceVariantId), [selectedService, watchedServiceVariantId]);
    const selectedClient = useMemo(() => studioData.clients.find(c => c.id === watchedClientId), [studioData.clients, watchedClientId]);
    const selectedAddonVariants = useMemo(() => flattenedAddons.filter(a => selectedAddonIds.includes(a.compositeId)), [flattenedAddons, selectedAddonIds]);

    const servicePrice = selectedVariant?.basePrice ? Number(selectedVariant.basePrice) : 0;
    const sessionTotal = servicePrice * (watchedSessionCount || 1);
    const addonsTotal = selectedAddonVariants.reduce((sum, a) => sum + Number(a.variant.basePrice || 0), 0);
    const grandTotal = sessionTotal + addonsTotal;

    useEffect(() => {
        form.setValue("totalAmount", grandTotal);
    }, [grandTotal, form]);

    function toggleAddon(compositeId: string) {
        setSelectedAddonIds(prev => {
            const baseAddonId = compositeId.split(':')[0];
            
            // Remove any existing variant of this exact same addon
            const filtered = prev.filter(id => id.split(':')[0] !== baseAddonId);
            
            // If the exact same composite ID was clicked, it means we are unchecking it
            if (prev.includes(compositeId)) {
                form.setValue("addonIds", filtered);
                return filtered;
            }
            
            // Otherwise, add the new selection
            const next = [...filtered, compositeId];
            form.setValue("addonIds", next);
            return next;
        });
    }

    function onSubmit(data: CreateBookingInput) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(createBooking(data, studioData.id));

            if (error) {
                toast.error("Failed to create booking. Please try again.");
                return;
            }

            if (result?.status === "success") {
                toast.success("Booking successfully added!");
                form.reset();
                setSelectedAddonIds([]);
                setServiceSearch("");
                setClientSearch("");
                setOpen(false);
            } else {
                toast.error(result?.message || "Failed to add booking.");
            }
        });
    }

    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <div className="flex flex-col gap-1">
                    <CardTitle className="font-bold text-xl flex gap-2">Bookings <span className="font-extrabold text-primary">{studioData.bookings.length}</span></CardTitle>
                    <CardDescription>Manage the Bookings of this studio</CardDescription>
                </div>
                {canAdd && (
                    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); setServiceSearch(""); setClientSearch(""); setSelectedAddonIds([]); setClientOpen(false); setServiceOpen(false); } }}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <PlusIcon className="mr-2 h-4 w-4" />
                                Add Booking
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[520px]">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold">Add Booking</DialogTitle>
                                <DialogDescription>
                                    Schedule a new session by selecting the client, service, and assigned team member.
                                </DialogDescription>
                            </DialogHeader>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2 mt-2 max-h-[70vh] overflow-y-auto px-1">
                            {/* Client Selection with Search */}
                            <Controller
                                name="clientId"
                                control={form.control}
                                render={({ field }) => {
                                    return (
                                        <Field>
                                            <FieldLabel>Select Client</FieldLabel>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setClientOpen(!clientOpen)}
                                                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                                                >
                                                    <span className={selectedClient ? "" : "text-muted-foreground"}>
                                                        {selectedClient ? selectedClient.name : "Choose a client..."}
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                                </button>
                                                {clientOpen && (
                                                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                                                        <div className="p-2 border-b">
                                                            <Input
                                                                placeholder="Search clients..."
                                                                value={clientSearch}
                                                                onChange={(e) => setClientSearch(e.target.value)}
                                                                className="h-8"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div className="max-h-[200px] overflow-y-auto p-1">
                                                            {filteredClients.length > 0 ? filteredClients.map(c => (
                                                                <div
                                                                    key={c.id}
                                                                    onClick={() => { field.onChange(c.id); setClientOpen(false); setClientSearch(""); }}
                                                                    className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm rounded-md transition-colors hover:bg-accent ${field.value === c.id ? "bg-accent font-medium" : ""}`}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar className="h-6 w-6">
                                                                            <AvatarImage src={c.image || undefined} />
                                                                            <AvatarFallback className="text-[10px]">{c.name.slice(0,2).toUpperCase()}</AvatarFallback>
                                                                        </Avatar>
                                                                        <span>{c.name}</span>
                                                                    </div>
                                                                    <Badge variant="outline" className="text-[10px] capitalize">{c.type}</Badge>
                                                                </div>
                                                            )) : (
                                                                <div className="text-center py-3">
                                                                    <p className="text-sm text-muted-foreground mb-2">No clients found</p>
                                                                    <AddClient 
                                                                        studioId={studioData.id} 
                                                                        onSuccess={(clientId) => {
                                                                            form.setValue("clientId", clientId);
                                                                            setClientOpen(false);
                                                                            setClientSearch("");
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Field>
                                    );
                                }}
                            />

                            {/* Service Selection with Search */}
                            <Controller
                                name="serviceId"
                                control={form.control}
                                render={({ field }) => {
                                    return (
                                        <Field>
                                            <FieldLabel>Select Service</FieldLabel>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setServiceOpen(!serviceOpen)}
                                                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <span className={selectedService ? "" : "text-muted-foreground"}>
                                                        {selectedService ? (
                                                            <span className="flex items-center gap-2">
                                                                {selectedService.name}
                                                            </span>
                                                        ) : "Choose a service..."}
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                                </button>
                                                {serviceOpen && (
                                                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                                                        <div className="p-2 border-b">
                                                            <Input
                                                                placeholder="Search services..."
                                                                value={serviceSearch}
                                                                onChange={(e) => setServiceSearch(e.target.value)}
                                                                className="h-8"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div className="max-h-[200px] overflow-y-auto p-1">
                                                            {filteredMainServices.length > 0 ? filteredMainServices.map(s => (
                                                                <div
                                                                    key={s.id}
                                                                    onClick={() => { field.onChange(s.id); form.setValue("serviceVariantId", ""); setServiceOpen(false); setServiceSearch(""); }}
                                                                    className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm rounded-md transition-colors hover:bg-accent ${field.value === s.id ? "bg-accent font-medium" : ""}`}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span>{s.name}</span>
                                                                    </div>
                                                                    <span className="text-muted-foreground font-mono text-xs">
                                                                        ₦{Number(s.variants?.[0]?.basePrice ?? 0).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            )) : (
                                                                <p className="text-sm text-muted-foreground text-center py-4">No services found</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Field>
                                    );
                                }}
                            />

                            {/* Variant Selection */}
                            {selectedService && selectedService.variants && selectedService.variants.length > 0 && (
                                <Controller
                                    name="serviceVariantId"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel>Select Variant (Location Type)</FieldLabel>
                                            <Select
                                                value={field.value || ""}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Choose location type..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {selectedService.variants.map((v) => (
                                                        <SelectItem key={v.id} value={v.id}>
                                                            {v.locationType} - ₦{Number(v.basePrice).toLocaleString()}
                                                            {v.maxPrice && ` to ₦${Number(v.maxPrice).toLocaleString()}`}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                />
                            )}

                            {/* Logistics Warning */}
                            {selectedVariant && !selectedVariant.logisticsIncluded && selectedVariant.locationType === "OUTDOOR" && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md text-sm">
                                    <p className="font-semibold mb-1">Logistics Not Included</p>
                                    <p className="text-xs">This outdoor variant does not cover transportation logistics. The client must handle or pay separately for logistics.</p>
                                </div>
                            )}

                            {/* Deliverables Read-only Summary */}
                            {selectedVariant && selectedVariant.deliverables && selectedVariant.deliverables.length > 0 && (
                                <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Included Deliverables</p>
                                    <ul className="text-sm space-y-1">
                                        {selectedVariant.deliverables.map((d) => (
                                            <li key={d.id} className="flex gap-2 text-foreground/80">
                                                <span className="text-primary">•</span>
                                                <span>
                                                    {d.quantity ? `${d.quantity} ` : ""}{d.label}
                                                    {d.detail && <span className="text-muted-foreground text-xs ml-1">({d.detail})</span>}
                                                    {d.isFree && <Badge variant="secondary" className="text-[9px] ml-2 font-normal">Free</Badge>}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Addon Selection */}
                            {flattenedAddons.length > 0 && (
                                <Field>
                                    <FieldLabel>Add-ons <span className="text-muted-foreground font-normal">(Optional)</span></FieldLabel>
                                    <div className="border rounded-lg max-h-[220px] overflow-y-auto">
                                        {filteredAddonVariants.length > 0 ? filteredAddonVariants.map(item => (
                                            <label
                                                key={item.compositeId}
                                                className="flex items-start justify-between px-3 py-3 cursor-pointer text-sm transition-colors hover:bg-accent border-b last:border-0"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        className="mt-1"
                                                        checked={selectedAddonIds.includes(item.compositeId)}
                                                        onCheckedChange={() => toggleAddon(item.compositeId)}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span>{item.addon.name} <span className="text-muted-foreground text-xs font-medium ml-1">({item.variant.locationType})</span></span>
                                                        {item.variant.deliverables && item.variant.deliverables.length > 0 && (
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                {item.variant.deliverables.map((d) => `${d.quantity ? d.quantity + ' ' : ''}${d.label}`).join(" • ")}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-muted-foreground font-mono text-xs whitespace-nowrap ml-4 mt-1">
                                                    ₦{Number(item.variant.basePrice).toLocaleString()}
                                                </span>
                                            </label>
                                        )) : (
                                            <p className="text-sm text-muted-foreground text-center py-3">No add-ons match your search</p>
                                        )}
                                    </div>
                                </Field>
                            )}

                            {/* Assigned Member */}
                            <Controller
                                name="memberId"
                                control={form.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel>Assign Team Member</FieldLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                                            <SelectContent>
                                                {studioData.members.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>{m.user.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                )}
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Controller
                                    name="bookingDate"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field className="col-span-2">
                                            <FieldLabel>Booking Date & Time</FieldLabel>
                                            <DateTimeSlotPicker
                                                selectedDate={field.value}
                                                onDateChange={field.onChange}
                                                proposedDuration={(selectedService?.studioSession?.duration || 45) * (watchedSessionCount || 1)}
                                                bookings={studioData.bookings.map(mapPrismaBookingToBooking)}
                                            />
                                        </Field>
                                    )}
                                />

                                <Controller
                                    name="sessionCount"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel>Session Count</FieldLabel>
                                            <Input 
                                                type="number" 
                                                min={1} 
                                                {...field} 
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                            />
                                        </Field>
                                    )}
                                />
                            </div>

                            {/* Financials */}
                            <div className="grid grid-cols-2 gap-4">
                                <Controller
                                    control={form.control}
                                    name="paymentPlan"
                                    render={({ field }) => (
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium">Payment Plan</label>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="FULL">Full Payment (100%)</SelectItem>
                                                    <SelectItem value="HALF">Half Payment (50%)</SelectItem>
                                                    <SelectItem value="QUARTER">Quarter Payment (25%)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="totalAmount"
                                    render={({ field: { value, onChange } }) => (
                                        <Field className="flex flex-col gap-2">
                                            <FieldLabel>Total Amount (₦)</FieldLabel>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={value}
                                                onChange={(e) => onChange(Number(e.target.value))}
                                            />
                                        </Field>
                                    )}
                                />
                                <div className="col-span-2 bg-muted p-3 rounded-md flex justify-between items-center text-sm">
                                    <span className="font-medium">Amount Due Now ({watchedPaymentPlan}):</span>
                                    <span className="font-bold text-lg">
                                        ₦{(watchedTotalAmount * (watchedPaymentPlan === "FULL" ? 1 : watchedPaymentPlan === "HALF" ? 0.5 : 0.25)).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <Controller
                                name="notes"
                                control={form.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel>Notes (Optional)</FieldLabel>
                                        <Textarea {...field} value={field.value || ""} placeholder="Add any special instructions..." className="resize-none" rows={3} />
                                    </Field>
                                )}
                            />

                            {/* Price Summary */}
                            {selectedService && (
                                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price Summary</p>
                                    <Separator />
                                    <div className="flex justify-between text-sm">
                                        <span>{selectedService.name} × {watchedSessionCount || 1} session{(watchedSessionCount || 1) > 1 ? "s" : ""}</span>
                                        <span className="font-mono">₦{sessionTotal.toLocaleString()}</span>
                                    </div>
                                    {selectedAddonVariants.map(item => (
                                        <div key={item.compositeId} className="flex justify-between text-sm text-muted-foreground">
                                            <span>+ {item.addon.name} <span className="text-[10px]">({item.variant.locationType})</span></span>
                                            <span className="font-mono">₦{Number(item.variant.basePrice).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <Separator />
                                    <div className="flex justify-between text-sm font-bold">
                                        <span>Total</span>
                                        <span className="font-mono text-primary">₦{grandTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                            
                            <Button type="submit" className="mt-2 w-full" disabled={isPending}>
                                {isPending ? <HugeiconsIcon icon={Loading} className="animate-spin mr-2" /> : null}
                                Submit Booking
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
                )}
            </CardHeader>
            <CardContent>
                <CalenderGrid initialYear={new Date().getFullYear()} initialMonth={new Date().getMonth()} bookings={studioData.bookings.map(mapPrismaBookingToCalendarBooking)} onMoveConfirm={async (bookingId, toDateKey) => {
                    const { error } = await tryCatch(moveBooking(bookingId, toDateKey));
                    if (error) {
                        toast.error("Failed to reschedule booking.");
                    } else {
                        toast.success(`Booking successfully moved to ${toDateKey}!`);
                    }
                }} />
            </CardContent>
        </Card>
    )
}


export default function StudioDataWrapper({ studioData, userRole }: { studioData: StudioWithRelations, userRole?: string }) {
    return (
        <Suspense fallback={<div className="h-40 w-full animate-pulse bg-muted rounded-md" />}>
            <StudioData studioData={studioData} userRole={userRole || "photographer"} />
        </Suspense>
    )
}

function BookingIntents({ data }: { data: StudioWithRelations }) {
    // Hide completed intents
    const intents = data.bookingIntents.filter(i => i.status !== "COMPLETED");

    const statusStyles: Record<string, string> = {
        PENDING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        COMPLETED: "bg-green-500/10 text-green-600 border-green-500/20",
        EXPIRED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
        FAILED: "bg-red-500/10 text-red-600 border-red-500/20",
    };

    const planLabels: Record<string, string> = {
        QUARTER: "25%",
        HALF: "50%",
        FULL: "100%",
    };

    const normalizePhone = (phone: string) => {
        let cleaned = phone.replace(/[\s\-()]/g, "");
        if (cleaned.startsWith("0") && cleaned.length === 11) {
            cleaned = "234" + cleaned.slice(1);
        }
        if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
        return cleaned;
    };

    if (!intents || intents.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <CalendarCheckIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold mb-1">No Booking Intents</h3>
                    <p className="text-sm text-muted-foreground">Booking intents from the public booking page will appear here.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-lg">Booking Intents ({intents.length})</CardTitle>
                <CardDescription>Track incoming bookings from the public booking page</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/50">
                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Client</th>
                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Contact</th>
                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Amount</th>
                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Plan</th>
                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {intents.map((intent) => (
                                <tr key={intent.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                                    <td className="py-3 px-2">
                                        <div>
                                            <p className="font-medium">{intent.clientName}</p>
                                            {intent.clientEmail && (
                                                <p className="text-xs text-muted-foreground">{intent.clientEmail}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-2">
                                        <p className="text-xs font-mono">{intent.clientPhone || "—"}</p>
                                    </td>
                                    <td className="py-3 px-2">
                                        <div>
                                            <p className="font-medium">
                                                {intent.amount != null ? `₦${Number(intent.amount).toLocaleString()}` : "—"}
                                            </p>
                                        {(() => {
                                            const totalAmount = (intent as Record<string, unknown>).totalAmount;
                                            if (totalAmount != null && intent.amount != null && Number(totalAmount) !== Number(intent.amount)) {
                                                return (
                                                    <p className="text-xs text-muted-foreground">
                                                        of ₦{Number(totalAmount).toLocaleString()}
                                                    </p>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </td>
                                <td className="py-3 px-2">
                                    {(() => {
                                        const paymentPlan = (intent as unknown as Record<string, string>).paymentPlan;
                                        if (!paymentPlan) return null;
                                        const label = planLabels[paymentPlan as keyof typeof planLabels];
                                        return (
                                            <Badge variant="outline" className="text-xs">
                                                {label || paymentPlan}
                                            </Badge>
                                        );
                                    })()}
                                </td>
                                    <td className="py-3 px-2">
                                        <Badge variant="outline" className={`text-xs ${statusStyles[intent.status] || ""}`}>
                                            {intent.status}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-2 text-xs text-muted-foreground whitespace-nowrap">
                                        {format(new Date(intent.createdAt), "MMM d, yyyy h:mm a")}
                                    </td>
                                    <td className="py-3 px-2">
                                        <div className="flex items-center justify-end gap-1">
                                            {intent.clientPhone && (
                                                <>
                                                    <a
                                                        href={`tel:${intent.clientPhone}`}
                                                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                                                        title="Call client"
                                                    >
                                                        <Phone className="w-3.5 h-3.5" />
                                                    </a>
                                                    <a
                                                        href={`https://wa.me/${normalizePhone(intent.clientPhone)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-green-500/10 text-green-600 transition-colors"
                                                        title="WhatsApp client"
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                    </a>
                                                </>
                                            )}
                                            {intent.clientEmail && (
                                                <a
                                                    href={`mailto:${intent.clientEmail}`}
                                                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                                                    title="Email client"
                                                >
                                                    <MailIcon className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                            {intent.resolvedBookingId && (
                                                <Link
                                                    href={`/studios/${data.slug}/bookings/detail/${intent.resolvedBookingId}`}
                                                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-primary/10 text-primary transition-colors"
                                                    title="View booking"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function StudioData({ studioData, userRole }: { studioData: StudioWithRelations, userRole: string }) {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const adminRoles = ["owner", "developer", "manager"];
    const isAdmin = adminRoles.includes(userRole);
    const canViewSettings = isAdmin;

    const restrictedRoles = ["receptionist", "photographer", "videographer"];
    const canViewReviews = !restrictedRoles.includes(userRole);
    const canViewOverview = userRole === "receptionist" || !restrictedRoles.includes(userRole);

    const [activeTab, setActiveTab] = useState(tabParam || (canViewOverview ? "overview" : "bookings"));

    return (
        <div className="w-full flex">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-full">
                <div className="w-full overflow-x-auto no-scrollbar mt-4 flex items-center">
                    <TabsList className="w-max mx-auto">
                        {canViewOverview && (
                            <TabsTrigger 
                                value="overview" 
                                className="inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >Overview</TabsTrigger>
                        )}
                        {canViewSettings && (
                            <TabsTrigger 
                                value="services" 
                                className="inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >Services</TabsTrigger>
                        )}
                        <TabsTrigger 
                            value="clients" 
                            className="inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                        >Clients</TabsTrigger>
                        <TabsTrigger 
                            value="bookings" 
                            className="inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                        >Bookings</TabsTrigger>
                        {canViewReviews && (
                            <TabsTrigger 
                                value="reviews" 
                                className="inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >Reviews</TabsTrigger>
                        )}
                        <TabsTrigger 
                            value="intents" 
                            className="inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                        >Intents</TabsTrigger>
                        {canViewSettings && (
                            <TabsTrigger 
                                value="staffs" 
                                className="inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >Staffs</TabsTrigger>
                        )}
                        {canViewSettings && (
                            <TabsTrigger 
                                value="settings" 
                                className="inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >Settings</TabsTrigger>
                        )}
                    </TabsList>
                </div>
                <div className="mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    {canViewOverview && (
                        <TabsContent value="overview" className="m-0 bg-transparent p-0">
                            <Overview data={studioData} setActiveTab={setActiveTab} userRole={userRole} />
                        </TabsContent>
                    )}
                    {canViewSettings && (
                        <TabsContent value="services">
                            <StudioServices studioData={studioData} />
                        </TabsContent>
                    )}
                    <TabsContent value="clients">
                        <Clients studioData={studioData} userRole={userRole} />
                    </TabsContent>
                    <TabsContent value="bookings">
                        <Bookings studioData={studioData} userRole={userRole} />
                    </TabsContent>
                    {canViewReviews && (
                        <TabsContent value="reviews">
                            <Reviews studioData={studioData} />
                        </TabsContent>
                    )}
                    <TabsContent value="intents">
                        <BookingIntents data={studioData} />
                    </TabsContent>
                    {canViewSettings && (
                        <TabsContent value="staffs">
                            <Staffs studioData={studioData} />
                        </TabsContent>
                    )}
                    {canViewSettings && (
                        <TabsContent value="settings">
                            <UpdateStudio studioData={studioData} />
                        </TabsContent>
                    )}
                </div>
            </Tabs>
        </div>
    )
}