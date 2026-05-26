"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { checkClientName, createPublicBooking } from "@/lib/actions/public-booking";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    UserIcon,
    PackageIcon,
    CalendarIcon,
    CreditCardIcon,
    CheckCircle2Icon,
    Loader2,
    AlertCircleIcon,
} from "lucide-react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PublicBookingSchema, PublicBookingInput } from "@/lib/schemas/booking";
import Link from "next/link";

interface Category {
    id: string;
    name: string;
    services: {
        id: string;
        name: string;
        isAddon: boolean;
        basePrice: number;
        bothVariantPrice: number | null;
        studioSession: { duration: number } | null;
    }[];
}

interface Addon {
    id: string;
    name: string;
    basePrice: number;
}

interface BookingWizardProps {
    studioId: string;
    categories: Category[];
    addons: Addon[];
}

const STEPS = [
    { id: 1, label: "Your Info", icon: UserIcon },
    { id: 2, label: "Service", icon: PackageIcon },
    { id: 3, label: "Date & Time", icon: CalendarIcon },
    { id: 4, label: "Review & Pay", icon: CreditCardIcon },
];

export function BookingWizard({ studioId, categories, addons }: BookingWizardProps) {
    const [step, setStep] = useState(1);
    const [isPending, startTransition] = useTransition();

    const form = useForm<PublicBookingInput>({
        resolver: zodResolver(PublicBookingSchema),
        defaultValues: {
            clientName: "",
            clientPhone: "",
            clientEmail: "",
            useExisting: false,
            existingClientId: "",
            selectedServiceId: "",
            selectedAddonIds: [],
            sessionCount: 1,
            extraPicturesCount: 0,
            bookingDate: "",
            bookingTime: "",
            paymentPlan: "FULL",
            notes: "",
        },
        mode: "onBlur"
    });

    const { setValue, formState: { errors }, trigger, control } = form;

    // ✅ All reactive subscriptions via useWatch
    const clientName        = useWatch({ control, name: "clientName" }) ?? "";
    const clientPhone       = useWatch({ control, name: "clientPhone" }) ?? "";
    const clientEmail       = useWatch({ control, name: "clientEmail" }) ?? "";
    const useExisting       = useWatch({ control, name: "useExisting" }) ?? false;
    const selectedServiceId = useWatch({ control, name: "selectedServiceId" }) ?? "";
    const watchedAddonIds   = useWatch({ control, name: "selectedAddonIds" });
    const selectedAddonIds  = useMemo(() => watchedAddonIds ?? [], [watchedAddonIds]);
    const sessionCount      = useWatch({ control, name: "sessionCount" }) ?? 1;
    const extraPicturesCount = useWatch({ control, name: "extraPicturesCount" }) ?? 0;
    const bookingDate       = useWatch({ control, name: "bookingDate" }) ?? "";
    const bookingTime       = useWatch({ control, name: "bookingTime" }) ?? "";
    const notes             = useWatch({ control, name: "notes" }) ?? "";

    const [existingClient, setExistingClient] = useState<{
        exists: boolean;
        client?: { id: string; name: string; maskedPhone: string | null };
    } | null>(null);
    const [nameCheckLoading, setNameCheckLoading] = useState(false);

    const [bookingResult, setBookingResult] = useState<{
        bookingId: string;
        paymentUrl: string | null;
        reference: string;
        amount: number;
    } | null>(null);

    const allServices = useMemo(() => categories.flatMap(c => c.services), [categories]);
    const selectedService = useMemo(() => allServices.find(s => s.id === selectedServiceId), [allServices, selectedServiceId]);
    const selectedAddons = useMemo(() => addons.filter(a => selectedAddonIds.includes(a.id)), [addons, selectedAddonIds]);

    const servicePrice = selectedService?.basePrice ?? 0;
    const bothVariantPrice = selectedService?.bothVariantPrice ?? 0;
    const sessionTotal = servicePrice * sessionCount;
    const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.basePrice, 0);
    const extraPicturesTotal = bothVariantPrice * extraPicturesCount;
    const grandTotal = sessionTotal + addonsTotal + extraPicturesTotal;

    useEffect(() => {
        if (!clientName || clientName.trim().length < 2) {
            setExistingClient(null);
            return;
        }
        let isCancelled = false;
        const timeout = setTimeout(async () => {
            setNameCheckLoading(true);
            try {
                const result = await checkClientName(studioId, clientName.trim());
                if (isCancelled) return;
                setExistingClient(result);
                if (result.exists && result.client) {
                    setValue("existingClientId", result.client.id);
                }
            } catch (error) {
                console.error("Failed to check client name:", error);
            } finally {
                if (!isCancelled) {
                    setNameCheckLoading(false);
                }
            }
        }, 600);
        return () => {
            isCancelled = true;
            clearTimeout(timeout);
        };
    }, [clientName, studioId, setValue]);

    const handleNext = async () => {
        let isValid = false;
        if (step === 1) {
            const nameValid = await trigger("clientName");
            if (!nameValid) return;
            if (existingClient?.exists && !useExisting) {
                if (!clientPhone?.trim()) {
                    form.setError("clientPhone", { type: "manual", message: "Phone number required for a new client" });
                    return;
                }
            } else if (!existingClient?.exists) {
                if (!clientPhone?.trim()) {
                    form.setError("clientPhone", { type: "manual", message: "Phone number required" });
                    return;
                }
            }
            const emailValid = await trigger("clientEmail");
            if (!emailValid) return;
            isValid = true;
        } else if (step === 2) {
            const serviceValid = await trigger(["selectedServiceId", "sessionCount"]);
            if (!serviceValid) return;
            isValid = true;
        } else if (step === 3) {
            const dateValid = await trigger(["bookingDate", "bookingTime"]);
            if (!dateValid) return;
            isValid = true;
        }
        if (isValid) setStep(s => s + 1);
    };

    const onSubmit = (data: PublicBookingInput) => {
        startTransition(async () => {
            const dateTime = `${data.bookingDate}T${data.bookingTime}:00`;
            const { data: result, error } = await tryCatch(createPublicBooking({
                studioId,
                clientName: data.clientName.trim(),
                clientPhone: data.clientPhone?.trim() || "",
                clientEmail: data.clientEmail?.trim() || undefined,
                existingClientId: data.useExisting && existingClient?.client ? existingClient.client.id : undefined,
                serviceId: data.selectedServiceId,
                addonIds: data.selectedAddonIds.length > 0 ? data.selectedAddonIds : undefined,
                sessionCount: data.sessionCount,
                bookingDate: dateTime,
                notes: data.notes?.trim() || undefined,
            }));

            if (error) {
                toast.error("Something went wrong. Please try again.");
                return;
            }

            if (result?.status === "success" && result.data) {
                setBookingResult(result.data);
                setStep(5);
                if (result.data.paymentUrl) {
                    setTimeout(() => {
                        window.open(result.data!.paymentUrl!, "_blank");
                    }, 1500);
                }
            } else {
                toast.error(result?.message || "Failed to create booking");
            }
        });
    };

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(v);

    if (step === 5 && bookingResult) {
        return (
            <Card className="shadow-lg">
                <CardContent className="flex flex-col items-center gap-6 py-10 sm:py-14">
                    <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                        <CheckCircle2Icon className="h-10 w-10 text-green-600" />
                    </div>
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl sm:text-3xl font-bold">Booking Confirmed!</h2>
                        <p className="text-muted-foreground max-w-sm">
                            Your session has been booked successfully. {bookingResult.paymentUrl ? "Complete your payment to confirm." : "The studio will contact you shortly."}
                        </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 border p-4 text-center space-y-1 w-full max-w-xs">
                        <p className="text-xs text-muted-foreground">Total Amount</p>
                        <p className="text-2xl font-bold">{formatCurrency(bookingResult.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">Ref: {bookingResult.reference}</p>
                    </div>
                    {bookingResult.paymentUrl && (
                        <Link href={bookingResult.paymentUrl} target="_blank" rel="noopener noreferrer" className="w-full max-w-xs">
                            <Button className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg">
                                <CreditCardIcon className="h-4 w-4" />
                                Pay Now
                            </Button>
                        </Link>
                    )}
                    <Link href="/book" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        ← Back to Studios
                    </Link>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Progress Bar (Desktop) */}
            <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-2">
                {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    const isActive = step === s.id;
                    const isDone = step > s.id;
                    return (
                        <div key={s.id} className="flex items-center gap-2 shrink-0">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isActive ? "bg-primary text-primary-foreground" :
                                isDone ? "bg-primary/10 text-primary" :
                                "bg-muted text-muted-foreground"
                            }`}>
                                {isDone ? (
                                    <CheckCircle2Icon className="h-3.5 w-3.5" />
                                ) : (
                                    <Icon className="h-3.5 w-3.5" />
                                )}
                                <span>{s.label}</span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`w-8 h-0.5 rounded ${isDone ? "bg-primary" : "bg-muted"}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Progress Indicator (Mobile) */}
            <div className="flex sm:hidden items-center justify-between bg-muted/40 p-3 rounded-lg border">
                <div className="flex items-center gap-2 text-primary">
                    {STEPS.find(s => s.id === step)?.icon && (() => {
                        const CurrentIcon = STEPS.find(s => s.id === step)!.icon;
                        return <CurrentIcon className="h-4 w-4" />;
                    })()}
                    <span className="text-sm font-semibold">
                        {STEPS.find(s => s.id === step)?.label}
                    </span>
                </div>
                <div className="text-xs text-muted-foreground font-medium bg-background px-2 py-1 rounded-md border shadow-sm">
                    Step {step} of {STEPS.length}
                </div>
            </div>

            {/* Step Content */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl">
                            {step === 1 && "Your Information"}
                            {step === 2 && "Choose Your Service"}
                            {step === 3 && "Pick Date & Time"}
                            {step === 4 && "Review & Confirm"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* ── STEP 1: Client Info ── */}
                        <div className={step === 1 ? "block space-y-4" : "hidden"}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Full Name *</label>
                                <Controller
                                    name="clientName"
                                    control={control}
                                    render={({ field }) => (
                                        <Input
                                            {...field}
                                            onChange={(e) => {
                                                field.onChange(e);
                                                setValue("useExisting", false);
                                            }}
                                            placeholder="Enter your full name"
                                        />
                                    )}
                                />
                                {errors.clientName && (
                                    <p className="text-xs text-red-500">{errors.clientName.message}</p>
                                )}
                                {nameCheckLoading && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                                    </p>
                                )}
                                {existingClient?.exists && existingClient.client && (
                                    <div className="rounded-lg border p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 space-y-2">
                                        <p className="text-sm flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                                            <AlertCircleIcon className="h-4 w-4" />
                                            This name is already registered
                                            {existingClient.client.maskedPhone && (
                                                <span className="text-xs">({existingClient.client.maskedPhone})</span>
                                            )}
                                        </p>
                                        <div className="flex gap-2">
                                            <Controller
                                                name="useExisting"
                                                control={control}
                                                render={({ field }) => (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={field.value ? "default" : "outline"}
                                                            onClick={() => { field.onChange(true); form.clearErrors("clientPhone"); }}
                                                            className="text-xs"
                                                        >
                                                            Yes, that&apos;s me
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={!field.value ? "default" : "outline"}
                                                            onClick={() => field.onChange(false)}
                                                            className="text-xs"
                                                        >
                                                            No, I&apos;m someone new
                                                        </Button>
                                                    </>
                                                )}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {(!existingClient?.exists || !useExisting) && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Phone Number *</label>
                                    <Controller
                                        name="clientPhone"
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                placeholder="e.g. 08012345678"
                                                type="tel"
                                            />
                                        )}
                                    />
                                    {errors.clientPhone && (
                                        <p className="text-xs text-red-500">{errors.clientPhone.message}</p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Email <span className="text-muted-foreground font-normal">(Optional)</span>
                                </label>
                                <Controller
                                    name="clientEmail"
                                    control={control}
                                    render={({ field }) => (
                                        <Input
                                            {...field}
                                            value={field.value ?? ""}
                                            placeholder="your@email.com"
                                            type="email"
                                        />
                                    )}
                                />
                                {errors.clientEmail && (
                                    <p className="text-xs text-red-500">{errors.clientEmail.message}</p>
                                )}
                            </div>
                        </div>

                        {/* ── STEP 2: Service Selection ── */}
                        {/*
                            Service buttons and addon checkboxes use setValue + useWatch.
                            Controller here would require wrapping custom multi-button UI,
                            which is more complex than the value it provides.
                        */}
                        <div className={step === 2 ? "block space-y-6" : "hidden"}>
                            {categories.map(cat => (
                                <div key={cat.id} className="space-y-3">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat.name}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {cat.services.map(service => {
                                            const isSelected = selectedServiceId === service.id;
                                            return (
                                                <button
                                                    key={service.id}
                                                    type="button"
                                                    onClick={() => { setValue("selectedServiceId", service.id); form.clearErrors("selectedServiceId"); }}
                                                    className={`text-left p-4 rounded-xl border-2 transition-all hover:-translate-y-1 active:scale-[0.98] ${
                                                        isSelected
                                                            ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary ring-offset-1"
                                                            : "border-border hover:border-primary/50 hover:bg-muted/30 hover:shadow-md"
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div>
                                                            <p className="font-medium text-sm">{service.name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {service.studioSession && (
                                                                    <span className="text-[10px] text-muted-foreground">{service.studioSession.duration}min</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="font-bold text-sm">₦{service.basePrice.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                                                            <CheckCircle2Icon className="h-3 w-3" /> Selected
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {errors.selectedServiceId && (
                                <p className="text-xs text-red-500 text-center">{errors.selectedServiceId.message}</p>
                            )}

                            {addons.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Add-ons (Optional)</h3>
                                    <div className="space-y-2">
                                        {addons.map(addon => (
                                            <label key={addon.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:-translate-y-1 active:scale-[0.98] hover:shadow-md hover:border-primary/50 hover:bg-muted/30">
                                                <div className="flex items-center gap-3">
                                                    <Checkbox
                                                        checked={selectedAddonIds.includes(addon.id)}
                                                        onCheckedChange={() => {
                                                            setValue("selectedAddonIds",
                                                                selectedAddonIds.includes(addon.id)
                                                                    ? selectedAddonIds.filter(id => id !== addon.id)
                                                                    : [...selectedAddonIds, addon.id]
                                                            );
                                                        }}
                                                    />
                                                    <span className="text-sm">{addon.name}</span>
                                                </div>
                                                <span className="text-sm font-medium">₦{addon.basePrice.toLocaleString()}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Number of Sessions</label>
                                <Controller
                                    name="sessionCount"
                                    control={control}
                                    render={({ field: { value, onChange, ...f } }) => (
                                        <Input
                                            {...f}
                                            type="number"
                                            value={value ?? 1}
                                            onChange={(e) => onChange(Number(e.target.value))}
                                            min={1}
                                            className="max-w-[120px]"
                                        />
                                    )}
                                />
                            </div>

                            {(() => {
                                const selectedServiceObj = categories.flatMap(c => c.services).find(s => s.id === selectedServiceId);
                                const bothVariantPrice = selectedServiceObj?.bothVariantPrice;
                                if (bothVariantPrice == null) return null;
                                return (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Extra Pictures</label>
                                        <div className="flex items-center gap-4">
                                            <Controller
                                                name="extraPicturesCount"
                                                control={control}
                                                render={({ field: { value, onChange, ...f } }) => (
                                                    <Input
                                                        {...f}
                                                        type="number"
                                                        value={value ?? 0}
                                                        onChange={(e) => onChange(Number(e.target.value))}
                                                        min={0}
                                                        className="max-w-[120px]"
                                                    />
                                                )}
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                (₦{bothVariantPrice.toLocaleString()} each)
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── STEP 3: Date & Time ── */}
                        <div className={step === 3 ? "block space-y-4" : "hidden"}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Date *</label>
                                    <Controller
                                        name="bookingDate"
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                type="date"
                                                min={new Date().toISOString().split("T")[0]}
                                            />
                                        )}
                                    />
                                    {errors.bookingDate && (
                                        <p className="text-xs text-red-500">{errors.bookingDate.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Time *</label>
                                    <Controller
                                        name="bookingTime"
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                {...field}
                                                type="time"
                                                min="08:00"
                                                max="20:00"
                                            />
                                        )}
                                    />
                                    <p className="text-xs text-muted-foreground">Between 8:00 AM and 8:00 PM</p>
                                    {errors.bookingTime && (
                                        <p className="text-xs text-red-500">{errors.bookingTime.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                                </label>
                                <Controller
                                    name="notes"
                                    control={control}
                                    render={({ field }) => (
                                        <Textarea
                                            {...field}
                                            value={field.value ?? ""}
                                            placeholder="Any special requests or notes..."
                                            rows={3}
                                            className="resize-none"
                                        />
                                    )}
                                />
                            </div>
                        </div>

                        {/* ── STEP 4: Review ── */}
                        <div className={step === 4 ? "block space-y-4" : "hidden"}>
                            <div className="rounded-lg border p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Client</span>
                                    <span className="font-medium">{clientName}</span>
                                </div>
                                {clientPhone && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Phone</span>
                                        <span>{clientPhone}</span>
                                    </div>
                                )}
                                {clientEmail && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Email</span>
                                        <span>{clientEmail}</span>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Service</span>
                                    <span className="font-medium">{selectedService?.name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Sessions</span>
                                    <span>{sessionCount}</span>
                                </div>
                                {selectedAddons.length > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Add-ons</span>
                                        <span>{selectedAddons.map(a => a.name).join(", ")}</span>
                                    </div>
                                )}
                                {extraPicturesCount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Extra Pictures</span>
                                        <span>{extraPicturesCount}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Date</span>
                                    <span>{bookingDate}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Time</span>
                                    <span>{bookingTime}</span>
                                </div>
                                {notes && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Notes</span>
                                        <span className="text-right max-w-[200px] truncate">{notes}</span>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-2 rounded-lg bg-muted/30 border p-4">
                                <div className="flex justify-between text-sm">
                                    <span>{selectedService?.name} × {sessionCount}</span>
                                    <span>{formatCurrency(sessionTotal)}</span>
                                </div>
                                {selectedAddons.map(a => (
                                    <div key={a.id} className="flex justify-between text-sm text-muted-foreground">
                                        <span>+ {a.name}</span>
                                        <span>{formatCurrency(a.basePrice)}</span>
                                    </div>
                                ))}
                                <Separator />
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total</span>
                                    <span className="text-primary">{formatCurrency(grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex justify-between gap-4 pt-2">
                    {step > 1 && step < 5 ? (
                        <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="gap-2">
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </Button>
                    ) : <div />}
                    <div className="ml-auto">
                        {step < 4 && (
                            <Button type="button" onClick={handleNext} className="gap-2">
                                Next
                                <ArrowRightIcon className="h-4 w-4" />
                            </Button>
                        )}
                        {step === 4 && (
                            <Button
                                type="submit"
                                disabled={isPending}
                                className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCardIcon className="h-4 w-4" />}
                                Confirm & Pay
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}