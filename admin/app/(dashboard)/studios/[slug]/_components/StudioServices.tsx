"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Prisma } from "@/lib/generated/prisma/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon, Trash, ChevronDownIcon, HardDriveIcon, ClockIcon, PencilIcon, MinusIcon, Loader2Icon, CopyIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createService, deleteService, updateService, cloneService } from "@/lib/actions/service";
import { ViewToggle } from "@/components/web/ViewToggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSearchParams } from "next/navigation";
import { Controller, useForm, useFieldArray, Control, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ServiceSchema, ServicePayload } from "@/lib/schemas/service";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";

type StudioWithRelations = Prisma.StudioGetPayload<{
    include: {
        services: { include: { variants: { include: { deliverables: true } } } },
        studioSessions: true,
    }
}>;

const CATEGORIES = ["PHOTOGRAPHY", "VIDEOGRAPHY", "OTHERS"];

function VariantDeliverables({ control, variantIndex, isPending }: { control: Control<z.input<typeof ServiceSchema>>, variantIndex: number, isPending: boolean }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `variants.${variantIndex}.deliverables` as const
    });

    return (
        <div className="flex flex-col gap-2 mt-3 p-3 border rounded-md bg-background/50">
            <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deliverables</h5>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-[10px] gap-1"
                    onClick={() => append({ label: "", quantity: 1, detail: "", isFree: false })}
                    disabled={isPending}
                >
                    <PlusIcon className="size-3" /> Add Item
                </Button>
            </div>
            
            {fields.length === 0 ? (
                <div className="text-[10px] text-muted-foreground py-2 text-center">No deliverables defined.</div>
            ) : (
                <div className="flex flex-col gap-2">
                    {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-12 gap-2 items-start bg-card p-2 rounded border shadow-sm">
                            <div className="col-span-12 md:col-span-4">
                                <Controller
                                    name={`variants.${variantIndex}.deliverables.${index}.label`}
                                    control={control}
                                    render={({ field }) => <Input {...field} placeholder="e.g. Edited Photos" className="h-8 text-xs" disabled={isPending} />}
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <Controller
                                    name={`variants.${variantIndex}.deliverables.${index}.quantity`}
                                    control={control}
                                    render={({ field: { value, onChange, ...f } }) => (
                                        <Input 
                                            {...f} 
                                            value={value ?? ""} 
                                            onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)} 
                                            placeholder="Qty" 
                                            type="number" 
                                            className="h-8 text-xs" 
                                            disabled={isPending} 
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-6 md:col-span-3">
                                <Controller
                                    name={`variants.${variantIndex}.deliverables.${index}.detail`}
                                    control={control}
                                    render={({ field: { value, onChange, ...f } }) => (
                                        <Input {...f} value={value ?? ""} onChange={onChange} placeholder="Detail (opt)" className="h-8 text-xs" disabled={isPending} />
                                    )}
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2 flex items-center h-8">
                                <Controller
                                    name={`variants.${variantIndex}.deliverables.${index}.isFree`}
                                    control={control}
                                    render={({ field: { value, onChange } }) => (
                                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                            <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} disabled={isPending} className="rounded border-muted-foreground/30 text-primary focus:ring-primary" />
                                            Free?
                                        </label>
                                    )}
                                />
                            </div>
                            <div className="col-span-6 md:col-span-1 flex justify-end">
                                <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => remove(index)} disabled={isPending}>
                                    <Trash className="size-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function StudioServices({ studioData }: { studioData: StudioWithRelations }) {
    const [isPending, startTransition] = useTransition();
    const searchParamsHooks = useSearchParams();
    const isListView = searchParamsHooks.get("view") !== "grid";

    const [serviceDialogOpenForCategory, setServiceDialogOpenForCategory] = useState<string | null>(null);
    const [editModeService, setEditModeService] = useState<string | null>(null);

    const serviceForm = useForm<z.input<typeof ServiceSchema>>({
        resolver: zodResolver(ServiceSchema),
        defaultValues: {
            name: "",
            description: "",
            isAddon: false,
            isActive: true,
            studioSessionId: "",
            features: [""],
            variants: [{
                locationType: "STUDIO",
                basePrice: 0,
                maxPrice: undefined,
                sessionDurationMins: 45,
                logisticsIncluded: true,
                deliverables: []
            }],
        }
    });

    const watchedFeatures = useWatch({ control: serviceForm.control, name: "features" }) ?? [];
    const watchedVariants = useWatch({ control: serviceForm.control, name: "variants" });
    const watchedSessionId = useWatch({ control: serviceForm.control, name: "studioSessionId" });
    const watchedIsAddon = useWatch({ control: serviceForm.control, name: "isAddon" }) ?? false;

    const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
        control: serviceForm.control,
        name: "variants"
    });

    const resetServiceState = () => {
        serviceForm.reset({
            name: "",
            description: "",
            isAddon: false,
            isActive: true,
            studioSessionId: "",
            features: [""],
            variants: [{
                locationType: "STUDIO",
                basePrice: 0,
                maxPrice: undefined,
                sessionDurationMins: 45,
                logisticsIncluded: true,
                deliverables: []
            }]
        });
        setEditModeService(null);
    };

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

    const handleServiceSubmit = (dataInput: z.input<typeof ServiceSchema>) => {
        const data = ServiceSchema.parse(dataInput);
        if (!data.studioSessionId) {
            toast.error("Please select a Studio Session.");
            return;
        }
        startTransition(async () => {
            const filteredFeatures = data.features?.filter(f => f.trim().length > 0) || [];
            const finalVariants = data.isAddon ? data.variants.map(v => ({ ...v, locationType: "STUDIO" as const })) : data.variants;
            
            if (editModeService) {
                const result = await updateService(editModeService, { 
                    ...data, 
                    features: filteredFeatures,
                    variants: finalVariants,
                    category: serviceDialogOpenForCategory as "PHOTOGRAPHY" | "VIDEOGRAPHY" | "OTHERS",
                    studioId: studioData.id 
                });
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
                    variants: finalVariants,
                    category: serviceDialogOpenForCategory as "PHOTOGRAPHY" | "VIDEOGRAPHY" | "OTHERS",
                    studioId: studioData.id
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

    const handleCloneService = (serviceId: string) => {
        const targetStudioId = studioData.id;
        
        startTransition(async () => {
            const result = await cloneService(serviceId, targetStudioId);
            if (result.status === "success") toast.success("Service cloned successfully!");
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

                <div className="flex items-center gap-2">
                    <ViewToggle defaultView="list" />
                </div>
            </CardHeader>

            <CardContent>
                <Accordion type="multiple" className="space-y-4 w-full border-none rounded-lg p-2" defaultValue={CATEGORIES}>
                    {CATEGORIES.map((category) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const services = studioData.services.filter(s => (s as any).category === category);
                        const categoryName = category.charAt(0) + category.slice(1).toLowerCase();

                        return (
                        <AccordionItem
                            key={category}
                            value={category}
                            className="border-1 border-border bg-card shadow-sm rounded-lg overflow-hidden transition-all px-4"
                        >
                            <div className="flex items-center justify-between w-full group">
                                <AccordionTrigger className="hover:no-underline py-4 flex-2">
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="size-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                                            <ChevronDownIcon className="size-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-base line-clamp-1 break-all">{categoryName}</h4>
                                            <p className="text-xs text-muted-foreground font-normal">
                                                {services.length} items
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
                                            setServiceDialogOpenForCategory(category);
                                        }}
                                    >
                                        <PlusIcon className="size-3.5" />
                                        Add Service Here
                                    </Button>
                                </div>
                            </div>

                            <AccordionContent className="pt-2 w-full">
                                {services.length > 0 ? (
                                    isListView ? (
                                        <div className="border rounded-md mt-2">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Service</TableHead>
                                                        <TableHead>Base Price</TableHead>
                                                        <TableHead>Duration</TableHead>
                                                        <TableHead>Features</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {services.map((svc) => {
                                                        const sessionBinding = studioData.studioSessions.find(s => s.id === svc.studioSessionId);
                                                        const basePrice = svc.variants?.[0]?.basePrice ? Number(svc.variants[0].basePrice) : 0;
                                                        return (
                                                            <TableRow key={svc.id}>
                                                                <TableCell>
                                                                    <div className="font-medium">
                                                                        {svc.name}
                                                                        {svc.variants && svc.variants.length > 0 && (
                                                                            <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{svc.variants.length} Variant{svc.variants.length > 1 ? 's' : ''}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground line-clamp-1 max-w-[250px]">{svc.description}</div>
                                                                </TableCell>
                                                                <TableCell className="font-medium text-primary">
                                                                    ₦{basePrice.toLocaleString()}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="text-xs flex items-center gap-1">
                                                                        <ClockIcon className="size-3" />
                                                                        {sessionBinding ? `${sessionBinding.name} (${sessionBinding.duration}m)` : "Unmanaged"}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                                        {svc.features?.slice(0, 2).map((f, i) => (
                                                                            <span key={i} className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5 rounded-sm">
                                                                                {f}
                                                                            </span>
                                                                        ))}
                                                                        {(svc.features?.length || 0) > 2 && (
                                                                            <span className="text-[10px] text-muted-foreground">+{svc.features!.length - 2} more</span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right flex items-center justify-end gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="size-8 h-8 w-8 text-muted-foreground hover:text-primary"
                                                                        onClick={() => handleCloneService(svc.id)}
                                                                        title="Clone Service"
                                                                    >
                                                                        <CopyIcon className="size-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="size-8 h-8 w-8 text-muted-foreground hover:text-primary"
                                                                        onClick={() => {
                                                                            setEditModeService(svc.id);
                                                                            const svcFeatures = (svc.features && svc.features.length > 0) ? svc.features : [""];
                                                                            
                                                                            const mappedVariants = (svc.variants && svc.variants.length > 0) 
                                                                                ? svc.variants.map((v) => ({
                                                                                    id: v.id,
                                                                                    title: v.title ?? undefined,
                                                                                    locationType: v.locationType as "STUDIO" | "OUTDOOR" | "BOTH" | "MULTIPLE",
                                                                                    basePrice: Number(v.basePrice),
                                                                                    maxPrice: v.maxPrice ? Number(v.maxPrice) : undefined,
                                                                                    sessionDurationMins: v.sessionDurationMins,
                                                                                    logisticsIncluded: v.logisticsIncluded,
                                                                                    deliverables: v.deliverables?.map((d) => ({
                                                                                        label: d.label,
                                                                                        quantity: d.quantity ?? undefined,
                                                                                        detail: d.detail ?? undefined,
                                                                                        isFree: d.isFree
                                                                                    })) || []
                                                                                }))
                                                                                : [];

                                                                            serviceForm.reset({
                                                                                name: svc.name,
                                                                                description: svc.description || "",
                                                                                isAddon: svc.isAddon,
                                                                                isActive: svc.isActive,
                                                                                studioSessionId: svc.studioSessionId || "",
                                                                                features: svcFeatures,
                                                                                variants: mappedVariants
                                                                            });
                                                                            setServiceDialogOpenForCategory(category);
                                                                        }}
                                                                        title="Edit Service"
                                                                    >
                                                                        <PencilIcon className="size-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="size-8 h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                        onClick={() => handleDeleteService(svc.id)}
                                                                        title="Delete Service"
                                                                    >
                                                                        <Trash className="size-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            {services.map((svc) => {
                                                const sessionBinding = studioData.studioSessions.find(s => s.id === svc.studioSessionId);
                                                // ✅ Safely extract base price from variants
                                                const basePrice = svc.variants?.[0]?.basePrice ? Number(svc.variants[0].basePrice) : 0;
                                                return (
                                                    <div key={svc.id} className="flex flex-col border rounded-md p-3 bg-muted/20 relative group/svc">
                                                        <h5 className="font-medium text-sm flex gap-2 items-center">
                                                            {svc.name}
                                                            {svc.variants && svc.variants.length > 0 && (
                                                                <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full leading-none">{svc.variants.length} Var</span>
                                                            )}
                                                        </h5>
                                                        <span className="text-xs font-bold text-primary mt-1">
                                                            ₦{basePrice.toLocaleString()}
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
                                                                onClick={() => handleCloneService(svc.id)}
                                                                title="Clone Service"
                                                            >
                                                                <CopyIcon className="size-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-6 h-6 w-6 text-muted-foreground hover:text-primary"
                                                                onClick={() => {
                                                                    setEditModeService(svc.id);
                                                                    const svcFeatures = (svc.features && svc.features.length > 0) ? svc.features : [""];
                                                                    
                                                                    const mappedVariants = (svc.variants && svc.variants.length > 0) 
                                                                        ? svc.variants.map((v) => ({
                                                                            id: v.id,
                                                                            title: v.title ?? undefined,
                                                                            locationType: v.locationType as "STUDIO" | "OUTDOOR" | "BOTH" | "MULTIPLE",
                                                                            basePrice: Number(v.basePrice),
                                                                            maxPrice: v.maxPrice ? Number(v.maxPrice) : undefined,
                                                                            sessionDurationMins: v.sessionDurationMins,
                                                                            logisticsIncluded: v.logisticsIncluded,
                                                                            deliverables: v.deliverables?.map((d) => ({
                                                                                label: d.label,
                                                                                quantity: d.quantity ?? undefined,
                                                                                detail: d.detail ?? undefined,
                                                                                isFree: d.isFree
                                                                            })) || []
                                                                        }))
                                                                        : [];

                                                                    serviceForm.reset({
                                                                        name: svc.name,
                                                                        description: svc.description || "",
                                                                        isAddon: svc.isAddon,
                                                                        isActive: svc.isActive,
                                                                        studioSessionId: svc.studioSessionId || "",
                                                                        features: svcFeatures,
                                                                        variants: mappedVariants
                                                                    });
                                                                    setServiceDialogOpenForCategory(category);
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
                                    )
                                ) : (
                                    <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md bg-secondary/30 mt-2">
                                        Zero active services.
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    )})}
                </Accordion>
            </CardContent>

            <Dialog
                open={!!serviceDialogOpenForCategory}
                onOpenChange={(isOpen) => !isOpen && setServiceDialogOpenForCategory(null)}
            >
                <DialogContent className="sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto w-full">
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
                                        <Input {...field} placeholder="e.g. 5 Concept Lighting Setup" disabled={isPending} />
                                    </Field>
                                )}
                            />
                            
                            <Controller
                                name="description"
                                control={serviceForm.control}
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel>Public Description</FieldLabel>
                                        <Textarea {...field} placeholder="Provide specific details clients see..." disabled={isPending} className="min-h-20" />
                                    </Field>
                                )}
                            />
                            
                            <Field>
                                <FieldLabel>Features</FieldLabel>
                                <div className="flex flex-col gap-2">
                                    {(watchedFeatures.length > 0 ? watchedFeatures : [""]).map((featureValue, index) => (
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
                                                disabled={isPending || (watchedFeatures.length <= 1 && !featureValue)}
                                            >
                                                <MinusIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" onClick={addFeatureField} className="w-full text-xs" disabled={isPending}>
                                        <PlusIcon className="mr-2 h-4 w-4" />
                                        Add Another Feature
                                    </Button>
                                </div>
                            </Field>

                            {/* Dynamic Variants */}
                            <div className="flex flex-col gap-4 mt-4">
                                <div className="flex items-center justify-between">
                                    <FieldLabel className="mb-0">Pricing & Variants</FieldLabel>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 gap-1"
                                        onClick={() => {
                                            // Auto-detect a good default duration from the session if selected
                                            const sessionId = serviceForm.getValues("studioSessionId");
                                            const session = studioData.studioSessions.find(s => s.id === sessionId);
                                            appendVariant({ 
                                                locationType: "STUDIO", 
                                                basePrice: 0, 
                                                sessionDurationMins: session ? session.duration : 45, 
                                                logisticsIncluded: true, 
                                                deliverables: [] 
                                            });
                                        }}
                                        disabled={isPending}
                                    >
                                        <PlusIcon className="size-3.5" /> Add Variant
                                    </Button>
                                </div>
                                
                                {variantFields.map((field, index) => {
                                    return (
                                        <div key={field.id} className="p-4 border rounded-md bg-muted/10 relative flex flex-col gap-3">
                                            {variantFields.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute top-2 right-2 size-6 text-muted-foreground hover:text-destructive z-10"
                                                    onClick={() => removeVariant(index)}
                                                    disabled={isPending}
                                                >
                                                    <Trash className="size-3" />
                                                </Button>
                                            )}
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <Controller
                                                    name={`variants.${index}.title`}
                                                    control={serviceForm.control}
                                                    render={({ field }) => (
                                                        <Field>
                                                            <FieldLabel>Variant Title (Opt)</FieldLabel>
                                                            <Input {...field} value={field.value || ""} placeholder="e.g. Premium Package" disabled={isPending} />
                                                        </Field>
                                                    )}
                                                />
                                                <Controller
                                                    name={`variants.${index}.locationType`}
                                                    control={serviceForm.control}
                                                    render={({ field }) => (
                                                        <Field className={watchedIsAddon ? "hidden" : ""}>
                                                            <FieldLabel>Location Type</FieldLabel>
                                                            <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Location" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {["STUDIO", "OUTDOOR", "BOTH", "MULTIPLE"].map(loc => (
                                                                        <SelectItem 
                                                                            key={loc} 
                                                                            value={loc} 
                                                                        >
                                                                            {loc}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </Field>
                                                    )}
                                                />
                                                <div className="flex gap-2">
                                                    <Controller
                                                        name={`variants.${index}.basePrice`}
                                                        control={serviceForm.control}
                                                        render={({ field: { value, onChange, ...f } }) => (
                                                            <Field className="flex-1">
                                                                <FieldLabel>Base Price</FieldLabel>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                                                                    <Input {...f} value={value === 0 ? "" : value} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} type="number" className="pl-8" placeholder="25000" disabled={isPending} />
                                                                </div>
                                                            </Field>
                                                        )}
                                                    />
                                                    <Controller
                                                        name={`variants.${index}.maxPrice`}
                                                        control={serviceForm.control}
                                                        render={({ field: { value, onChange, ...f } }) => (
                                                            <Field className="flex-1">
                                                                <FieldLabel>Max Price</FieldLabel>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                                                                    <Input {...f} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} type="number" className="pl-8" placeholder="(Opt)" disabled={isPending} />
                                                                </div>
                                                            </Field>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <Controller
                                                    name={`variants.${index}.sessionDurationMins`}
                                                    control={serviceForm.control}
                                                    render={({ field: { value, onChange, ...f } }) => (
                                                        <Field>
                                                            <FieldLabel>Duration (Mins)</FieldLabel>
                                                            <Input {...f} value={value || ""} onChange={e => onChange(Number(e.target.value))} type="number" disabled={isPending} />
                                                        </Field>
                                                    )}
                                                />
                                                <Controller
                                                    name={`variants.${index}.logisticsIncluded`}
                                                    control={serviceForm.control}
                                                    render={({ field: { value, onChange } }) => (
                                                        <Field className="justify-center">
                                                            <label className="flex items-center gap-2 mt-6 cursor-pointer text-sm font-medium">
                                                                <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} disabled={isPending} className="rounded border-muted-foreground/30 text-primary focus:ring-primary size-4" />
                                                                Logistics Included?
                                                            </label>
                                                        </Field>
                                                    )}
                                                />
                                            </div>
                                            
                                            <VariantDeliverables control={serviceForm.control} variantIndex={index} isPending={isPending} />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <Controller
                                    name="studioSessionId"
                                    control={serviceForm.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel>Studio Session Bound</FieldLabel>
                                            <Select 
                                              value={field.value} 
                                              onValueChange={(val) => {
                                                  field.onChange(val);
                                                  // Auto-update the variant duration to match the session
                                                  const session = studioData.studioSessions.find(s => s.id === val);
                                                  if (session) {
                                                      serviceForm.setValue("variants.0.sessionDurationMins", session.duration);
                                                  }
                                              }} 
                                              disabled={isPending}
                                            >
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
                                {/* ✅ Replaced 'type' with 'isAddon' boolean select */}
                                <Controller
                                    name="isAddon"
                                    control={serviceForm.control}
                                    render={({ field }) => (
                                        <Field>
                                            <FieldLabel>Service Type</FieldLabel>
                                            <Select value={field.value ? "true" : "false"} onValueChange={(val) => field.onChange(val === "true")} disabled={isPending}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="false">Standard Service</SelectItem>
                                                    <SelectItem value="true">Optional Add-on</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="isActive"
                                    control={serviceForm.control}
                                    render={({ field: { value, onChange } }) => (
                                        <Field className="justify-center">
                                            <label className="flex items-center gap-2 mt-6 cursor-pointer text-sm font-medium">
                                                <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} disabled={isPending} className="rounded border-muted-foreground/30 text-primary focus:ring-primary size-4" />
                                                Active (Bookable)
                                            </label>
                                        </Field>
                                    )}
                                />
                            </div>

                            {studioData.studioSessions.length === 0 && (
                                <div className="rounded-md bg-destructive/10 text-destructive text-xs p-3 font-medium mt-2">
                                    You must create at least one Studio Session via the &apos;Settings&apos; tab first!
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
                            <Button type="submit" disabled={isPending || studioData.studioSessions.length === 0 || !watchedSessionId}>
                                {isPending ? <Loader2Icon className="animate-spin size-4 mr-2" /> : null}
                                {editModeService ? "Update" : "Add"} Service
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}