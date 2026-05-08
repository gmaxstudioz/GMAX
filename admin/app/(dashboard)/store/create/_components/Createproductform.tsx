"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState, useTransition } from "react";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Package, ReceiptText, ImageIcon, Eye, Plus, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

import Uploader from "@/components/web/file-uploader/Uploader";
import { createProduct } from "@/lib/actions/product";
import { createProductCategory } from "@/lib/actions/product-category";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { CreateProductSchema, CreateProductType } from "@/lib/schemas/product";
import { MultipartUploader }from "@/components/web/file-uploader/MultipartUploader";

type Category = {
    id: string;
    name: string;
    slug: string;
};

interface CreateProductFormProps {
    categories: Category[];
}

export function CreateProductForm({ categories: initialCategories }: CreateProductFormProps) {
    // useRef guarantees a stable value for the lifetime of this component instance.
    // useMemo is NOT safe here — React may discard memoized values, which would
    // generate a new ID mid-session and decouple your R2 paths from the form state.
    const productIdRef = useRef<string | null>(null);
    if (productIdRef.current === null) {
        productIdRef.current = uuidv4();
    }
    const productId = productIdRef.current;

    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [addCategoryOpen, setAddCategoryOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    const form = useForm({
        resolver: zodResolver(CreateProductSchema),
        defaultValues: {
            title: "",
            description: "",
            price: 1,
            salePrice: null,
            categoryId: null as string | null,
            isPublished: false,
            thumbnailKey: undefined,
            r2Key: "",
            fileName: "",
            fileSize: 0,
            mimeType: "",
        },
    });

    async function handleAddCategory() {
        if (!newCategoryName.trim()) return;
        setIsCreatingCategory(true);

        try {
            const result = await createProductCategory({ name: newCategoryName.trim() });

            if (result.status === "error") {
                toast.error(result.message);
                return;
            }

            const created = result.data!;
            setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            form.setValue("categoryId", created.id, { shouldValidate: true });
            setNewCategoryName("");
            setAddCategoryOpen(false);
            toast.success(`Category "${created.name}" created`);
        } catch {
            toast.error("Failed to create category");
        } finally {
            setIsCreatingCategory(false);
        }
    }

    function onSubmit(values: CreateProductType) {
        startTransition(async () => {
            const result = await createProduct({
                id: productId,
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

            toast.success("Product created successfully");
            router.push("/store");
        });
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* ── LEFT COLUMN: main fields ─────────────────────── */}
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
                                            <p className="text-xs text-destructive mt-1">
                                                {fieldState.error.message}
                                            </p>
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
                                            placeholder="Describe what buyers will receive, what it's for, and any usage notes..."
                                            className="min-h-32 resize-none"
                                            {...field}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.error && (
                                            <p className="text-xs text-destructive mt-1">
                                                {fieldState.error.message}
                                            </p>
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
                                Set your regular price. Add a sale price to show a discount.
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
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                                                    ₦
                                                </span>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    min={0}
                                                    step="0.01"
                                                    className="pl-7"
                                                    {...field}
                                                    value={(field.value as string | number) ?? ""}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                    aria-invalid={fieldState.invalid}
                                                />
                                            </div>
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {fieldState.error.message}
                                                </p>
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
                                                <span className="font-normal text-muted-foreground">
                                                    — optional
                                                </span>
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                                                    ₦
                                                </span>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    min={0}
                                                    step="0.01"
                                                    className="pl-7"
                                                    {...field}
                                                    value={(field.value as any) ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(
                                                            e.target.value === ""
                                                                ? undefined
                                                                : e.target.value
                                                        )
                                                    }
                                                    aria-invalid={fieldState.invalid}
                                                />
                                            </div>
                                            {fieldState.error && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {fieldState.error.message}
                                                </p>
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
                                The digital file buyers receive after purchase. Large files
                                are automatically uploaded in chunks.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Controller
                                control={form.control}
                                name="r2Key"
                                render={({ fieldState }) => (
                                    <Field>
                                        <Label>Product File</Label>
                                        <MultipartUploader
                                            directory={`store/${productId}/productItem`}
                                            onUploadComplete={({ key, fileName, fileSize, mimeType }) => {
                                                form.setValue("r2Key", key, { shouldValidate: true });
                                                form.setValue("fileName", fileName);
                                                form.setValue("fileSize", fileSize);
                                                form.setValue("mimeType", mimeType);
                                            }}
                                            onDelete={() => {
                                                form.setValue("r2Key", "", { shouldValidate: true });
                                                form.setValue("fileName", "");
                                                form.setValue("fileSize", 0);
                                                form.setValue("mimeType", "");
                                            }}
                                        />
                                        {fieldState.error && (
                                            <p className="text-xs text-destructive mt-1">
                                                {fieldState.error.message}
                                            </p>
                                        )}
                                    </Field>
                                )}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* ── RIGHT COLUMN: category + thumbnail + visibility + actions ── */}
                <div className="flex flex-col gap-6">

                    {/* Category */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Tag className="size-4 text-muted-foreground" />
                                Category
                            </CardTitle>
                            <CardDescription>
                                Organize products by category for easy browsing
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
                                            <span className="font-normal text-muted-foreground">
                                                — optional
                                            </span>
                                        </Label>
                                        <Select
                                            value={field.value ?? ""}
                                            onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">
                                                    No category
                                                </SelectItem>
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
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                    >
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
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddCategory();
                                                }
                                            }}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setAddCategoryOpen(false);
                                                setNewCategoryName("");
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="button"
                                            disabled={isCreatingCategory || !newCategoryName.trim()}
                                            onClick={handleAddCategory}
                                        >
                                            {isCreatingCategory ? (
                                                <>
                                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                                    Creating…
                                                </>
                                            ) : (
                                                "Create Category"
                                            )}
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
                                Cover image displayed in the store listing
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Controller
                                control={form.control}
                                name="thumbnailKey"
                                render={({ fieldState }) => (
                                    <Field>
                                        <Label>Thumbnail</Label>
                                        <Uploader
                                            directory={`store/${productId}/thumbnail`}
                                            onUploadComplete={(key) =>
                                                form.setValue("thumbnailKey", key, {
                                                    shouldValidate: true,
                                                })
                                            }
                                            onDelete={() =>
                                                form.setValue("thumbnailKey", undefined)
                                            }
                                        />
                                        {fieldState.error && (
                                            <p className="text-xs text-destructive mt-1">
                                                {fieldState.error.message}
                                            </p>
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
                                Control whether buyers can see and purchase this product
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
                                                <Label className="text-sm font-medium cursor-pointer">
                                                    Published
                                                </Label>
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
                                            <p className="text-xs text-destructive mt-1">
                                                {fieldState.error.message}
                                            </p>
                                        )}
                                    </Field>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full"
                            size="lg"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Creating product…
                                </>
                            ) : (
                                "Create Product"
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            size="lg"
                            disabled={isPending}
                            onClick={() => router.back()}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}