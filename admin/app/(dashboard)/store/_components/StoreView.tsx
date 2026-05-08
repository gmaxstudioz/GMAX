"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { tryCatch } from "@/hooks/try-catch";
import { deleteProduct, FetchProducts } from "@/lib/actions/product";
import { Filter, Loading, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState, useTransition, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { SearchIcon, ShoppingCart, Tag, ArrowRight, Pencil, Trash2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterType = "ALL" | "PUBLISHED" | "DRAFT";

type ProductWithCount = {
    id: string;
    title: string;
    description: string;
    price: number;
    salePrice: number | null;
    isPublished: boolean;
    thumbnailKey: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { purchases: number };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getThumbnailUrl(key: string): string {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}

function formatPrice(value: number): string {
    return `₦${value.toLocaleString()}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StoreView({ initialProducts }: { initialProducts: ProductWithCount[] }) {
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [filterType, setFilterType] = useState<FilterType>("ALL");
    const [products, setProducts] = useState<ProductWithCount[]>(initialProducts);
    const [page, setPage] = useState(1);

    const ITEMS_PER_PAGE = 6;

    // ── Actions ───────────────────────────────────────────────────────────────

    function handleDelete(productId: string) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(deleteProduct(productId));

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                // Optimistic local removal — no round-trip needed
                setProducts((prev) => prev.filter((p) => p.id !== productId));
                toast.success("Product deleted");
            } else if (result?.status === "error") {
                toast.error(result.message);
            }
        });
    }

    function handleRefresh() {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(FetchProducts());

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                setProducts(result.data as ProductWithCount[]);
                toast.success("Refreshed");
            } else if (result?.status === "error") {
                toast.error(result.message);
            }
        });
    }

    // ── Filtering + pagination ─────────────────────────────────────────────

    const filteredProducts = useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();
        return products.filter((product) => {
            const matchesSearch =
                !query ||
                product.title.toLowerCase().includes(query) ||
                product.description.toLowerCase().includes(query);

            const matchesFilter =
                filterType === "ALL" ||
                (filterType === "PUBLISHED" && product.isPublished) ||
                (filterType === "DRAFT" && !product.isPublished);

            return matchesSearch && matchesFilter;
        });
    }, [products, debouncedSearch, filterType]);

    useEffect(() => { setPage(1); }, [debouncedSearch, filterType]);

    const totalFiltered = filteredProducts.length;
    const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);
    const paginatedProducts = filteredProducts.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <Card>
                <CardHeader className="flex flex-col xl:flex-row xl:justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-col gap-1 shrink-0">
                        <CardTitle className="font-bold text-xl flex gap-2">
                            Store Products{" "}
                            <span className="font-extrabold text-primary">{totalFiltered}</span>
                        </CardTitle>
                        <CardDescription>
                            Manage your merchandise, equipment, and digital products
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                        {/* Search */}
                        <div className="relative w-full sm:w-60 xl:w-72 max-w-full">
                            <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search products..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-background border-muted-foreground/30 w-full pl-9 h-10"
                            />
                        </div>

                        {/* Filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-10 min-w-32 justify-between">
                                    <span className="flex items-center gap-2">
                                        <HugeiconsIcon icon={Filter} className="size-4" />
                                        {filterType === "ALL"
                                            ? "All Status"
                                            : filterType.charAt(0) + filterType.slice(1).toLowerCase()}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setFilterType("ALL")}>All Status</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterType("PUBLISHED")}>Published</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterType("DRAFT")}>Drafts</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Refresh */}
                        <Button
                            onClick={handleRefresh}
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={isPending}
                            className="h-10 w-10 shrink-0"
                        >
                            {isPending
                                ? <HugeiconsIcon icon={Loading} className="animate-spin" />
                                : <HugeiconsIcon icon={Refresh01Icon} />}
                        </Button>

                        <Link
                            href="/store/create"
                            className={buttonVariants({ variant: "default", className: "h-10 ml-auto xl:ml-0" })}
                        >
                            Add Product
                        </Link>
                    </div>
                </CardHeader>
            </Card>

            {/* Right-click hint */}
            {paginatedProducts.length > 0 && (
                <p className="text-xs text-muted-foreground text-center -mt-2">
                    Right-click any product card for quick actions
                </p>
            )}

            {/* Grid */}
            {paginatedProducts.length === 0 ? (
                <EmptyState hasFilters={!!(search || filterType !== "ALL")} />
            ) : (
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {paginatedProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onDelete={handleDelete}
                                isPending={isPending}
                            />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <Pagination className="mt-2">
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                    />
                                </PaginationItem>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                    <PaginationItem key={p}>
                                        <PaginationLink
                                            isActive={p === page}
                                            onClick={() => setPage(p)}
                                            className="cursor-pointer"
                                        >
                                            {p}
                                        </PaginationLink>
                                    </PaginationItem>
                                ))}
                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    )}
                </div>
            )}
        </div>
    );
}

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({
    product,
    onDelete,
    isPending,
}: {
    product: ProductWithCount;
    onDelete: (id: string) => void;
    isPending: boolean;
}) {
    const hasDiscount = product.salePrice !== null && product.salePrice < product.price;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <Card className="flex flex-col overflow-hidden transition-all hover:border-primary/50 cursor-default select-none">

                    {/* Thumbnail */}
                    {product.thumbnailKey ? (
                        <div className="aspect-video w-full relative border-b overflow-hidden bg-muted/30">
                            <Image
                                src={getThumbnailUrl(product.thumbnailKey)}
                                alt={product.title}
                                fill
                                className="object-cover transition-transform duration-300 hover:scale-105"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                        </div>
                    ) : (
                        <div className="aspect-video w-full bg-secondary/20 flex items-center justify-center border-b">
                            <ShoppingCart className="size-10 text-muted-foreground/30" />
                        </div>
                    )}

                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base font-bold line-clamp-1 leading-snug">
                                {product.title}
                            </CardTitle>
                            <Badge
                                variant="outline"
                                className={
                                    product.isPublished
                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0"
                                        : "bg-muted text-muted-foreground shrink-0"
                                }
                            >
                                {product.isPublished ? "Published" : "Draft"}
                            </Badge>
                        </div>
                        <CardDescription className="line-clamp-2 min-h-[36px] text-xs mt-1">
                            {product.description}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 pt-0 mt-auto flex flex-col gap-3">
                        {/* Price — salePrice is the discounted current price, price is the original */}
                        <div className="flex items-center gap-2">
                            <Tag className="size-3.5 text-muted-foreground shrink-0" />
                            {hasDiscount ? (
                                <>
                                    <span className="text-base font-bold text-primary">
                                        {formatPrice(product.salePrice!)}
                                    </span>
                                    <span className="text-sm line-through text-muted-foreground/60">
                                        {formatPrice(product.price)}
                                    </span>
                                </>
                            ) : (
                                <span className="text-base font-bold text-primary">
                                    {formatPrice(product.price)}
                                </span>
                            )}
                        </div>

                        <Separator />

                        {/* Stats */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                                <span className="font-semibold text-foreground">
                                    {product._count.purchases}
                                </span>{" "}
                                {product._count.purchases === 1 ? "purchase" : "purchases"}
                            </span>
                            <span>
                                Updated{" "}
                                <span className="font-semibold text-foreground">
                                    {new Date(product.updatedAt).toLocaleDateString()}
                                </span>
                            </span>
                        </div>

                        {/* CTA */}
                        <Link
                            href={`/store/${product.id}`}
                            className={buttonVariants({
                                variant: "secondary",
                                className: "w-full gap-2 mt-1",
                            })}
                        >
                            View Details
                            <ArrowRight className="size-3.5" />
                        </Link>
                    </CardContent>
                </Card>
            </ContextMenuTrigger>

            {/* Right-click menu */}
            <ContextMenuContent className="w-48">
                <ContextMenuLabel className="text-xs text-muted-foreground font-normal">
                    {product.title}
                </ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem asChild>
                    <Link href={`/store/${product.id}/edit`} className="flex items-center gap-2 cursor-pointer">
                        <Pencil className="size-3.5" />
                        Edit Product
                    </Link>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    onClick={() => onDelete(product.id)}
                    disabled={isPending}
                    className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
                >
                    <Trash2 className="size-3.5" />
                    Delete Product
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/10 h-64">
            <ShoppingCart className="size-10 text-muted-foreground mb-4 opacity-50" />
            <p className="font-semibold text-lg">No products found</p>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
                {hasFilters
                    ? "Try adjusting your search or filter."
                    : "You haven't added any products yet."}
            </p>
            {!hasFilters && (
                <Link
                    href="/store/create"
                    className={buttonVariants({ variant: "default", className: "mt-4" })}
                >
                    Add Your First Product
                </Link>
            )}
        </div>
    );
}