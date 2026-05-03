"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Prisma } from "@/lib/generated/prisma/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon, Trash, ChevronDownIcon, HardDriveIcon, ClockIcon, PencilIcon, MinusIcon, Loader2Icon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createCategory, deleteCategory, createService, deleteService, updateCategory, updateService } from "@/lib/actions/service";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CategorySchema, CategoryPayload, ServiceSchema, ServicePayload } from "@/lib/schemas/service";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

type StudioWithRelations = Prisma.StudioGetPayload<{
    include: {
        categories: { include: { services: true } },
        studioSessions: true,
    }
}>;

export default function StudioServices({ studioData }: { studioData: StudioWithRelations }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Dialog & Edit Mode Overlays
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [editModeCategory, setEditModeCategory] = useState<string | null>(null);

    const [serviceDialogOpenForCategory, setServiceDialogOpenForCategory] = useState<string | null>(null);
    const [editModeService, setEditModeService] = useState<string | null>(null);

    // React Hook Forms
    const categoryForm = useForm<CategoryPayload>({
        resolver: zodResolver(CategorySchema),
        defaultValues: { name: "", type: "standard" }
    });

    const serviceForm = useForm<ServicePayload>({
        resolver: zodResolver(ServiceSchema),
        defaultValues: {
            name: "",
            description: "",
            price: 0,
            salePrice: undefined,
            type: "standard",
            studioSessionId: "",
            features: [""],
        }
    });

    const resetCategoryState = () => {
        categoryForm.reset();
        setEditModeCategory(null);
    };

    const resetServiceState = () => {
        serviceForm.reset();
        setEditModeService(null);
    };

    // Features Field Array Handlers mimicking AddClient
    const addFeatureField = () => {
        const currentFeatures = serviceForm.getValues("features") || [];
        serviceForm.setValue("features", [...currentFeatures, ""], { shouldDirty: true });
    };

    const removeFeatureField = (index: number) => {
        const currentFeatures = serviceForm.getValues("features") || [];
        serviceForm.setValue("features", currentFeatures.filter((_, i) => i !== index), { shouldDirty: true });
    };

    const handleFeatureChange = (index: number, value: string) => {
        const currentFeatures = serviceForm.getValues("features") || [];
        const newFeatures = [...currentFeatures];
        newFeatures[index] = value;
        serviceForm.setValue("features", newFeatures, { shouldDirty: true });
    };

    // Form Submissions
    const handleCategorySubmit = (data: CategoryPayload) => {
        startTransition(async () => {
            if (editModeCategory) {
                const result = await updateCategory(editModeCategory, data);
                if (result.status === "success") {
                    toast.success("Category updated!");
                    resetCategoryState();
                    setIsCategoryDialogOpen(false);
                } else toast.error(result.message);
            } else {
                const result = await createCategory({ ...data, studioId: studioData.id });
                if (result.status === "success") {
                    toast.success("Category created!");
                    resetCategoryState();
                    setIsCategoryDialogOpen(false);
                } else toast.error(result.message);
            }
        });
    };

    const handleDeleteCategory = (categoryId: string) => {
        startTransition(async () => {
            const result = await deleteCategory(categoryId);
            if (result.status === "success") {
                toast.success("Category deleted!");
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleServiceSubmit = (data: ServicePayload) => {
        if (!data.studioSessionId) {
            toast.error("Please select a Studio Session.");
            return;
        }
        startTransition(async () => {
            const filteredFeatures = data.features?.filter(f => f.trim().length > 0) || [];
            
            if (editModeService) {
                const result = await updateService(editModeService, { ...data, features: filteredFeatures });
                if (result.status === "success") {
                    toast.success("Service updated!");
                    resetServiceState();
                    setServiceDialogOpenForCategory(null);
                } else toast.error(result.message);
            } else {
                if (!serviceDialogOpenForCategory) return;
                const result = await createService({
                    ...data,
                    features: filteredFeatures,
                    categoryId: serviceDialogOpenForCategory
                });
                if (result.status === "success") {
                    toast.success("Service added!");
                    resetServiceState();
                    setServiceDialogOpenForCategory(null);
                } else toast.error(result.message);
            }
        });
    };

    const handleDeleteService = (serviceId: string) => {
        startTransition(async () => {
            const result = await deleteService(serviceId);
            if (result.status === "success") toast.success("Service globally removed!");
            else toast.error(result.message);
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <CardTitle className="font-bold text-xl">Service Menus</CardTitle>
                    <CardDescription>
                        Define hierarchical categories to neatly organize the services clients can book.
                    </CardDescription>
                </div>

                <Button 
                    variant="default" 
                    size="sm" 
                    className="gap-2 shrink-0 w-max"
                    onClick={() => {
                        resetCategoryState();
                        setIsCategoryDialogOpen(true);
                    }}
                >
                    <PlusIcon className="size-4" />
                    New Category
                </Button>

                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editModeCategory ? "Edit Category" : "Add Category"}</DialogTitle>
                            <DialogDescription>
                                {editModeCategory ? "Update the name of this container." : "Create a top level service container."}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)}>
                            <div className="space-y-4 py-4">
                                <Controller
                                    name="name"
                                    control={categoryForm.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel>Category Name</FieldLabel>
                                            <Input
                                                {...field}
                                                placeholder="e.g. Pre-Wedding Shoot"
                                                disabled={isPending}
                                            />
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="type"
                                    control={categoryForm.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel>Category Type</FieldLabel>
                                            <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="standard">Standard</SelectItem>
                                                    <SelectItem value="addon">Add-on</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)} disabled={isPending}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isPending || !categoryForm.watch("name")}>
                                    {isPending ? <Loader2Icon className="animate-spin size-4 mr-2" /> : null}
                                    {editModeCategory ? "Update" : "Create"} Category
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>

            <CardContent>
                {studioData.categories.length === 0 ? (
                    <div className="text-center p-8 rounded-lg border-2 border-dashed bg-muted/20">
                        <HardDriveIcon className="mx-auto size-8 text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg">No Service Categories Found</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
                            You must create a parent "Category" before you can add individual services.
                        </p>
                    </div>
                ) : (
                    <Accordion type="multiple" className="space-y-4 w-full border-none rounded-lg p-2">
                        {studioData.categories.map((category) => (
                            <AccordionItem
                                key={category.id}
                                value={category.id}
                                className="border-1 border-border bg-card shadow-sm rounded-lg overflow-hidden transition-all px-4"
                            >
                                <div className="flex items-center justify-between w-full group">
                                    <AccordionTrigger className="hover:no-underline py-4 flex-2">
                                        <div className="flex items-center gap-3 text-left">
                                            <div className="size-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                                                <ChevronDownIcon className="size-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-base line-clamp-1 break-all">{category.name}</h4>
                                                <p className="text-xs text-muted-foreground font-normal">
                                                    {category.services?.length || 0} items
                                                </p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    
                                    <div className="flex items-center pl-2 gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="h-8 gap-1.5 text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                resetServiceState();
                                                serviceForm.setValue("type", category.type as "standard");
                                                setServiceDialogOpenForCategory(category.id);
                                            }}
                                        >
                                            <PlusIcon className="size-3.5" />
                                            Add Service Here
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="size-7"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                categoryForm.setValue("name", category.name);
                                                categoryForm.setValue("type", category.type || "standard");
                                                setEditModeCategory(category.id);
                                                setIsCategoryDialogOpen(true);
                                            }}
                                            disabled={isPending}
                                        >
                                            <PencilIcon className="size-3.5" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteCategory(category.id);
                                            }}
                                            disabled={isPending}
                                        >
                                            <Trash className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                <AccordionContent className="pt-2 w-full">
                                    {category.services && category.services.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            {category.services.map((svc) => {
                                                const sessionBinding = studioData.studioSessions.find(s => s.id === svc.studioSessionId);
                                                return (
                                                    <div key={svc.id} className="flex flex-col border rounded-md p-3 bg-muted/20 relative group/svc">
                                                        <h5 className="font-medium text-sm flex gap-2">
                                                            {svc.name}
                                                        </h5>
                                                        <span className="text-xs font-bold text-primary mt-1">
                                                            ₦{svc.price.toLocaleString()}
                                                        </span>
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                            {svc.description}
                                                        </p>
                                                        
                                                        {(svc.features && svc.features.length > 0) && (
                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                {svc.features.map((f, i) => (
                                                                    <span key={i} className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5 rounded-sm">
                                                                        {f}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-3 font-medium">
                                                            <ClockIcon className="size-3" />
                                                            {sessionBinding ? `${sessionBinding.name} (${sessionBinding.duration}m)` : "Unmanaged"}
                                                        </p>

                                                        <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 group-hover/svc:opacity-100 flex items-center gap-1 bg-card rounded-md shadow-sm border p-0.5">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-6 h-6 w-6 text-muted-foreground hover:text-primary"
                                                                onClick={() => {
                                                                    setEditModeService(svc.id);
                                                                    serviceForm.setValue("name", svc.name);
                                                                    serviceForm.setValue("description", svc.description);
                                                                    serviceForm.setValue("price", svc.price);
                                                                    serviceForm.setValue("salePrice", svc.salePrice || undefined);
                                                                    serviceForm.setValue("type", category.type as "standard");
                                                                    serviceForm.setValue("studioSessionId", svc.studioSessionId);
                                                                    const svcFeatures = (svc.features && svc.features.length > 0) ? svc.features : [""];
                                                                    serviceForm.setValue("features", svcFeatures);
                                                                    
                                                                    setServiceDialogOpenForCategory(category.id);
                                                                }}
                                                                title="Edit Service"
                                                            >
                                                                <PencilIcon className="size-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-6 h-6 w-6 text-muted-foreground hover:text-destructive"
                                                                onClick={() => handleDeleteService(svc.id)}
                                                                title="Delete Service"
                                                            >
                                                                <Trash className="size-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md bg-secondary/30 mt-2">
                                            Zero active services.
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </CardContent>

            <Dialog
                open={!!serviceDialogOpenForCategory}
                onOpenChange={(isOpen) => !isOpen && setServiceDialogOpenForCategory(null)}
            >
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editModeService ? "Edit Service" : "Add Service"}</DialogTitle>
                        <DialogDescription>
                            {editModeService ? "Update the service details." : `Add a new bookable service.`}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={serviceForm.handleSubmit(handleServiceSubmit)}>
                        <FieldGroup>

                            <Controller
                                name="name"
                                control={serviceForm.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel>Service Title</FieldLabel>
                                        <Input
                                            {...field}
                                            placeholder="e.g. 5 Concept Lighting Setup"
                                            disabled={isPending}
                                        />
                                    </Field>
                                )}
                            />
                            
                            <Controller
                                name="description"
                                control={serviceForm.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel>Public Description</FieldLabel>
                                        <Textarea
                                            {...field}
                                            placeholder="Provide specific details clients see..."
                                            disabled={isPending}
                                            className="min-h-20"
                                        />
                                    </Field>
                                )}
                            />
                            
                            <Field>
                                <FieldLabel>Features</FieldLabel>
                                <div className="flex flex-col gap-2">
                                    {(serviceForm.watch("features") || [""]).map((featureValue, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                value={featureValue}
                                                onChange={(e) => handleFeatureChange(index, e.target.value)}
                                                placeholder="e.g 10 Edited Pictures, 2 Outfits..."
                                                disabled={isPending}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => removeFeatureField(index)}
                                                disabled={isPending || (serviceForm.watch("features") || []).length <= 1 && !featureValue}
                                            >
                                                <MinusIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={addFeatureField}
                                        className="w-full text-xs"
                                        disabled={isPending}
                                    >
                                        <PlusIcon className="mr-2 h-4 w-4" />
                                        Add Another Feature
                                    </Button>
                                </div>
                            </Field>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Controller
                                    name="price"
                                    control={serviceForm.control}
                                    render={({ field: { value, onChange, ...field } }) => (
                                        <Field>
                                            <FieldLabel>Base Price</FieldLabel>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                                                <Input
                                                    {...field}
                                                    value={value === 0 ? "" : value}
                                                    onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                                                    type="number"
                                                    className="pl-8"
                                                    placeholder="25000"
                                                    disabled={isPending}
                                                />
                                            </div>
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="salePrice"
                                    control={serviceForm.control}
                                    render={({ field: { value, onChange, ...field } }) => (
                                        <Field>
                                            <FieldLabel>Sale Price</FieldLabel>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                                                <Input
                                                    {...field}
                                                    value={value === undefined || value === null ? "" : value}
                                                    onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                                    type="number"
                                                    className="pl-8"
                                                    placeholder="(Optional)"
                                                    disabled={isPending}
                                                />
                                            </div>
                                        </Field>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Controller
                                    name="studioSessionId"
                                    control={serviceForm.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel>Studio Session Bound</FieldLabel>
                                            <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Linked Temporal Session" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {studioData.studioSessions.map(session => (
                                                        <SelectItem key={session.id} value={session.id}>
                                                            {session.name} ({session.duration}m)
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="type"
                                    control={serviceForm.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel>Service Type</FieldLabel>
                                            <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="standard">Standard</SelectItem>
                                                    <SelectItem value="vvip">VVIP</SelectItem>
                                                    <SelectItem value="premium">Premium</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                />
                            </div>


                            {studioData.studioSessions.length === 0 && (
                                <div className="rounded-md bg-destructive/10 text-destructive text-xs p-3 font-medium mt-2">
                                    You must create at least one Studio Session via the 'Settings' tab first!
                                </div>
                            )}
                        </FieldGroup>
                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => {
                                resetServiceState();
                                setServiceDialogOpenForCategory(null);
                            }} disabled={isPending}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending || studioData.studioSessions.length === 0 || !serviceForm.watch("studioSessionId")}>
                                {isPending ? <Loader2Icon className="animate-spin size-4 mr-2" /> : null}
                                {editModeService ? "Update" : "Bind"} Service
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function cn(...classes: (string | undefined | false | null)[]) {
    return classes.filter(Boolean).join(" ");
}
