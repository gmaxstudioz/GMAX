"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { tryCatch } from "@/hooks/try-catch";
import { DeleteClient } from "@/lib/actions/client";
import { Filter, Loading, MoreVerticalIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState, useTransition, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import { EditClientDialog } from "../../studios/[slug]/client/[clientId]/_components/edit-client-dialog";
import Link from "next/link";
import { ArrowRightIcon, BadgeCheck, MailIcon, Phone, SearchIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ClientWithBookings } from "@/lib/schemas/client";
import { useRouter } from "next/navigation";


type StudioGroup = {
    id: string;
    slug: string;
    name: string;
    clients: {
        id: string;
        name: string;
        email: string | null;
        phone: string[];
        address?: string | null;
        notes?: string | null;
        image?: string | null;
        type: string;
        studioId: string;
        studioSlug: string;
        bookings: {
            id: string;
            bookingStatus: string;
        }[];
    }[];
};

export function ClientsView({ studioGroups }: { studioGroups: StudioGroup[] }) {
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [filterType, setFilterType] = useState<string>("ALL");
    const router = useRouter();

    function handleDelete(clientId: string) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(DeleteClient(clientId));

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                toast.success("Client deleted successfully");
                router.refresh();
            } else if (result?.status === "error") {
                toast.error(result?.message);
            }
        });
    }

    function handleRefresh() {
        startTransition(async () => {
            router.refresh();
            toast.success("Refreshed Successfully");
        });
    }

    const allClients = studioGroups.flatMap(g => g.clients);
    const allTypes = Array.from(new Set(allClients.map(c => c.type)));

    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 3;

    const filteredGroups = useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();

        return studioGroups
            .map(group => ({
                ...group,
                clients: group.clients.filter((client) => {
                    const matchesSearch = !query ||
                        client.name.toLowerCase().includes(query) ||
                        (client.email && client.email.toLowerCase().includes(query)) ||
                        client.phone.some(p => p.toLowerCase().includes(query));
                    const matchesFilter = filterType === "ALL" || client.type === filterType;
                    return matchesSearch && matchesFilter;
                }),
            }))
            .filter(group => group.clients.length > 0);
    }, [studioGroups, debouncedSearch, filterType]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, filterType]);

    const totalFiltered = filteredGroups.reduce((sum, g) => sum + g.clients.length, 0);
    const totalGroups = filteredGroups.length;
    const totalPages = Math.ceil(totalGroups / ITEMS_PER_PAGE);
    const paginatedGroups = filteredGroups.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <Card>
                <CardHeader className="flex flex-col xl:flex-row xl:justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-col gap-1 shrink-0">
                        <CardTitle className="font-bold text-xl flex gap-2">All Clients <span className="font-extrabold text-primary">{totalFiltered}</span></CardTitle>
                        <CardDescription>Manage all clients across studios</CardDescription>
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
                        <Button onClick={handleRefresh} type="button" variant="outline" size="icon" disabled={isPending} className="h-10 w-10 shrink-0">
                            {isPending ? <HugeiconsIcon icon={Loading} className="animate-spin" /> : <HugeiconsIcon icon={Refresh01Icon} />}
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Studio Sections */}
            {paginatedGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/10 h-64">
                    <SearchIcon className="size-10 text-muted-foreground mb-4 opacity-50" />
                    <p className="font-semibold text-lg">No clients found</p>
                    <p className="text-sm text-muted-foreground max-w-sm mt-2">
                        {search || filterType !== "ALL" ? "Try adjusting your search query or filter to find what you're looking for." : "You haven't added any clients yet."}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {paginatedGroups.map((group) => (
                        <Card key={group.id} className="flex flex-col gap-4">
                            {/* Studio Section Header */}
                            <CardHeader className="flex items-center justify-between pb-3">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold">{group.name}</h2>
                                    <Badge variant="secondary">{group.clients.length} {group.clients.length === 1 ? "client" : "clients"}</Badge>
                                </div>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href={`/studios/${group.slug}?tab=clients`}>
                                        {group.clients.length > 6 ? `+${group.clients.length - 6} more — ` : ""}View All in Studio
                                        <ArrowRightIcon className="ml-1 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardHeader>

                            <Separator />

                            {/* Client Cards Grid (max 6 per studio) */}
                            <CardContent className="grid grid-cols-1 gap-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3 mt-4">
                                {group.clients.slice(0, 6).map((client) => (
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
                                                                        email: client.email || undefined,
                                                                        phone: client.phone,
                                                                        address: client.address || undefined,
                                                                        notes: client.notes || undefined,
                                                                        clientType: client.type as any
                                                                    }}
                                                                    triggerItem={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>}
                                                                />
                                                                <DropdownMenuItem onClick={() => handleDelete(client.id)} className="text-red-500 font-medium">Delete</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <Link
                                                            className={buttonVariants({ variant: "default", className: "flex-1 cursor-pointer" })}
                                                            href={`/studios/${group.slug}/client/${client.id}`}
                                                        >
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
                                                    clientType: client.type as any
                                                }}
                                                triggerItem={<ContextMenuItem onSelect={(e) => e.preventDefault()}>Edit</ContextMenuItem>}
                                            />
                                            <ContextMenuItem onClick={() => handleDelete(client.id)} className="text-red-500 font-medium">Delete</ContextMenuItem>
                                        </ContextMenuContent>
                                    </ContextMenu>
                                ))}
                            </CardContent>
                        </Card>
                    ))}

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
        </div>
    )
}