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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { tryCatch } from "@/hooks/try-catch";
import { fetchPortfolioItems, deletePortfolioItem, createPortfolioItem, updatePortfolioItem, togglePortfolioPublish } from "@/lib/actions/portfolio";
import { Filter, Loading, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import Image from "next/image";
import { SearchIcon, ImageIcon, Trash2, Plus, Eye, EyeOff, Pencil } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterType = "ALL" | "PUBLISHED" | "HIDDEN";

type PortfolioItemType = {
    id: string;
    title: string | null;
    category: string;
    r2Key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    thumbnailKey: string | null;
    sortOrder: number;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getImageUrl(key: string): string {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DEFAULT_CATEGORIES = [
    "Wedding Photography",
    "Videography",
    "Events",
    "Commercial",
    "Portraits",
    "General",
];

// ── Component ─────────────────────────────────────────────────────────────────

export function PortfolioView({
    initialItems,
    existingCategories,
}: {
    initialItems: PortfolioItemType[];
    existingCategories: string[];
}) {
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [filterType, setFilterType] = useState<FilterType>("ALL");
    const [filterCategory, setFilterCategory] = useState<string>("ALL");
    const [items, setItems] = useState<PortfolioItemType[]>(initialItems);
    const [page, setPage] = useState(1);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

    const allCategories = useMemo(() => {
        const combined = new Set([...DEFAULT_CATEGORIES, ...existingCategories, ...items.map((i) => i.category)]);
        return [...combined].sort();
    }, [existingCategories, items]);

    const ITEMS_PER_PAGE = 12;

    // ── Actions ───────────────────────────────────────────────────────────────

    function handleDelete(itemId: string) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(deletePortfolioItem(itemId));
            if (error) { toast.error("An unexpected error occurred."); return; }
            if (result?.status === "success") {
                setItems((prev) => prev.filter((i) => i.id !== itemId));
                toast.success("Item deleted");
            } else if (result?.status === "error") { toast.error(result.message); }
        });
    }

    function handleTogglePublish(itemId: string, currentlyPublished: boolean) {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(togglePortfolioPublish(itemId, !currentlyPublished));
            if (error) { toast.error("An unexpected error occurred."); return; }
            if (result?.status === "success") {
                setItems((prev) =>
                    prev.map((i) => (i.id === itemId ? { ...i, isPublished: !currentlyPublished } : i))
                );
                toast.success(currentlyPublished ? "Item hidden" : "Item published");
            } else if (result?.status === "error") { toast.error(result.message); }
        });
    }

    function handleRefresh() {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(fetchPortfolioItems());
            if (error) { toast.error("An unexpected error occurred."); return; }
            if (result?.status === "success") {
                setItems(result.data as PortfolioItemType[]);
                toast.success("Refreshed");
            } else if (result?.status === "error") { toast.error(result.message); }
        });
    }

    // ── Filtering + pagination ─────────────────────────────────────────────

    const filteredItems = useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();
        return items.filter((item) => {
            const matchesSearch =
                !query ||
                (item.title && item.title.toLowerCase().includes(query)) ||
                item.category.toLowerCase().includes(query) ||
                item.fileName.toLowerCase().includes(query);

            const matchesFilter =
                filterType === "ALL" ||
                (filterType === "PUBLISHED" && item.isPublished) ||
                (filterType === "HIDDEN" && !item.isPublished);

            const matchesCategory =
                filterCategory === "ALL" || item.category === filterCategory;

            return matchesSearch && matchesFilter && matchesCategory;
        });
    }, [items, debouncedSearch, filterType, filterCategory]);

    useEffect(() => { setPage(1); }, [debouncedSearch, filterType, filterCategory]);

    const totalFiltered = filteredItems.length;
    const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);
    const paginatedItems = filteredItems.slice(
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
                            Portfolio{" "}
                            <span className="font-extrabold text-primary">{totalFiltered}</span>
                        </CardTitle>
                        <CardDescription>
                            Manage the works displayed on your public portfolio page
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                        {/* Search */}
                        <div className="relative w-full sm:w-60 xl:w-72 max-w-full">
                            <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search works..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-background border-muted-foreground/30 w-full pl-9 h-10"
                            />
                        </div>

                        {/* Category filter */}
                        <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v)}>
                            <SelectTrigger className="h-10 w-40">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Categories</SelectItem>
                                {allCategories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Status filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-10 min-w-28 justify-between">
                                    <span className="flex items-center gap-2">
                                        <HugeiconsIcon icon={Filter} className="size-4" />
                                        {filterType === "ALL" ? "All" : filterType === "PUBLISHED" ? "Visible" : "Hidden"}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setFilterType("ALL")}>All Status</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterType("PUBLISHED")}>Visible</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterType("HIDDEN")}>Hidden</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Refresh */}
                        <Button onClick={handleRefresh} type="button" variant="outline" size="icon" disabled={isPending} className="h-10 w-10 shrink-0">
                            {isPending
                                ? <HugeiconsIcon icon={Loading} className="animate-spin" />
                                : <HugeiconsIcon icon={Refresh01Icon} />}
                        </Button>

                        {/* Upload */}
                        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-10 ml-auto xl:ml-0 gap-2">
                                    <Plus className="size-4" /> Upload Work
                                </Button>
                            </DialogTrigger>
                            <UploadDialog
                                categories={allCategories}
                                onSuccess={(item) => {
                                    setItems((prev) => [...prev, item]);
                                    setUploadDialogOpen(false);
                                }}
                            />
                        </Dialog>
                    </div>
                </CardHeader>
            </Card>

            {/* Right-click hint */}
            {paginatedItems.length > 0 && (
                <p className="text-xs text-muted-foreground text-center -mt-2">
                    Right-click any image card for quick actions
                </p>
            )}

            {/* Grid */}
            {paginatedItems.length === 0 ? (
                <EmptyState hasFilters={!!(search || filterType !== "ALL" || filterCategory !== "ALL")} onUpload={() => setUploadDialogOpen(true)} />
            ) : (
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {paginatedItems.map((item) => (
                            <PortfolioCard
                                key={item.id}
                                item={item}
                                onDelete={handleDelete}
                                onTogglePublish={handleTogglePublish}
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
                                        <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">
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

// ── PortfolioCard ─────────────────────────────────────────────────────────────

function PortfolioCard({
    item,
    onDelete,
    onTogglePublish,
    isPending,
}: {
    item: PortfolioItemType;
    onDelete: (id: string) => void;
    onTogglePublish: (id: string, current: boolean) => void;
    isPending: boolean;
}) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <Card className="flex flex-col overflow-hidden transition-all hover:border-primary/50 cursor-default select-none p-0">
                    {/* Thumbnail */}
                    <div className="aspect-square w-full relative overflow-hidden bg-muted/30">
                        <Image
                            src={getImageUrl(item.r2Key)}
                            alt={item.title || item.category}
                            fill
                            className="object-cover transition-transform duration-300 hover:scale-105"
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
                        />
                        {/* Overlay badges */}
                        <div className="absolute top-2 left-2 flex gap-1">
                            {!item.isPublished && (
                                <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs">
                                    <EyeOff className="size-3 mr-1" /> Hidden
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <CardContent className="p-3 flex flex-col gap-1">
                        <p className="text-sm font-medium line-clamp-1">
                            {item.title || item.fileName}
                        </p>
                        <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                            <span className="text-[10px] text-muted-foreground">{formatFileSize(item.fileSize)}</span>
                        </div>
                    </CardContent>
                </Card>
            </ContextMenuTrigger>

            {/* Right-click menu */}
            <ContextMenuContent className="w-48">
                <ContextMenuLabel className="text-xs text-muted-foreground font-normal">
                    {item.title || item.fileName}
                </ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem
                    onClick={() => onTogglePublish(item.id, item.isPublished)}
                    disabled={isPending}
                    className="flex items-center gap-2 cursor-pointer"
                >
                    {item.isPublished ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {item.isPublished ? "Hide from Public" : "Make Visible"}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    onClick={() => onDelete(item.id)}
                    disabled={isPending}
                    className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
                >
                    <Trash2 className="size-3.5" />
                    Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

// ── UploadDialog ──────────────────────────────────────────────────────────────

function UploadDialog({
    categories,
    onSuccess,
}: {
    categories: string[];
    onSuccess: (item: PortfolioItemType) => void;
}) {
    const [files, setFiles] = useState<File[]>([]);
    const [category, setCategory] = useState("General");
    const [customCategory, setCustomCategory] = useState("");
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const effectiveCategory = category === "__custom__" ? customCategory : category;

    const handleFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    }, []);

    const handleUpload = async () => {
        if (files.length === 0 || !effectiveCategory) return;
        setUploading(true);
        setProgress(0);

        let uploaded = 0;

        for (const file of files) {
            try {
                // 1. Get presigned URL
                const presignRes = await fetch("/api/s3/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        isImage: true,
                        directory: "portfolio",
                    }),
                });

                if (!presignRes.ok) throw new Error("Failed to get upload URL");
                const { presignedUrl, key } = await presignRes.json();

                // 2. Upload to R2
                const uploadRes = await fetch(presignedUrl, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type },
                });

                if (!uploadRes.ok) throw new Error("Upload failed");

                // 3. Create DB record
                const { data: result, error } = await tryCatch(
                    createPortfolioItem({
                        title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
                        category: effectiveCategory,
                        r2Key: key,
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType: file.type,
                    })
                );

                if (error || result?.status === "error") {
                    toast.error(`Failed to save: ${file.name}`);
                } else if (result?.status === "success") {
                    onSuccess(result.data as PortfolioItemType);
                    uploaded++;
                }
            } catch (err) {
                toast.error(`Upload failed: ${file.name}`);
            }

            setProgress(Math.round(((files.indexOf(file) + 1) / files.length) * 100));
        }

        setUploading(false);
        setFiles([]);
        if (inputRef.current) inputRef.current.value = "";

        if (uploaded > 0) {
            toast.success(`${uploaded} ${uploaded === 1 ? "image" : "images"} uploaded!`);
        }
    };

    return (
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Upload Portfolio Works</DialogTitle>
                <DialogDescription>
                    Select one or more images to add to your portfolio. They will appear on the public Our Work page.
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
                {/* File Input */}
                <div className="grid gap-2">
                    <Label htmlFor="files">Images</Label>
                    <Input
                        ref={inputRef}
                        id="files"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFilesChange}
                        disabled={uploading}
                    />
                    {files.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {files.length} {files.length === 1 ? "file" : "files"} selected ({formatFileSize(files.reduce((acc, f) => acc + f.size, 0))})
                        </p>
                    )}
                </div>

                {/* Category */}
                <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                            <SelectItem value="__custom__">+ Custom Category</SelectItem>
                        </SelectContent>
                    </Select>
                    {category === "__custom__" && (
                        <Input
                            placeholder="Enter category name"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            disabled={uploading}
                        />
                    )}
                </div>

                {/* Progress */}
                {uploading && (
                    <div className="w-full bg-muted rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
            </div>

            <DialogFooter>
                <Button
                    onClick={handleUpload}
                    disabled={uploading || files.length === 0 || !effectiveCategory}
                    className="gap-2"
                >
                    {uploading ? (
                        <>
                            <HugeiconsIcon icon={Loading} className="animate-spin size-4" />
                            Uploading {progress}%
                        </>
                    ) : (
                        <>
                            <Plus className="size-4" />
                            Upload {files.length > 0 ? `${files.length} ${files.length === 1 ? "Image" : "Images"}` : "Images"}
                        </>
                    )}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onUpload }: { hasFilters: boolean; onUpload: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/10 h-64">
            <ImageIcon className="size-10 text-muted-foreground mb-4 opacity-50" />
            <p className="font-semibold text-lg">No works found</p>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
                {hasFilters
                    ? "Try adjusting your search or filter."
                    : "Upload your first portfolio image to get started."}
            </p>
            {!hasFilters && (
                <Button onClick={onUpload} className="mt-4 gap-2">
                    <Plus className="size-4" /> Upload Your First Work
                </Button>
            )}
        </div>
    );
}
