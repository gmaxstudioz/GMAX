"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Package, ReceiptText, ImageIcon, Eye, ArrowLeft, Plus, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import Uploader from "@/components/web/file-uploader/Uploader";
import { updateProduct } from "@/lib/actions/product";
import { createProductCategory } from "@/lib/actions/product-category";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { MultipartUploader } from "@/components/web/file-uploader/MultipartUploader";
import { CreateProductType, CreateProductSchema } from "@/lib/schemas/product";

// ── Types ─────────────────────────────────────────────────────────────────────

type ExistingProduct = {
    id: string;
    title: string;
    description: string;
    price: number;
    salePrice: number | null;
    categoryId: string | null;
    isPublished: boolean;
    thumbnailKey: string | null;
    r2Key: string | null;
    fileName: string | null;
    fileSize: number | null;
    mimeType: string | null;
};

type Category = {
    id: string;
    name: string;
    slug: string;
};

// ─────────────────────────────────────────────────────────────────────────────

export function EditProductForm({ product, categories: initialCategories }: { product: ExistingProduct; categories: Category[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [addCategoryOpen, setAddCategoryOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    const form = useForm({
        resolver: zodResolver(CreateProductSchema),
        defaultValues: {
            title: product.title,
            description: product.description,
            price: product.price,
            salePrice: product.salePrice ?? undefined,
            categoryId: product.categoryId ?? null as string | null,
            isPublished: product.isPublished,
            thumbnailKey: product.thumbnailKey ?? undefined,
            r2Key: product.r2Key ?? "",
            fileName: product.fileName ?? "",
            fileSize: product.fileSize ?? 0,
            mimeType: product.mimeType ?? "",
        },
    });

    function setFileFields(data: { key: string; fileName: string; fileSize: number; mimeType: string } | null) {
        form.setValue("r2Key",    data?.key       ?? "", { shouldValidate: true });
        form.setValue("fileName", data?.fileName  ?? "");
        form.setValue("fileSize", data?.fileSize  ?? 0);
        form.setValue("mimeType", data?.mimeType  ?? "");
    }

    async function handleAddCategory() {
        if (!newCategoryName.trim()) return;
        setIsCreatingCategory(true);
        try {
            const result = await createProductCategory({ name: newCategoryName.trim() });
            if (result.status === "error") { toast.error(result.message); return; }
            const created = result.data!;
            setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            form.setValue("categoryId", created.id, { shouldValidate: true });
            setNewCategoryName("");
            setAddCategoryOpen(false);
            toast.success(`Category "${created.name}" created`);
        } catch { toast.error("Failed to create category"); }
        finally { setIsCreatingCategory(false); }
    }

    function onSubmit(values: CreateProductType) {
        startTransition(async () => {
            const result = await updateProduct(product.id, {
                title: values.title,
                description: values.description,
                price: values.price,
                salePrice: values.salePrice ?? undefined,
                categoryId: values.categoryId ?? undefined,
                isPublished: values.isPublished,
                thumbnailKey: values.thumbnailKey ?? undefined,
                r2Key: values.r2Key,
                fileName: values.fileName,
                fileSize: values.fileSize,
                mimeType: values.mimeType,
            });

            if (result.status === "error") {
                toast.error(result.message);
                return;
            }

            toast.success("Product updated successfully");
            router.push(`/store/${product.id}`);
        });
    }

    const thumbnailPreviewUrl = product.thumbnailKey
        ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${product.thumbnailKey}`
        : undefined;

    const initialFile = product.r2Key ? {
        key: product.r2Key,
        fileName: product.fileName ?? "",
        fileSize: product.fileSize ?? 0,
        mimeType: product.mimeType ?? "",
    } : undefined;

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <Link
                    href={`/store/${product.id}`}
                    className={buttonVariants({ variant: "outline", size: "icon", className: "h-9 w-9 shrink-0" })}
                >
                    <ArrowLeft className="size-4" />
                </Link>
                <div>
                    <p className="text-xs text-muted-foreground">Store / {product.title} / Edit</p>
                    <h1 className="text-lg font-bold leading-tight">Edit Product</h1>
                </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* ── LEFT COLUMN ───────────────────────────────────── */}
                    <div className="xl:col-span-2 flex flex-col gap-6">

                        {/* Product Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <ReceiptText className="size-4 text-muted-foreground" />
                                    Product Information
                                </CardTitle>
                                <CardDescription>
                                    The basics buyers see in your store
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <Controller
                                    control={form.control}
                                    name="title"
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <Label>Title</Label>
                                            <Input
                                                placeholder="e.g. Photography Lightroom Preset Pack"
                                                {...field}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
                                            )}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="description"
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <Label>Description</Label>
                                            <Textarea
                                                placeholder="Describe what buyers will receive..."
                                                className="min-h-32 resize-none"
                                                {...field}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
                                            )}
                                        </Field>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Pricing */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Pricing</CardTitle>
                                <CardDescription>
                                    Update your regular price or sale price.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Controller
                                        control={form.control}
                                        name="price"
                                        render={({ field, fieldState }) => (
                                            <Field>
                                                <Label>Price (₦)</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₦</span>
                                                    <Input
                                                        type="number"
                                                        placeholder="0.00"
                                                        min={0}
                                                        step="0.01"
                                                        className="pl-7"
                                                        {...field}
                                                        value={(field.value as string | number) ?? ""}
                                                        aria-invalid={fieldState.invalid}
                                                    />
                                                </div>
                                                {fieldState.error && (
                                                    <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        control={form.control}
                                        name="salePrice"
                                        render={({ field, fieldState }) => (
                                            <Field>
                                                <Label>
                                                    Sale Price (₦){" "}
                                                    <span className="font-normal text-muted-foreground">— optional</span>
                                                </Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₦</span>
                                                    <Input
                                                        type="number"
                                                        placeholder="0.00"
                                                        min={0}
                                                        step="0.01"
                                                        className="pl-7"
                                                        {...field}
                                                        value={(field.value as any) ?? ""}
                                                        onChange={(e) =>
                                                            field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                        }
                                                        aria-invalid={fieldState.invalid}
                                                    />
                                                </div>
                                                {fieldState.error && (
                                                    <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
                                                )}
                                            </Field>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Product File */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Package className="size-4 text-muted-foreground" />
                                    Product File
                                </CardTitle>
                                <CardDescription>
                                    The existing file is kept unless you drop a replacement.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Controller
                                    control={form.control}
                                    name="r2Key"
                                    render={({ fieldState }) => (
                                        <Field>
                                            <Label>Deliverable File</Label>
                                            <MultipartUploader
                                                directory={`store/${product.id}/productItem`}
                                                initialFile={initialFile}
                                                onUploadComplete={setFileFields}
                                                onDelete={() => setFileFields(null)}
                                            />
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
                                            )}
                                        </Field>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── RIGHT COLUMN ──────────────────────────────────── */}
                    <div className="flex flex-col gap-6">

                        {/* Category */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Tag className="size-4 text-muted-foreground" />
                                    Category
                                </CardTitle>
                                <CardDescription>
                                    Organize products by category
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <Controller
                                    control={form.control}
                                    name="categoryId"
                                    render={({ field }) => (
                                        <Field>
                                            <Label>
                                                Category{" "}
                                                <span className="font-normal text-muted-foreground">— optional</span>
                                            </Label>
                                            <Select
                                                value={field.value ?? ""}
                                                onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select a category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">No category</SelectItem>
                                                    {categories.map((cat) => (
                                                        <SelectItem key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                />
                                <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" size="sm" className="w-full">
                                            <Plus className="size-4 mr-2" />
                                            Add New Category
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Add Product Category</DialogTitle>
                                            <DialogDescription>
                                                Create a new category to organize your store products.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="flex flex-col gap-3 py-4">
                                            <Label>Category Name</Label>
                                            <Input
                                                placeholder="e.g. Presets, LUTs, Templates"
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); }
                                                }}
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="outline" onClick={() => { setAddCategoryOpen(false); setNewCategoryName(""); }}>
                                                Cancel
                                            </Button>
                                            <Button type="button" disabled={isCreatingCategory || !newCategoryName.trim()} onClick={handleAddCategory}>
                                                {isCreatingCategory ? (<><Loader2 className="mr-2 size-4 animate-spin" />Creating…</>) : "Create Category"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>

                        {/* Thumbnail */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <ImageIcon className="size-4 text-muted-foreground" />
                                    Thumbnail
                                </CardTitle>
                                <CardDescription>
                                    Drop a new image to replace the current thumbnail.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Controller
                                    control={form.control}
                                    name="thumbnailKey"
                                    render={({ fieldState }) => (
                                        <Field>
                                            <Label>Cover Image</Label>
                                            <Uploader
                                                directory={`store/${product.id}/thumbnail`}
                                                initialPreview={thumbnailPreviewUrl}
                                                onUploadComplete={(key) =>
                                                    form.setValue("thumbnailKey", key, { shouldValidate: true })
                                                }
                                                onDelete={() => form.setValue("thumbnailKey", undefined)}
                                            />
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
                                            )}
                                        </Field>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Visibility */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Eye className="size-4 text-muted-foreground" />
                                    Visibility
                                </CardTitle>
                                <CardDescription>
                                    Control whether buyers can see this product.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Controller
                                    control={form.control}
                                    name="isPublished"
                                    render={({ field, fieldState }) => (
                                        <Field>
                                            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <Label className="text-sm font-medium cursor-pointer">Published</Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {field.value
                                                            ? "Visible and purchasable in the store"
                                                            : "Hidden — saved as a draft"}
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    aria-invalid={fieldState.invalid}
                                                />
                                            </div>
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
                                            )}
                                        </Field>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            <Button type="submit" disabled={isPending} className="w-full" size="lg">
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                        Saving changes…
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                size="lg"
                                disabled={isPending}
                                onClick={() => router.push(`/store/${product.id}`)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}