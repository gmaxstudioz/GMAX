"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateBookingSchema, CreateBookingInput } from "@/lib/schemas/booking";
import { createBooking, getStudiosForBooking } from "@/lib/actions/booking";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarPlusIcon,
  ChevronDown,
  PlusIcon,
  Loader2,
  Building2Icon,
  CameraIcon,
  VideoIcon,
  LayersIcon,
} from "lucide-react";
import { DateTimeSlotPicker } from "@/app/(dashboard)/studios/[slug]/_components/DateTimeSlotPicker";
import AddClient from "@/app/(dashboard)/studios/[slug]/_components/AddClient";

export interface StudioServiceVariant {
  id: string;
  title?: string | null;
  locationType: string;
  basePrice: number | string;
  maxPrice?: number | string | null;
  logisticsIncluded?: boolean;
  sessionDurationMins?: number | null;
  deliverables?: {
    id?: string;
    label: string;
    quantity?: number | null;
    detail?: string | null;
    isFree?: boolean;
  }[];
  serviceDeliverables?: {
    id?: string;
    label: string;
    quantity?: number | null;
    detail?: string | null;
    isFree?: boolean;
  }[];
}

export interface StudioService {
  id: string;
  name: string;
  description?: string | null;
  category: "PHOTOGRAPHY" | "VIDEOGRAPHY" | "OTHERS" | string;
  isAddon: boolean;
  isActive: boolean;
  studioId: string;
  studioSessionId?: string | null;
  studioSession?: {
    id: string;
    name: string;
    duration: number;
  } | null;
  serviceVariants?: StudioServiceVariant[];
  variants?: StudioServiceVariant[];
}

export interface StudioClient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  image?: string | null;
  type?: string | null;
}

export interface StudioMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

export interface StudioBookingSummary {
  id: string;
  bookingDate: Date | string;
  sessionCount: number;
  serviceId?: string;
  bookingStatus?: string;
  studioId?: string;
  service?: {
    studioSession?: {
      duration?: number;
    } | null;
  } | null;
}

export interface StudioForBooking {
  id: string;
  name: string;
  slug: string;
  clients: StudioClient[];
  services: StudioService[];
  members: StudioMember[];
  bookings?: StudioBookingSummary[];
}

interface AddBookingDialogProps {
  studios?: StudioForBooking[];
  studio?: StudioForBooking;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultDate?: Date;
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
  syncWithUrl?: boolean;
}

export function AddBookingDialog({
  studios = [],
  studio,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultDate,
  buttonSize = "sm",
  buttonVariant = "default",
  className,
  syncWithUrl = false,
}: AddBookingDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const searchParams = useSearchParams();



  const [lazyStudios, setLazyStudios] = useState<StudioForBooking[]>([]);
  const [loadingStudios, setLoadingStudios] = useState(false);

  // Lazy load studios if none were provided and dialog is open
  useEffect(() => {
    if (open && !studio && studios.length === 0 && lazyStudios.length === 0 && !loadingStudios) {
      setLoadingStudios(true);
      getStudiosForBooking()
        .then((data) => {
          setLazyStudios(data as StudioForBooking[]);
        })
        .finally(() => {
          setLoadingStudios(false);
        });
    }
  }, [open, studio, studios.length, lazyStudios.length, loadingStudios]);

  // Compile list of studios
  const allStudios = useMemo(() => {
    if (studio) return [studio];
    if (studios.length > 0) return studios;
    return lazyStudios;
  }, [studio, studios, lazyStudios]);

  // Determine initial selected studio id from pathname or first studio
  const initialStudioId = useMemo(() => {
    if (studio) return studio.id;
    if (pathname.includes("/studios/")) {
      const slug = pathname.split("/studios/")[1]?.split("/")[0]?.split("?")[0];
      const match = allStudios.find((s) => s.slug === slug);
      if (match) return match.id;
    }
    return allStudios[0]?.id || "";
  }, [studio, pathname, allStudios]);

  const [selectedStudioId, setSelectedStudioId] = useState<string>(initialStudioId);

  // Sync studio if pathname changes or studios load
  useEffect(() => {
    if (initialStudioId && (!selectedStudioId || !allStudios.some((s) => s.id === selectedStudioId))) {
      setSelectedStudioId(initialStudioId);
    }
  }, [initialStudioId, selectedStudioId, allStudios]);

  const currentStudio = useMemo(() => {
    return allStudios.find((s) => s.id === selectedStudioId) || allStudios[0];
  }, [allStudios, selectedStudioId]);

  // Search and dropdown state
  const [serviceSearch, setServiceSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [clientOpen, setClientOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);

  const form = useForm<CreateBookingInput>({
    resolver: zodResolver(CreateBookingSchema),
    defaultValues: {
      sessionCount: 1,
      extraPicturesCount: 0,
      bookingStatus: "PENDING",
      paymentStatus: "PENDING",
      deliveryStatus: "PENDING",
      notes: "",
      addonIds: [],
      totalAmount: 0,
      paymentPlan: "FULL",
      bookingDate: defaultDate,
    },
  });

  // Listen to URL query params for ?action=add-booking&date=... (only when syncWithUrl is enabled)
  useEffect(() => {
    if (syncWithUrl && searchParams?.get("action") === "add-booking") {
      setOpen(true);
      const dateStr = searchParams.get("date");
      if (dateStr && !isNaN(new Date(dateStr).getTime())) {
        form.setValue("bookingDate", new Date(dateStr));
      }
    }
  }, [syncWithUrl, searchParams, form]);

  // Reset dependent selections when studio changes
  const handleStudioChange = (newStudioId: string) => {
    setSelectedStudioId(newStudioId);
    setIsPriceOverridden(false);
    form.setValue("clientId", "");
    form.setValue("serviceId", "");
    form.setValue("serviceVariantId", undefined);
    form.setValue("memberId", undefined);
    form.setValue("extraPicturesCount", 0);
    form.setValue("addonIds", []);
    setSelectedAddonIds([]);
    setServiceSearch("");
    setClientSearch("");
  };

  const allServices = useMemo(() => currentStudio?.services || [], [currentStudio]);
  const mainServices = useMemo(() => allServices.filter((s) => !s.isAddon), [allServices]);
  const addonServices = useMemo(() => allServices.filter((s) => s.isAddon), [allServices]);

  // Category counts for quick tabs
  const photoCount = useMemo(
    () => mainServices.filter((s) => (s.category || "").toUpperCase() === "PHOTOGRAPHY").length,
    [mainServices]
  );
  const videoCount = useMemo(
    () => mainServices.filter((s) => (s.category || "").toUpperCase() === "VIDEOGRAPHY").length,
    [mainServices]
  );
  const othersCount = useMemo(
    () =>
      mainServices.filter(
        (s) => !["PHOTOGRAPHY", "VIDEOGRAPHY"].includes((s.category || "").toUpperCase())
      ).length,
    [mainServices]
  );

  // Filtered & sorted services
  const filteredMainServices = useMemo(() => {
    let list = mainServices;

    if (selectedCategory !== "ALL") {
      list = list.filter((s) => (s.category || "").toUpperCase() === selectedCategory);
    }

    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.category || "").toLowerCase().includes(q)
      );
    }

    // Always sort PHOTOGRAPHY services first, then VIDEOGRAPHY, then OTHERS, then by name
    return [...list].sort((a, b) => {
      const order: Record<string, number> = { PHOTOGRAPHY: 1, VIDEOGRAPHY: 2, OTHERS: 3 };
      const aCat = order[(a.category || "").toUpperCase()] || 4;
      const bCat = order[(b.category || "").toUpperCase()] || 4;
      if (aCat !== bCat) return aCat - bCat;
      return a.name.localeCompare(b.name);
    });
  }, [mainServices, selectedCategory, serviceSearch]);

  // Flatten addons into variants
  const flattenedAddons = useMemo(() => {
    return addonServices.flatMap((addon) => {
      const variants = addon.serviceVariants || addon.variants || [];
      return variants.map((variant) => ({
        compositeId: `${addon.id}:${variant.id}`,
        addon,
        variant: {
          ...variant,
          deliverables: variant.serviceDeliverables || variant.deliverables || [],
        },
      }));
    });
  }, [addonServices]);

  const filteredAddonVariants = useMemo(() => {
    if (!serviceSearch.trim()) return flattenedAddons;
    const q = serviceSearch.toLowerCase();
    return flattenedAddons.filter(
      (a) =>
        a.addon.name.toLowerCase().includes(q) ||
        a.variant.locationType.toLowerCase().includes(q) ||
        (a.addon.category || "").toLowerCase().includes(q)
    );
  }, [flattenedAddons, serviceSearch]);

  // Filter clients
  const filteredClients = useMemo(() => {
    const clients = currentStudio?.clients || [];
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }, [currentStudio, clientSearch]);

  // Form reactive values
  const watchedServiceId = useWatch({ control: form.control, name: "serviceId" });
  const watchedServiceVariantId = useWatch({ control: form.control, name: "serviceVariantId" });
  const watchedSessionCount = useWatch({ control: form.control, name: "sessionCount" }) ?? 1;
  const watchedClientId = useWatch({ control: form.control, name: "clientId" });
  const watchedPaymentPlan = useWatch({ control: form.control, name: "paymentPlan" }) ?? "FULL";
  const watchedTotalAmount = useWatch({ control: form.control, name: "totalAmount" });
  const [isPriceOverridden, setIsPriceOverridden] = useState(false);

  const selectedService = useMemo(
    () => allServices.find((s) => s.id === watchedServiceId),
    [allServices, watchedServiceId]
  );

  const selectedVariant = useMemo(() => {
    const variants = selectedService?.serviceVariants || selectedService?.variants || [];
    const v = variants.find((item) => item.id === watchedServiceVariantId);
    return v
      ? { ...v, deliverables: v.serviceDeliverables || v.deliverables || [] }
      : undefined;
  }, [selectedService, watchedServiceVariantId]);

  const selectedClient = useMemo(
    () => currentStudio?.clients.find((c) => c.id === watchedClientId),
    [currentStudio, watchedClientId]
  );

  const selectedAddonVariants = useMemo(
    () => flattenedAddons.filter((a) => selectedAddonIds.includes(a.compositeId)),
    [flattenedAddons, selectedAddonIds]
  );

  const servicePrice = selectedVariant?.basePrice ? Number(selectedVariant.basePrice) : 0;
  const sessionTotal = servicePrice * (watchedSessionCount || 1);
  const addonsTotal = selectedAddonVariants.reduce(
    (sum, a) => sum + Number(a.variant.basePrice || 0),
    0
  );
  const grandTotal = sessionTotal + addonsTotal;

  useEffect(() => {
    if (!isPriceOverridden) {
      form.setValue("totalAmount", grandTotal);
    }
  }, [grandTotal, isPriceOverridden, form]);

  function toggleAddon(compositeId: string) {
    setSelectedAddonIds((prev) => {
      const baseAddonId = compositeId.split(":")[0];
      const filtered = prev.filter((id) => id.split(":")[0] !== baseAddonId);

      if (prev.includes(compositeId)) {
        form.setValue("addonIds", filtered);
        return filtered;
      }

      const next = [...filtered, compositeId];
      form.setValue("addonIds", next);
      return next;
    });
  }

  function handleReset() {
    form.reset();
    setIsPriceOverridden(false);
    setSelectedAddonIds([]);
    setServiceSearch("");
    setClientSearch("");
    setSelectedCategory("ALL");
    setClientOpen(false);
    setServiceOpen(false);
  }

  function onSubmit(data: CreateBookingInput) {
    if (!currentStudio?.id) {
      toast.error("Please select a studio.");
      return;
    }

    startTransition(async () => {
      const { data: result, error } = await tryCatch(
        createBooking(data, currentStudio.id)
      );

      if (error) {
        toast.error("Failed to create booking. Please try again.");
        return;
      }

      if (result?.status === "success") {
        toast.success("Booking successfully added!");
        handleReset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result?.message || "Failed to add booking.");
      }
    });
  }

  const categoryBadgeClass = (category?: string) => {
    const cat = (category || "").toUpperCase();
    if (cat === "PHOTOGRAPHY") {
      return "border-blue-500/30 text-blue-600 bg-blue-500/10 dark:text-blue-400";
    }
    if (cat === "VIDEOGRAPHY") {
      return "border-purple-500/30 text-purple-600 bg-purple-500/10 dark:text-purple-400";
    }
    return "border-muted-foreground/30 text-muted-foreground bg-muted";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) handleReset();
      }}
    >
      {trigger !== null && (trigger || !isControlled) && (
        <DialogTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <Button size={buttonSize} variant={buttonVariant} className={className}>
              <CalendarPlusIcon className="mr-1.5 h-4 w-4" />
              <span>Add Booking</span>
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92dvh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CalendarPlusIcon className="h-5 w-5 text-primary" />
            Add Booking
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Schedule a new session by selecting the studio, client, service, and team member.
          </DialogDescription>
        </DialogHeader>

        {loadingStudios && allStudios.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 gap-3 min-h-75">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading studios...</p>
          </div>
        ) : allStudios.length === 0 && !studio ? (
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 gap-3 min-h-75 text-center">
            <p className="text-sm text-muted-foreground">No eligible studios available for booking.</p>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-y-auto px-4 sm:px-6 py-2 gap-4"
          >
          {/* Studio Selector (when user has multiple studios) */}
          {allStudios.length > 1 && (
            <Field>
              <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2Icon className="h-3.5 w-3.5" />
                Select Studio
              </FieldLabel>
              <Select value={selectedStudioId} onValueChange={handleStudioChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select studio..." />
                </SelectTrigger>
                <SelectContent>
                  {allStudios.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="cursor-pointer">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Client Selection with Search & Add Client Modal */}
          <Controller
            name="clientId"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Client *
                </FieldLabel>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setClientOpen(!clientOpen)}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span className={selectedClient ? "font-medium" : "text-muted-foreground"}>
                      {selectedClient ? selectedClient.name : "Choose a client..."}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </button>

                  {clientOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Search clients by name or phone..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto p-1">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => {
                                field.onChange(c.id);
                                setClientOpen(false);
                                setClientSearch("");
                              }}
                              className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm rounded-md transition-colors hover:bg-accent ${
                                field.value === c.id ? "bg-accent font-medium" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={c.image || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {c.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">{c.name}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {c.phone}
                                  </span>
                                </div>
                              </div>
                              {c.type && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] capitalize font-normal"
                                >
                                  {c.type}
                                </Badge>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 px-2">
                            <p className="text-xs text-muted-foreground mb-2">No clients found</p>
                            {currentStudio?.id && (
                              <AddClient
                                studioId={currentStudio.id}
                                onSuccess={(newClientId) => {
                                  form.setValue("clientId", newClientId);
                                  setClientOpen(false);
                                  setClientSearch("");
                                  router.refresh();
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {form.formState.errors.clientId && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.clientId.message}
                  </p>
                )}
              </Field>
            )}
          />

          {/* Service Selection with Category Tabs & Badges */}
          <Controller
            name="serviceId"
            control={form.control}
            render={({ field }) => (
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Service *
                  </FieldLabel>
                  {selectedService && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-semibold px-2 py-0.5 ${categoryBadgeClass(
                        selectedService.category
                      )}`}
                    >
                      {selectedService.category}
                    </Badge>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setServiceOpen(!serviceOpen)}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span className={selectedService ? "font-medium" : "text-muted-foreground"}>
                      {selectedService ? (
                        <span className="flex items-center gap-2">
                          <span>{selectedService.name}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            (₦
                            {Number(
                              selectedService.serviceVariants?.[0]?.basePrice ||
                                selectedService.variants?.[0]?.basePrice ||
                                0
                            ).toLocaleString()}
                            )
                          </span>
                        </span>
                      ) : (
                        "Choose a service..."
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </button>

                  {serviceOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-xl">
                      {/* Search bar */}
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Search services..."
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                      </div>

                      {/* Category Filter Pills */}
                      <div className="flex items-center gap-1 p-1.5 border-b bg-muted/30 overflow-x-auto text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedCategory("ALL")}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                            selectedCategory === "ALL"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          <LayersIcon className="h-3 w-3" />
                          <span>All ({mainServices.length})</span>
                        </button>
                        {photoCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedCategory("PHOTOGRAPHY")}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                              selectedCategory === "PHOTOGRAPHY"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "hover:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            <CameraIcon className="h-3 w-3" />
                            <span>Photography ({photoCount})</span>
                          </button>
                        )}
                        {videoCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedCategory("VIDEOGRAPHY")}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                              selectedCategory === "VIDEOGRAPHY"
                                ? "bg-purple-600 text-white shadow-xs"
                                : "hover:bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            }`}
                          >
                            <VideoIcon className="h-3 w-3" />
                            <span>Videography ({videoCount})</span>
                          </button>
                        )}
                        {othersCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedCategory("OTHERS")}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              selectedCategory === "OTHERS"
                                ? "bg-foreground text-background shadow-xs"
                                : "hover:bg-muted text-muted-foreground"
                            }`}
                          >
                            <span>Others ({othersCount})</span>
                          </button>
                        )}
                      </div>

                      {/* Services list with clear badges and category separation */}
                      <div className="max-h-64 overflow-y-auto p-1 divide-y divide-border/40">
                        {filteredMainServices.length > 0 ? (
                          filteredMainServices.map((s) => {
                            const firstVariant =
                              s.serviceVariants?.[0] || s.variants?.[0];
                            const basePrice = Number(firstVariant?.basePrice ?? 0);

                            return (
                              <div
                                key={s.id}
                                onClick={() => {
                                  field.onChange(s.id);
                                  form.setValue("serviceVariantId", undefined);
                                  setIsPriceOverridden(false);
                                  setServiceOpen(false);
                                  setServiceSearch("");
                                }}
                                className={`flex items-center justify-between px-3 py-2.5 cursor-pointer text-sm rounded-md transition-colors hover:bg-accent ${
                                  field.value === s.id ? "bg-accent font-medium" : ""
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate">{s.name}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] uppercase font-semibold px-1.5 py-0 ${categoryBadgeClass(
                                      s.category
                                    )}`}
                                  >
                                    {s.category}
                                  </Badge>
                                </div>
                                <span className="text-muted-foreground font-mono text-xs shrink-0 ml-2">
                                  ₦{basePrice.toLocaleString()}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-5">
                            No services found in this category
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {form.formState.errors.serviceId && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.serviceId.message}
                  </p>
                )}
              </Field>
            )}
          />

          {/* Variant Selection (Location Type) */}
          {selectedService && (selectedService.serviceVariants?.length || selectedService.variants?.length) ? (
            <Controller
              name="serviceVariantId"
              control={form.control}
              render={({ field }) => {
                const variants =
                  selectedService.serviceVariants || selectedService.variants || [];
                return (
                  <Field>
                    <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Select Variant (Location Type) *
                    </FieldLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setIsPriceOverridden(false);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choose location type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {variants.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="cursor-pointer">
                            {v.locationType} — ₦{Number(v.basePrice).toLocaleString()}
                            {v.maxPrice && ` to ₦${Number(v.maxPrice).toLocaleString()}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                );
              }}
            />
          ) : null}

          {/* Logistics Warning */}
          {selectedVariant &&
            !selectedVariant.logisticsIncluded &&
            selectedVariant.locationType === "OUTDOOR" && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md text-xs">
                <p className="font-semibold mb-0.5">Logistics Not Included</p>
                <p>
                  This outdoor variant does not cover transportation logistics. The client must handle or pay separately.
                </p>
              </div>
            )}

          {/* Included Deliverables Summary */}
          {selectedVariant && selectedVariant.deliverables && selectedVariant.deliverables.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Included Deliverables
              </p>
              <ul className="text-xs space-y-1">
                {selectedVariant.deliverables.map((d, idx) => (
                  <li key={d.id || idx} className="flex items-center gap-1.5 text-foreground/80">
                    <span className="text-primary">•</span>
                    <span>
                      {d.quantity ? `${d.quantity} ` : ""}
                      {d.label}
                      {d.detail && (
                        <span className="text-muted-foreground text-[11px] ml-1">
                          ({d.detail})
                        </span>
                      )}
                      {d.isFree && (
                        <Badge variant="secondary" className="text-[9px] ml-1.5 font-normal">
                          Free
                        </Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Add-on Selection */}
          {flattenedAddons.length > 0 && (
            <Field>
              <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Add-ons <span className="font-normal lowercase">(optional)</span>
              </FieldLabel>
              <div className="border rounded-lg max-h-48 overflow-y-auto divide-y divide-border/50">
                {filteredAddonVariants.length > 0 ? (
                  filteredAddonVariants.map((item) => (
                    <label
                      key={item.compositeId}
                      className="flex items-start justify-between px-3 py-2.5 cursor-pointer text-xs transition-colors hover:bg-accent"
                    >
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          className="mt-0.5"
                          checked={selectedAddonIds.includes(item.compositeId)}
                          onCheckedChange={() => toggleAddon(item.compositeId)}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium flex items-center gap-1.5">
                            {item.addon.name}
                            <span className="text-muted-foreground text-[10px]">
                              ({item.variant.locationType})
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase px-1 py-0 ${categoryBadgeClass(
                                item.addon.category
                              )}`}
                            >
                              {item.addon.category}
                            </Badge>
                          </span>
                          {item.variant.deliverables && item.variant.deliverables.length > 0 && (
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {item.variant.deliverables
                                .map((d) => `${d.quantity ? d.quantity + " " : ""}${d.label}`)
                                .join(" • ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-muted-foreground font-mono text-xs whitespace-nowrap ml-3">
                        ₦{Number(item.variant.basePrice).toLocaleString()}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No add-ons match search
                  </p>
                )}
              </div>
            </Field>
          )}

          {/* Assigned Team Member */}
          {currentStudio?.members && currentStudio.members.length > 0 && (
            <Controller
              name="memberId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assign Team Member
                  </FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Assign team member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {currentStudio.members.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="cursor-pointer">
                          {m.user.name} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          )}

          {/* Date & Time Slot Picker */}
          <Controller
            name="bookingDate"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Booking Date & Time *
                </FieldLabel>
                <DateTimeSlotPicker
                  selectedDate={field.value || null}
                  onDateChange={field.onChange}
                  proposedDuration={
                    (selectedService?.studioSession?.duration || 45) *
                    (watchedSessionCount || 1)
                  }
                  bookings={
                    currentStudio?.bookings?.map((b) => ({
                      bookingDate: b.bookingDate,
                      sessionCount: b.sessionCount,
                      service: b.service?.studioSession
                        ? { studioSession: { duration: b.service.studioSession.duration ?? undefined } }
                        : undefined,
                    })) || []
                  }
                />
                {form.formState.errors.bookingDate && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.bookingDate.message}
                  </p>
                )}
              </Field>
            )}
          />

          {/* Session Count & Extra Pictures Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Controller
              name="sessionCount"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Session Count
                  </FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </Field>
              )}
            />

            <Controller
              name="extraPicturesCount"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Extra Pictures
                  </FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    className="h-9 text-xs"
                    placeholder="0"
                  />
                </Field>
              )}
            />
          </div>

          {/* Booking & Payment Statuses (for admin tracking) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="bookingStatus"
              render={({ field }) => (
                <Field>
                  <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Booking Status
                  </FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
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
                <Field>
                  <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Payment Status
                  </FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>

          {/* Payment Plan & Financials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="paymentPlan"
              render={({ field }) => (
                <Field>
                  <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Payment Plan
                  </FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL">Full Payment (100%)</SelectItem>
                      <SelectItem value="HALF">Half Payment (50%)</SelectItem>
                      <SelectItem value="QUARTER">Quarter Payment (25%)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Price (₦) *
                    </FieldLabel>
                    {isPriceOverridden && watchedTotalAmount !== grandTotal && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPriceOverridden(false);
                          form.setValue("totalAmount", grandTotal);
                        }}
                        className="text-[10px] text-primary hover:underline cursor-pointer"
                      >
                        Reset to ₦{grandTotal.toLocaleString()}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono font-semibold">
                      ₦
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={field.value ?? 0}
                      onChange={(e) => {
                        setIsPriceOverridden(true);
                        field.onChange(Number(e.target.value));
                      }}
                      className="h-9 pl-7 font-mono font-semibold text-xs"
                      placeholder="0"
                    />
                  </div>
                  {isPriceOverridden && watchedTotalAmount !== grandTotal && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">
                      Custom price applied (Calculated: ₦{grandTotal.toLocaleString()})
                    </span>
                  )}
                  {form.formState.errors.totalAmount && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.totalAmount.message}
                    </p>
                  )}
                </Field>
              )}
            />

            <div className="sm:col-span-2 bg-primary/5 border border-primary/20 p-2.5 rounded-md flex justify-between items-center text-xs">
              <span className="font-medium text-foreground">
                Amount Due Now ({watchedPaymentPlan}):
              </span>
              <span className="font-bold text-base font-mono text-primary">
                ₦
                {(
                  ((watchedTotalAmount ?? grandTotal) || 0) *
                  (watchedPaymentPlan === "FULL"
                    ? 1
                    : watchedPaymentPlan === "HALF"
                    ? 0.5
                    : 0.25)
                ).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Notes */}
          <Controller
            name="notes"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes <span className="font-normal lowercase">(optional)</span>
                </FieldLabel>
                <Textarea
                  {...field}
                  value={field.value || ""}
                  placeholder="Special instructions or client requests..."
                  className="resize-none text-xs"
                  rows={2}
                />
              </Field>
            )}
          />

          {/* Price Summary */}
          {selectedService && (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 text-xs">
              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Price Summary
              </p>
              <Separator />
              <div className="flex justify-between">
                <span>
                  {selectedService.name} × {watchedSessionCount || 1} session
                  {(watchedSessionCount || 1) > 1 ? "s" : ""}
                </span>
                <span className="font-mono">₦{sessionTotal.toLocaleString()}</span>
              </div>
              {selectedAddonVariants.map((item) => (
                <div
                  key={item.compositeId}
                  className="flex justify-between text-muted-foreground"
                >
                  <span>
                    + {item.addon.name}{" "}
                    <span className="text-[10px]">({item.variant.locationType})</span>
                  </span>
                  <span className="font-mono">
                    ₦{Number(item.variant.basePrice).toLocaleString()}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold text-sm">
                <span>Total Amount</span>
                <span className="font-mono text-primary">₦{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 pb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                handleReset();
                setOpen(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="gap-1.5 shadow-sm">
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Adding Booking...</span>
                </>
              ) : (
                <>
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span>Create Booking</span>
                </>
              )}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
