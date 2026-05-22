"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { tryCatch } from "@/hooks/try-catch";
import { deleteService } from "@/lib/actions/service";
import { Filter, Loading, MoreVerticalIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState, useTransition, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRightIcon, ClockIcon, SearchIcon, Sparkles, Tag } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

type ServiceWithRelations = {
    id: string;
    name: string;
    type: string;
    description: string;
    features: string[];
    price: number;
    salePrice: number | null;
    categoryId: string;
    studioSessionId: string;
    createdAt: Date;
    updatedAt: Date;
    studioSession: {
        id: string;
        name: string;
        duration: number;
    };
    _count: {
        bookings: number;
    };
    studioId: string;
    studioSlug: string;
    studioName: string;
};

type CategoryGroup = {
    id: string;
    name: string;
    type: string;
    studioId: string;
    createdAt: Date;
    updatedAt: Date;
    services: ServiceWithRelations[];
};

type StudioGroup = {
    id: string;
    slug: string;
    name: string;
    categories: CategoryGroup[];
};

const SERVICE_TYPE_COLORS: Record<string, string> = {
    standard: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    vvip: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    premium: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    addon: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export function ServicesView({ studioGroups }: { studioGroups: StudioGroup[] }) {
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [filterType, setFilterType] = useState<string>("ALL");

    function handleDelete(serviceId: string) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(deleteService(serviceId));

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                toast.success("Service deleted successfully");
            } else if (result?.status === "error") {
                toast.error(result?.message);
            }
        });
    }

    function handleRefresh() {
        startTransition(async () => {
            window.location.reload();
        });
    }

    // Compute all services flat for totals and type filter options
    const allServices = studioGroups.flatMap(g => g.categories.flatMap(c => c.services));
    const allTypes = Array.from(new Set(allServices.map(s => s.type)));

    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 3;

    // Filter each studio group — recomputes when debouncedSearch or filterType changes
    const filteredGroups = useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();

        return studioGroups
            .map(group => ({
                ...group,
                categories: group.categories
                    .map(category => ({
                        ...category,
                        services: category.services.filter((service) => {
                            const matchesSearch = !query ||
                                service.name.toLowerCase().includes(query) ||
                                service.description.toLowerCase().includes(query) ||
                                service.features.some(f => f.toLowerCase().includes(query));
                            const matchesFilter = filterType === "ALL" || service.type === filterType;
                            return matchesSearch && matchesFilter;
                        }),
                    }))
                    .filter(category => category.services.length > 0),
            }))
            .filter(group => group.categories.length > 0);
    }, [studioGroups, debouncedSearch, filterType]);

    // Reset page on search or filter change
    useEffect(() => { const t = setTimeout(() => setPage(1), 0); return () => clearTimeout(t); }, [debouncedSearch, filterType]);

    const totalFiltered = filteredGroups.reduce(
        (sum, g) => sum + g.categories.reduce((catSum, c) => catSum + c.services.length, 0),
        0
    );

    const totalGroups = filteredGroups.length;
    const totalPages = Math.ceil(totalGroups / ITEMS_PER_PAGE);
    const paginatedGroups = filteredGroups.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <Card>
                <CardHeader className="flex flex-col xl:flex-row xl:justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-col gap-1 shrink-0">
                        <CardTitle className="font-bold text-xl flex gap-2">All Services <span className="font-extrabold text-primary">{totalFiltered}</span></CardTitle>
                        <CardDescription>Manage all services across studios</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-full sm:w-60 xl:w-72 max-w-full">
                            <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Name, description, features..."
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
                                        {filterType === "ALL" ? "All Types" : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setFilterType("ALL")}>All Types</DropdownMenuItem>
                                {allTypes.map(t => (
                                    <DropdownMenuItem key={t} onClick={() => setFilterType(t)}>
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </DropdownMenuItem>
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
                    <p className="font-semibold text-lg">No services found</p>
                    <p className="text-sm text-muted-foreground max-w-sm mt-2">
                        {search || filterType !== "ALL" ? "Try adjusting your search query or filter to find what you're looking for." : "You haven't added any services yet."}
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
                                    <Badge variant="secondary">
                                        {group.categories.reduce((sum, c) => sum + c.services.length, 0)} {group.categories.reduce((sum, c) => sum + c.services.length, 0) === 1 ? "service" : "services"}
                                    </Badge>
                                </div>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href={`/studios/${group.slug}?tab=services`}>
                                        View All in Studio
                                        <ArrowRightIcon className="ml-1 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardHeader>

                            <Separator />

                            {/* Categories within this studio */}
                            {group.categories.map((category) => (
                                <div key={category.id} className="px-6 pb-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <h3 className="text-base font-semibold text-foreground/80">{category.name}</h3>
                                        <Badge variant="outline" className="text-xs">{category.type}</Badge>
                                        <span className="text-xs text-muted-foreground">· {category.services.length} {category.services.length === 1 ? "item" : "items"}</span>
                                    </div>

                                    {/* Service Cards Grid (max 6 per category) */}
                                    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
                                        {category.services.slice(0, 6).map((service) => (
                                            <Card key={service.id} className="@container/card">
                                                <CardHeader>
                                                    <div className="w-full flex items-center justify-between">
                                                        <CardTitle className="text-lg font-bold line-clamp-1">{service.name}</CardTitle>
                                                        <Badge variant="outline" className={SERVICE_TYPE_COLORS[service.type] || ""}>
                                                            <Sparkles className="size-3 mr-1" />
                                                            {service.type.charAt(0).toUpperCase() + service.type.slice(1)}
                                                        </Badge>
                                                    </div>
                                                    <CardDescription className="line-clamp-2 mt-1">{service.description}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="text-muted-foreground flex flex-col gap-3">
                                                    {/* Pricing */}
                                                    <div className="flex items-center gap-2">
                                                        <Tag className="size-4 text-foreground" />
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-lg font-bold text-primary">₦{service.price.toLocaleString()}</span>
                                                            {service.salePrice && (
                                                                <span className="text-sm line-through text-muted-foreground/60">₦{service.salePrice.toLocaleString()}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Stats Row */}
                                                    <div className="flex items-center justify-between gap-1 w-full">
                                                        <div className="rounded w-full bg-accent p-2">
                                                            <p className="text-xs">Bookings</p>
                                                            <p className="font-bold text-primary">{service._count.bookings}</p>
                                                        </div>
                                                        <div className="rounded w-full bg-accent p-2">
                                                            <p className="text-xs">Session</p>
                                                            <p className="font-bold text-primary text-xs">{service.studioSession.name}</p>
                                                        </div>
                                                        <div className="rounded w-full bg-accent p-2">
                                                            <p className="text-xs">Duration</p>
                                                            <p className="font-bold text-primary">{service.studioSession.duration}m</p>
                                                        </div>
                                                    </div>

                                                    {/* Features */}
                                                    {service.features && service.features.length > 0 && (
                                                        <div className="flex flex-col gap-1.5">
                                                            <p className="text-foreground/80 font-semibold text-sm">Features</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {service.features.map((feature, index) => (
                                                                    <span key={index} className="bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-sm">
                                                                        {feature}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Session Info */}
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                                                        <ClockIcon className="size-3" />
                                                        {service.studioSession.name} ({service.studioSession.duration}m)
                                                    </p>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 mt-2">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="secondary" size="icon">
                                                                    <HugeiconsIcon icon={MoreVerticalIcon} />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/studios/${service.studioSlug}?tab=services`}>
                                                                        Edit in Studio
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDelete(service.id)} className="text-red-500 font-medium">Delete</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <Link className={buttonVariants({variant: "default", className: "flex-1 cursor-pointer"})} href={`/studios/${service.studioSlug}?tab=services`}>
                                                            View in Studio
                                                        </Link>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                    {category.services.length > 6 && (
                                        <p className="text-xs text-muted-foreground mt-3 text-center">
                                            +{category.services.length - 6} more services in this category
                                        </p>
                                    )}
                                </div>
                            ))}
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
    );
}
