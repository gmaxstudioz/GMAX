"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateBookingFull } from "@/lib/actions/booking";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { Loader2, ChevronDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateBookingSchema, UpdateBookingInput, BookingStatus, PaymentStatus, DeliveryStatus, PaymentPlan } from "@/lib/schemas/booking";
import { Field, FieldLabel } from "@/components/ui/field";
import { ClientOutput } from "@/lib/schemas/client";
import { ServiceOutput } from "@/lib/schemas/service";
import { MembersOutput } from "@/lib/schemas/studio";



interface UpdateBookingDialogProps {
    bookingId: string;
    currentData: {
        notes: string | null;
        sessionCount: number;
        bookingStatus: string;
        paymentStatus: string;
        deliveryStatus: string;
        clientId: string;
        serviceId: string;
        serviceVariantId?: string;
        memberId: string;
        bookingDate: string;
        addonIds: string[];
        totalAmount?: number;
        paymentPlan?: string;
    };
    clients: ClientOutput[];
    services: ServiceOutput[];
    members: MembersOutput[];
}

export function UpdateBookingDialog({ bookingId, currentData, clients, services, members }: UpdateBookingDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);

    // Filter data states
    const [clientSearch, setClientSearch] = useState("");
    const [serviceSearch, setServiceSearch] = useState("");
    const [clientOpen, setClientOpen] = useState(false);
    const [serviceOpen, setServiceOpen] = useState(false);

    // Derived data
    const mainServices = useMemo(() => services.filter(s => !s.isAddon), [services]);
    const addonServices = useMemo(() => services.filter(s => s.isAddon), [services]);

    // Flatten addons into variants
    const flattenedAddons = useMemo(() => {
        return addonServices.flatMap(addon => 
            (addon.variants || []).map((variant: NonNullable<ServiceOutput["variants"]>[number]) => ({
                compositeId: `${addon.id}:${variant.id}`,
                addon,
                variant
            }))
        );
    }, [addonServices]);

    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return clients;
        const q = clientSearch.toLowerCase();
        return clients.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }, [clients, clientSearch]);

    const filteredMainServices = useMemo(() => {
        if (!serviceSearch.trim()) return mainServices;
        const q = serviceSearch.toLowerCase();
        return mainServices.filter(s => s.name.toLowerCase().includes(q));
    }, [mainServices, serviceSearch]);

    const form = useForm<UpdateBookingInput>({
        resolver: zodResolver(UpdateBookingSchema),
        defaultValues: {
            notes: currentData.notes || "",
            sessionCount: currentData.sessionCount,
            bookingStatus: currentData.bookingStatus as BookingStatus,
            paymentStatus: currentData.paymentStatus as PaymentStatus,
            deliveryStatus: currentData.deliveryStatus as DeliveryStatus,
            clientId: currentData.clientId,
            serviceId: currentData.serviceId,
            serviceVariantId: currentData.serviceVariantId,
            memberId: currentData.memberId,
            bookingDate: currentData.bookingDate ? new Date(currentData.bookingDate) : undefined,
            addonIds: (currentData.addonIds || []).map(id => {
                if (id.includes(':')) return id;
                const match = flattenedAddons.find(fa => fa.compositeId.startsWith(`${id}:`));
                return match ? match.compositeId : id;
            }),
            totalAmount: currentData.totalAmount ?? 0,
            paymentPlan: (currentData.paymentPlan as PaymentPlan) ?? "FULL",
        }
    });

    const watchedClientId = form.watch("clientId");
    const watchedServiceId = form.watch("serviceId");
    const watchedServiceVariantId = form.watch("serviceVariantId");
    const watchedAddonIds = form.watch("addonIds") || [];
    const watchedPaymentPlan = form.watch("paymentPlan") || "FULL";
    const watchedTotalAmount = form.watch("totalAmount") || 0;
    const watchedSessionCount = form.watch("sessionCount") || 1;

    const selectedClient = useMemo(() => clients.find(c => c.id === watchedClientId), [clients, watchedClientId]);
    const selectedService = useMemo(() => mainServices.find(s => s.id === watchedServiceId), [mainServices, watchedServiceId]);
    const selectedVariant = useMemo(() => selectedService?.variants?.find(v => v.id === watchedServiceVariantId), [selectedService, watchedServiceVariantId]);

    const selectedAddonVariants = useMemo(() => flattenedAddons.filter(a => watchedAddonIds.includes(a.compositeId)), [flattenedAddons, watchedAddonIds]);

    function toggleAddon(compositeId: string) {
        const baseAddonId = compositeId.split(':')[0];
        
        // Remove any existing variant of this exact same addon
        const filtered = watchedAddonIds.filter(id => id.split(':')[0] !== baseAddonId);
        
        // If the exact same composite ID was clicked, it means we are unchecking it
        if (watchedAddonIds.includes(compositeId)) {
            form.setValue("addonIds", filtered, { shouldValidate: true });
            return;
        }
        
        // Otherwise, add the new selection
        const next = [...filtered, compositeId];
        form.setValue("addonIds", next, { shouldValidate: true });
    }

    const onSubmit = (data: UpdateBookingInput) => {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(updateBookingFull(bookingId, {
                notes: data.notes,
                sessionCount: data.sessionCount,
                bookingStatus: data.bookingStatus,
                paymentStatus: data.paymentStatus,
                deliveryStatus: data.deliveryStatus,
                clientId: data.clientId,
                serviceId: data.serviceId,
                serviceVariantId: data.serviceVariantId,
                memberId: data.memberId,
                bookingDate: data.bookingDate ? data.bookingDate.toISOString() : undefined,
                addonIds: data.addonIds,
                totalAmount: data.totalAmount,
                paymentPlan: data.paymentPlan as PaymentPlan,
            }));
            
            if (error) {
                toast.error("An unexpected error occurred.");
                return;
            }
            if (result?.status === "success") {
                toast.success(result.message);
                setOpen(false);
            } else {
                toast.error(result?.message || "Failed to update.");
            }
        });
    };

    const handleOpenChange = (v: boolean) => {
        setOpen(v);
        if (v) {
            form.reset({
                notes: currentData.notes || "",
                sessionCount: currentData.sessionCount,
                bookingStatus: currentData.bookingStatus as BookingStatus,
                paymentStatus: currentData.paymentStatus as PaymentStatus,
                deliveryStatus: currentData.deliveryStatus as DeliveryStatus,
                clientId: currentData.clientId,
                serviceId: currentData.serviceId,
                serviceVariantId: currentData.serviceVariantId,
                memberId: currentData.memberId,
                bookingDate: currentData.bookingDate ? new Date(currentData.bookingDate) : undefined,
                addonIds: currentData.addonIds || [],
                totalAmount: currentData.totalAmount ?? 0,
                paymentPlan: (currentData.paymentPlan as PaymentPlan) ?? "FULL",
            });
            setClientSearch("");
            setServiceSearch("");
            setClientOpen(false);
            setServiceOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
                    <span className="hidden md:inline">Edit Booking</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Booking</DialogTitle>
                    <DialogDescription>Update booking details, assignment, and statuses.</DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-2">
                    {/* Client Selection */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Client</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setClientOpen(!clientOpen); setServiceOpen(false); }}
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
                                                onClick={() => { form.setValue("clientId", c.id, { shouldValidate: true }); setClientOpen(false); setClientSearch(""); }}
                                                className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm rounded-md transition-colors hover:bg-accent ${watchedClientId === c.id ? "bg-accent font-medium" : ""}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={c.image || undefined} />
                                                        <AvatarFallback className="text-[10px]">{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <span>{c.name}</span>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] capitalize">{c.type}</Badge>
                                            </div>
                                        )) : (
                                            <p className="text-sm text-muted-foreground text-center py-3">No clients found</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {form.formState.errors.clientId && (
                            <p className="text-xs text-red-500">{form.formState.errors.clientId.message}</p>
                        )}
                    </div>

                    {/* Service Selection */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Service</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setServiceOpen(!serviceOpen); setClientOpen(false); }}
                                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                                <span className={selectedService ? "" : "text-muted-foreground"}>
                                    {selectedService ? selectedService.name : "Choose a service..."}
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
                                                onClick={() => { form.setValue("serviceId", s.id, { shouldValidate: true }); setServiceOpen(false); setServiceSearch(""); }}
                                                className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm rounded-md transition-colors hover:bg-accent ${watchedServiceId === s.id ? "bg-accent font-medium" : ""}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span>{s.name}</span>
                                                    <Badge variant="outline" className="text-[10px] capitalize">{s.isAddon ? "ADDON" : "SERVICE"}</Badge>
                                                </div>
                                                <span className="text-muted-foreground font-mono text-xs">
                                                    ₦{Number(s.variants?.[0]?.basePrice ?? 0).toLocaleString()}
                                                </span>
                                            </div>
                                        )) : (
                                            <p className="text-sm text-muted-foreground text-center py-3">No services found</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {form.formState.errors.serviceId && (
                            <p className="text-xs text-red-500">{form.formState.errors.serviceId.message}</p>
                        )}
                    </div>

                    {/* Variant Selection */}
                    {selectedService && selectedService.variants && selectedService.variants.length > 0 && (
                        <Controller
                            control={form.control}
                            name="serviceVariantId"
                            render={({ field }) => (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium">Variant (Location & Logistics)</label>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a variant..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedService.variants?.map((v: NonNullable<ServiceOutput["variants"]>[number]) => (
                                                <SelectItem key={v.id} value={v.id}>
                                                    {v.locationType} — ₦{Number(v.basePrice).toLocaleString()}
                                                    {v.maxPrice && ` to ₦${Number(v.maxPrice).toLocaleString()}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedVariant && (
                                        <div className="mt-2 text-sm bg-accent/50 p-3 rounded-md space-y-2">
                                            {!selectedVariant.logisticsIncluded && (
                                                <div className="text-amber-600 font-medium text-xs flex items-center gap-1.5 bg-amber-500/10 p-2 rounded">
                                                    <HugeiconsIcon icon={AlertCircleIcon} size={14} aria-label="Logistics Warning" />
                                                    Client must cover logistics for this location.
                                                </div>
                                            )}
                                            {selectedVariant.deliverables && selectedVariant.deliverables.length > 0 && (
                                                <div>
                                                    <p className="font-semibold text-xs text-muted-foreground mb-1">Deliverables:</p>
                                                    <ul className="list-disc list-inside text-xs space-y-0.5 ml-1">
                                                        {selectedVariant.deliverables.map((d: NonNullable<NonNullable<ServiceOutput["variants"]>[number]["deliverables"]>[number]) => (
                                                            <li key={d.label}>
                                                                {d.quantity ? `${d.quantity} ` : ""}{d.label}
                                                                {d.detail && <span className="text-muted-foreground ml-1">({d.detail})</span>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        />
                    )}

                    {/* Add-ons */}
                    {flattenedAddons.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Add-ons <span className="text-muted-foreground font-normal">(Optional)</span></label>
                            <div className="border rounded-lg max-h-[220px] overflow-y-auto">
                                {flattenedAddons.map(item => (
                                    <label
                                        key={item.compositeId}
                                        className="flex items-start justify-between px-3 py-3 cursor-pointer text-sm transition-colors hover:bg-accent border-b last:border-0"
                                    >
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                className="mt-1"
                                                checked={watchedAddonIds.includes(item.compositeId)}
                                                onCheckedChange={() => toggleAddon(item.compositeId)}
                                            />
                                            <div className="flex flex-col">
                                                <span>{item.addon.name} <span className="text-muted-foreground text-xs font-medium ml-1">({item.variant.locationType})</span></span>
                                                {item.variant.deliverables && item.variant.deliverables.length > 0 && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {item.variant.deliverables.map((d: NonNullable<NonNullable<ServiceOutput["variants"]>[number]["deliverables"]>[number]) => `${d.quantity ? d.quantity + ' ' : ''}${d.label}`).join(" • ")}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-muted-foreground font-mono text-xs whitespace-nowrap ml-4 mt-1">
                                            ₦{Number(item.variant.basePrice).toLocaleString()}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Assigned Member + Session Count */}
                    <div className="grid grid-cols-2 gap-4">
                        <Controller
                            control={form.control}
                            name="memberId"
                            render={({ field }) => (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium">Assigned Staff</label>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                                        <SelectContent>
                                            {members.map(m => (
                                                <SelectItem key={m.id} value={m.id}>
                                                    {m.name} <span className="text-muted-foreground capitalize ml-1">({m.role})</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        />
                        <Controller
                                control={form.control}
                                name="sessionCount"
                                render={({ field: { value, onChange } }) => (
                                    <Field className="flex flex-col gap-2">
                                        <FieldLabel>Session Count</FieldLabel>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={value}
                                            onChange={(e) => onChange(Number(e.target.value))}
                                        />
                                        {form.formState.errors.sessionCount && (
                                            <p className="text-xs text-red-500">{form.formState.errors.sessionCount.message}</p>
                                        )}
                                    </Field>
                                )}
                            />
                        </div>

                    {/* Date & Time */}
                    <Controller
                        control={form.control}
                        name="bookingDate"
                        render={({ field: { value, onChange } }) => (
                            <Field className="flex flex-col gap-2 col-span-2">
                                <FieldLabel>Booking Date & Time</FieldLabel>
                                <Input
                                    type="datetime-local"
                                    value={value ? new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                                    onChange={(e) => {
                                        onChange(new Date(e.target.value));
                                    }}
                                />
                                {form.formState.errors.bookingDate && (
                                    <p className="text-xs text-red-500">{form.formState.errors.bookingDate.message}</p>
                                )}
                            </Field>
                        )}
                    />

                    <Separator />

                    {/* Status Selects */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Controller
                            control={form.control}
                            name="bookingStatus"
                            render={({ field }) => (
                                <Field className="flex flex-col gap-2">
                                    <FieldLabel>Booking Status</FieldLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PENDING">Pending</SelectItem>
                                            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                                            <SelectItem value="COMPLETED">Completed</SelectItem>
                                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="paymentStatus"
                            render={({ field }) => (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium">Payment</label>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PENDING">Pending</SelectItem>
                                            <SelectItem value="PAID">Paid</SelectItem>
                                            <SelectItem value="PARTIALLY_PAID">Partial</SelectItem>
                                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="deliveryStatus"
                            render={({ field }) => (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium">Delivery</label>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PENDING">Pending</SelectItem>
                                            <SelectItem value="DELIVERED">Delivered</SelectItem>
                                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        />
                    </div>

                    <Separator />

                    {/* Financials */}
                    <div className="grid grid-cols-2 gap-4">
                        <Controller
                            control={form.control}
                            name="paymentPlan"
                            render={({ field }) => (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium">Payment Plan</label>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FULL">Full Payment (100%)</SelectItem>
                                            <SelectItem value="HALF">Half Payment (50%)</SelectItem>
                                            <SelectItem value="QUARTER">Quarter Payment (25%)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="totalAmount"
                            render={({ field: { value, onChange } }) => (
                                <Field className="flex flex-col gap-2">
                                    <FieldLabel>Total Amount (₦)</FieldLabel>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={value}
                                        onChange={(e) => onChange(Number(e.target.value))}
                                    />
                                    {form.formState.errors.totalAmount && (
                                        <p className="text-xs text-red-500">{form.formState.errors.totalAmount.message}</p>
                                    )}
                                </Field>
                            )}
                        />
                        <div className="col-span-2 bg-muted p-3 rounded-md flex justify-between items-center text-sm">
                            <span className="font-medium">Amount Due Now ({watchedPaymentPlan}):</span>
                            <span className="font-bold text-lg">
                                ₦{(watchedTotalAmount * (watchedPaymentPlan === "FULL" ? 1 : watchedPaymentPlan === "HALF" ? 0.5 : 0.25)).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <Separator />

                    {/* Notes */}
                    <Controller
                        control={form.control}
                        name="notes"
                        render={({ field: { value, onChange } }) => (
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Notes</label>
                                <Textarea
                                    value={value || ""}
                                    onChange={onChange}
                                    placeholder="Add any special notes..."
                                    rows={3}
                                    className="resize-none"
                                />
                                {form.formState.errors.notes && (
                                    <p className="text-xs text-red-500">{form.formState.errors.notes.message}</p>
                                )}
                            </div>
                        )}
                    />

                    <Button type="submit" disabled={isPending} className="w-full">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Changes
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
