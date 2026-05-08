"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { tryCatch } from "@/hooks/try-catch";
import { deleteProduct, togglePublish } from "@/lib/actions/product";
import {
    ArrowLeft,
    Calendar,
    Download,
    ExternalLink,
    FileText,
    HardDrive,
    Loader2,
    Pencil,
    ShoppingCart,
    Tag,
    Trash2,
    Eye,
    EyeOff,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductFull = {
    id: string;
    title: string;
    description: string;
    price: number;
    salePrice: number | null;
    categoryId: string | null;
    category: { id: string; name: string; slug: string } | null;
    isPublished: boolean;
    thumbnailKey: string | null;
    r2Key: string | null;
    fileName: string | null;
    fileSize: number | null;
    mimeType: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { purchases: number };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getThumbnailUrl(key: string) {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}

function formatPrice(n: number) {
    return `₦${n.toLocaleString()}`;
}

function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(date));
}

// ─────────────────────────────────────────────────────────────────────────────

export function ProductDetailsView({ product }: { product: ProductFull }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const hasDiscount = product.salePrice !== null && product.salePrice < product.price;
    const discountPct = hasDiscount
        ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
        : 0;

    function handleDelete() {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(deleteProduct(product.id));
            if (error) { toast.error("An unexpected error occurred"); return; }
            if (result?.status === "success") {
                toast.success("Product deleted");
                router.push("/store");
            } else {
                toast.error(result?.message ?? "Failed to delete");
            }
        });
    }

    function handleTogglePublish() {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(
                togglePublish(product.id, !product.isPublished)
            );
            if (error) { toast.error("An unexpected error occurred"); return; }
            if (result?.status === "success") {
                toast.success(product.isPublished ? "Product unpublished" : "Product published");
                router.refresh();
            } else {
                toast.error(result?.message ?? "Failed to update");
            }
        });
    }

    return (
        <div className="flex flex-col gap-6">

            {/* ── Topbar ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/store"
                        className={buttonVariants({ variant: "outline", size: "icon", className: "h-9 w-9 shrink-0" })}
                    >
                        <ArrowLeft className="size-4" />
                    </Link>
                    <div>
                        <p className="text-xs text-muted-foreground">Store / Product</p>
                        <h1 className="text-lg font-bold leading-tight line-clamp-1">{product.title}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTogglePublish}
                        disabled={isPending}
                        className="gap-1.5"
                    >
                        {isPending
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : product.isPublished
                                ? <EyeOff className="size-3.5" />
                                : <Eye className="size-3.5" />
                        }
                        {product.isPublished ? "Unpublish" : "Publish"}
                    </Button>

                    <Link
                        href={`/store/${product.id}/edit`}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
                    >
                        <Pencil className="size-3.5" />
                        Edit
                    </Link>

                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={isPending}
                        className="gap-1.5"
                    >
                        {isPending
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : <Trash2 className="size-3.5" />
                        }
                        Delete
                    </Button>
                </div>
            </div>

            {/* ── Main layout ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left — thumbnail + description */}
                <div className="xl:col-span-2 flex flex-col gap-6">

                    {/* Thumbnail */}
                    <Card className="overflow-hidden">
                        {product.thumbnailKey ? (
                            <div className="relative aspect-video w-full bg-muted/30">
                                <Image
                                    src={getThumbnailUrl(product.thumbnailKey)}
                                    alt={product.title}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 1280px) 100vw, 66vw"
                                    priority
                                />
                            </div>
                        ) : (
                            <div className="aspect-video w-full bg-secondary/20 flex items-center justify-center">
                                <ShoppingCart className="size-12 text-muted-foreground/30" />
                            </div>
                        )}
                    </Card>

                    {/* Description */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Description
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                                {product.description}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Right — sidebar cards */}
                <div className="flex flex-col gap-4">

                    {/* Status */}
                    <Card>
                        <CardContent className="pt-5 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-xs text-muted-foreground">Status</p>
                                <p className="text-sm font-semibold">
                                    {product.isPublished ? "Live in store" : "Draft — not visible"}
                                </p>
                            </div>
                            <Badge
                                variant="outline"
                                className={
                                    product.isPublished
                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                        : "bg-muted text-muted-foreground"
                                }
                            >
                                {product.isPublished ? "Published" : "Draft"}
                            </Badge>
                        </CardContent>
                    </Card>

                    {/* Pricing */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <Tag className="size-3.5 text-muted-foreground" />
                                Pricing
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Regular price</span>
                                <span className={`text-sm font-semibold ${hasDiscount ? "line-through text-muted-foreground/60" : "text-primary"}`}>
                                    {formatPrice(product.price)}
                                </span>
                            </div>
                            {hasDiscount && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Sale price</span>
                                        <span className="text-sm font-bold text-primary">
                                            {formatPrice(product.salePrice!)}
                                        </span>
                                    </div>
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Discount</span>
                                        <Badge variant="secondary" className="text-xs">
                                            {discountPct}% off
                                        </Badge>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* File info */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <Download className="size-3.5 text-muted-foreground" />
                                Product File
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 text-sm">
                            <div className="flex items-start gap-3">
                                <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="text-xs text-muted-foreground">File name</span>
                                    <span className="font-medium truncate text-xs" title={product.fileName ?? "—"}>
                                        {product.fileName ?? "—"}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <HardDrive className="size-4 text-muted-foreground shrink-0" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs text-muted-foreground">File size</span>
                                    <span className="font-medium text-xs">{product.fileSize ? formatBytes(product.fileSize) : "—"}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs text-muted-foreground">MIME type</span>
                                    <span className="font-medium text-xs font-mono">{product.mimeType ?? "—"}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <ShoppingCart className="size-3.5 text-muted-foreground" />
                                Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Total purchases</span>
                                <span className="text-sm font-bold text-primary">
                                    {product._count.purchases}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex items-start gap-2">
                                <Calendar className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <div className="flex flex-col gap-2 text-xs w-full">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Created</span>
                                        <span className="font-medium">{formatDate(product.createdAt)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Last updated</span>
                                        <span className="font-medium">{formatDate(product.updatedAt)}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}