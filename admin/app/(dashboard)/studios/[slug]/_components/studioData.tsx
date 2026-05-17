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
import { BadgeCheck, MailIcon, Phone, PlusIcon, UsersIcon, CalendarCheckIcon, LayersIcon, ArrowRightIcon, SearchIcon, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { useTransition, useState, useMemo, useEffect, Suspense } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
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
import { FieldLabel } from "@/components/ui/field";
import { EditClientDialog } from "../client/[clientId]/_components/edit-client-dialog";
import UpdateStudio from "./UpdateStudio";
import StudioServices from "./StudioServices";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { CalendarBooking } from "@/lib/schemas/calendar";
import { ClientType } from "@/lib/schemas/client";


type StudioWithRelations = Prisma.StudioGetPayload<{
  include: {
    members: {
        include: { user: true }
    },
    invitations: true,
    categories: {
      include: {
        services: {
            include: { studioSession: true }
        }
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
    }
  }
}>;

function Overview({ data, setActiveTab }: { data: StudioWithRelations, setActiveTab: (v: string) => void }) {
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


function Clients({studioData}: {studioData: StudioWithRelations}) {
    const [ isPending, startTransition ] = useTransition();

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
        setPage(1);
    }, [debouncedSearch, filterType]);

    const filteredClients = studioData.clients.filter((client) => {
        const query = debouncedSearch.toLowerCase();
        const matchesSearch = client.name.toLowerCase().includes(query) || 
                              (client.email && client.email.toLowerCase().includes(query)) ||
                              client.phone.some(p => p.includes(query));
        const matchesFilter = filterType === "ALL" || client.type === filterType;
        return matchesSearch && matchesFilter;
    });

    const totalClients = filteredClients.length;
    const totalPages = Math.ceil(totalClients / ITEMS_PER_PAGE);
    const paginatedClients = filteredClients.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const allTypes = Array.from(new Set(studioData.clients.map(c => c.type)));

    return (
        <Card>
            <CardHeader className="flex flex-col xl:flex-row xl:justify-between items-start xl:items-center gap-4">
                <div className="flex flex-col gap-1 shrink-0">
                    <CardTitle className="font-bold text-xl flex gap-2">Clients <span className="font-extrabold text-primary">{totalClients}</span></CardTitle>
                    <CardDescription>Manage the Clients of this studio</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-60 xl:w-72 max-w-full">
                        <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Name, email, phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-background border-muted-foreground/30 w-full pl-9 h-10"
                        />
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
                    <AddClient studioId={studioData.id} />
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
                        <div className="grid grid-cols-1 gap-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
                            {paginatedClients.map((client) => (
                                <ContextMenu  key={client.id}>
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
                                                        {client.phone.map((phone, index) => (
                                                            <p key={index} className="flex gap-1.5">
                                                                {phone}{index !== client.phone.length - 1 && ","}
                                                            </p>
                                                        ))}
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
                                                            <EditClientDialog 
                                                                clientId={client.id}
                                                                initialData={{
                                                                    name: client.name,
                                                                    email: client.email,
                                                                    phone: client.phone,
                                                                    address: client.address,
                                                                    notes: client.notes,
                                                                    clientType: client.type as ClientType
                                                                }}
                                                                triggerItem={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>}
                                                            />
                                                            <DropdownMenuItem onClick={() =>handleDelete(client.id)} className="text-red-500 font-medium">Delete</DropdownMenuItem>
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
                                        <EditClientDialog 
                                            clientId={client.id}
                                            initialData={{
                                                name: client.name,
                                                email: client.email,
                                                phone: client.phone,
                                                address: client.address,
                                                notes: client.notes,
                                                clientType: client.type as ClientType
                                            }}
                                            triggerItem={<ContextMenuItem onSelect={(e) => e.preventDefault()}>Edit</ContextMenuItem>}
                                        />
                                        <ContextMenuItem onClick={() => handleDelete(client.id)} className="text-red-500 font-medium">Delete</ContextMenuItem>
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
            const { data, error } = await authClient.organization.inviteMember({
                email: values.email,
                role: values.role,
                organizationId: studioData.id,
            });

            if (error) {
                toast.error(error.message || "Failed to invite staff");
            } else {
                toast.success("Staff invited successfully");
                form.reset();
            }
        });
    }
    function getStaffBookings(memberId: string) {
        return studioData.bookings.filter((booking) => booking.memberId === memberId)
    }
    function handleDelete(memberId: string) {
        startTransition(async () => {
            const { data, error } = await authClient.organization.removeMember({
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
function Bookings({ studioData }: { studioData: StudioWithRelations }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [serviceSearch, setServiceSearch] = useState("");
    const [clientSearch, setClientSearch] = useState("");
    const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
    const [clientOpen, setClientOpen] = useState(false);
    const [serviceOpen, setServiceOpen] = useState(false);

    const form = useForm<CreateBookingInput>({
        resolver: zodResolver(CreateBookingSchema),
        defaultValues: {
            sessionCount: 1,
            bookingStatus: "PENDING",
            paymentStatus: "PENDING",
            deliveryStatus: "PENDING",
            notes: "",
            addonIds: [],
        }
    });

    const searchParams = useSearchParams();

    useEffect(() => {
        if (searchParams.get("action") === "add-booking") {
            setOpen(true);
            const dateStr = searchParams.get("date");
            if (dateStr && !isNaN(new Date(dateStr).getTime())) {
                form.setValue("bookingDate", new Date(dateStr));
            }
        }
    }, [searchParams, form]);

    const allServices = useMemo(() => studioData.categories.flatMap(c => c.services), [studioData.categories]);

    // Split into main services (standard/vvip/premium) and addons
    const mainServices = useMemo(() => allServices.filter(s => s.type !== "addon"), [allServices]);
    const addonServices = useMemo(() => allServices.filter(s => s.type === "addon"), [allServices]);

    // Filter services by search
    const filteredMainServices = useMemo(() => {
        if (!serviceSearch.trim()) return mainServices;
        const q = serviceSearch.toLowerCase();
        return mainServices.filter(s => s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q));
    }, [mainServices, serviceSearch]);

    const filteredAddonServices = useMemo(() => {
        if (!serviceSearch.trim()) return addonServices;
        const q = serviceSearch.toLowerCase();
        return addonServices.filter(s => s.name.toLowerCase().includes(q));
    }, [addonServices, serviceSearch]);

    // Filter clients by search
    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return studioData.clients;
        const q = clientSearch.toLowerCase();
        return studioData.clients.filter(c => c.name.toLowerCase().includes(q) || c.phone.some(p => p.includes(q)));
    }, [studioData.clients, clientSearch]);

    // Watch reactive values for price calculation
    const watchedServiceId = form.watch("serviceId");
    const watchedSessionCount = form.watch("sessionCount");
    const watchedClientId = form.watch("clientId");

    const selectedService = useMemo(() => allServices.find(s => s.id === watchedServiceId), [allServices, watchedServiceId]);
    const selectedClient = useMemo(() => studioData.clients.find(c => c.id === watchedClientId), [studioData.clients, watchedClientId]);
    const selectedAddons = useMemo(() => addonServices.filter(a => selectedAddonIds.includes(a.id)), [addonServices, selectedAddonIds]);

    const servicePrice = selectedService?.salePrice ?? selectedService?.price ?? 0;
    const sessionTotal = servicePrice * (watchedSessionCount || 1);
    const addonsTotal = selectedAddons.reduce((sum, a) => sum + (a.salePrice ?? a.price), 0);
    const grandTotal = sessionTotal + addonsTotal;

    function toggleAddon(addonId: string) {
        setSelectedAddonIds(prev => {
            const next = prev.includes(addonId)
                ? prev.filter(id => id !== addonId)
                : [...prev, addonId];
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
            <CardHeader className="flex flex-row justify-between">
                <div className="flex flex-col gap-1">
                    <CardTitle className="font-bold text-xl flex gap-2">Bookings <span className="font-extrabold text-primary">{studioData.bookings.length}</span></CardTitle>
                    <CardDescription>Manage the Bookings of this studio</CardDescription>
                </div>
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
                                                                    <AddClient studioId={studioData.id} />
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
                                                                <Badge variant="outline" className="text-[10px] capitalize">{selectedService.type}</Badge>
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
                                                                    onClick={() => { field.onChange(s.id); setServiceOpen(false); setServiceSearch(""); }}
                                                                    className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm rounded-md transition-colors hover:bg-accent ${field.value === s.id ? "bg-accent font-medium" : ""}`}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span>{s.name}</span>
                                                                        <Badge variant="outline" className="text-[10px] capitalize">{s.type.toUpperCase()}</Badge>
                                                                    </div>
                                                                    <span className="text-muted-foreground font-mono text-xs">
                                                                        {s.salePrice ? (<><s className="opacity-50">₦{s.price.toLocaleString()}</s> ₦{s.salePrice.toLocaleString()}</>) : `₦${s.price.toLocaleString()}`}
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

                            {/* Addon Selection */}
                            {addonServices.length > 0 && (
                                <Field>
                                    <FieldLabel>Add-ons <span className="text-muted-foreground font-normal">(Optional)</span></FieldLabel>
                                    <div className="border rounded-lg max-h-[140px] overflow-y-auto">
                                        {filteredAddonServices.length > 0 ? filteredAddonServices.map(addon => (
                                            <label
                                                key={addon.id}
                                                className="flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors hover:bg-accent"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={selectedAddonIds.includes(addon.id)}
                                                        onCheckedChange={() => toggleAddon(addon.id)}
                                                    />
                                                    <span>{addon.name}</span>
                                                </div>
                                                <span className="text-muted-foreground font-mono text-xs">
                                                    {addon.salePrice ? (<><s className="opacity-50">₦{addon.price.toLocaleString()}</s> ₦{addon.salePrice.toLocaleString()}</>) : `₦${addon.price.toLocaleString()}`}
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
                                                bookings={studioData.bookings as Booking[]}
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
                                    {selectedAddons.map(addon => (
                                        <div key={addon.id} className="flex justify-between text-sm text-muted-foreground">
                                            <span>+ {addon.name}</span>
                                            <span className="font-mono">₦{(addon.salePrice ?? addon.price).toLocaleString()}</span>
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
            </CardHeader>
            <CardContent>
                <CalenderGrid initialYear={new Date().getFullYear()} initialMonth={new Date().getMonth()} bookings={studioData.bookings as CalendarBooking[]} onMoveConfirm={async (bookingId, toDateKey) => {
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

function StudioData({ studioData, userRole }: { studioData: StudioWithRelations, userRole: string }) {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const [activeTab, setActiveTab] = useState(tabParam || "overview");

    const adminRoles = ["owner", "developer", "manager"];
    const isAdmin = adminRoles.includes(userRole);
    const canViewSettings = isAdmin;

    return (
        <div className="w-full flex">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-full">
                <div className="w-full overflow-x-auto no-scrollbar mt-4 flex items-center">
                    <TabsList className="w-max mx-auto">
                        <TabsTrigger 
                            value="overview" 
                            className="inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                        >Overview</TabsTrigger>
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
                    <TabsContent value="overview" className="m-0 bg-transparent p-0">
                        <Overview data={studioData} setActiveTab={setActiveTab} />
                    </TabsContent>
                    {canViewSettings && (
                        <TabsContent value="services">
                            <StudioServices studioData={studioData} />
                        </TabsContent>
                    )}
                    <TabsContent value="clients">
                        <Clients studioData={studioData} />
                    </TabsContent>
                    <TabsContent value="bookings">
                        <Bookings studioData={studioData} />
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