"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, CheckCircle2, Calendar, User, CreditCard, Loader2, Building2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { publicBookingSchema, type PublicBookingInput } from "@/lib/schemas/booking.schema";
import { getStudioBySlug, getStudios, createPublicBooking } from "@/lib/api";
import type { PublicStudioOutput, PublicServiceOutput } from "@/lib/types/studio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const steps = [
  { id: 1, title: "Studio", icon: Building2, description: "Choose location" },
  { id: 2, title: "Service", icon: Calendar, description: "Select service & date" },
  { id: 3, title: "Client", icon: User, description: "Your details" },
  { id: 4, title: "Payment", icon: CreditCard, description: "Confirm & pay" },
];

export default function BookingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
  const [studiosList, setStudiosList] = useState<{ id: string; name: string; slug: string; logo?: string | null; metadata?: Record<string, unknown> | null }[]>([]);
  const [studio, setStudio] = useState<PublicStudioOutput | null>(null);
  const [services, setServices] = useState<PublicServiceOutput[]>([]);
  const [isLoadingStudios, setIsLoadingStudios] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<PublicBookingInput>({
    resolver: zodResolver(publicBookingSchema),
    defaultValues: {
      useExisting: false,
      sessionCount: 1,
      selectedAddonIds: [],
      paymentPlan: "FULL",
    },
  });

  const selectedStudioId = watch("studioId");
  const selectedStudioSlug = studiosList.find(s => s.id === selectedStudioId)?.slug;
  const selectedServiceId = watch("selectedServiceId");
  const selectedVariantId = watch("selectedVariantId");
  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedVariant = selectedService?.variants?.find(v => v.id === selectedVariantId);
  const selectedAddonIds = watch("selectedAddonIds") || [];

  const generateTimeSlots = (durationInMinutes: number = 60) => {
    const slots = [];
    let currentMin = 9 * 60; // 09:00 am start
    const endMin = 18 * 60; // 06:00 pm end
    
    while (currentMin + durationInMinutes <= endMin) {
      const h = Math.floor(currentMin / 60).toString().padStart(2, '0');
      const m = (currentMin % 60).toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
      currentMin += durationInMinutes;
    }
    return slots;
  };

  // ✅ Updated to use sessionDurationMins from the selected variant or default
  const timeSlots = (selectedVariant) 
    ? generateTimeSlots(selectedVariant.sessionDurationMins) 
    : (selectedService && selectedService.variants.length > 0) 
        ? generateTimeSlots(selectedService.variants[0].sessionDurationMins) 
        : [];

  const isTomorrow = selectedDate === new Date(Date.now() + 86400000).toISOString().split("T")[0];
  
  let maxAvailableSessions = 1;
  if (selectedTime && timeSlots.length > 0) {
      const startIndex = timeSlots.indexOf(selectedTime);
      let continuousAvailable = 0;
      for (let i = startIndex; i < timeSlots.length; i++) {
          const time = timeSlots[i];
          const isBooked = isTomorrow && timeSlots.indexOf(time) < 3;
          if (isBooked) break;
          continuousAvailable++;
      }
      maxAvailableSessions = continuousAvailable > 0 ? continuousAvailable : 1;
  }

  useEffect(() => {
    if (selectedDate && selectedTime) {
      setValue("bookingDate", `${selectedDate}T${selectedTime}`, { shouldValidate: true });
    } else {
      setValue("bookingDate", "");
    }
  }, [selectedDate, selectedTime, setValue]);

  useEffect(() => {
    const currentSessions = watch("sessionCount");
    if (currentSessions > maxAvailableSessions) {
      setValue("sessionCount", maxAvailableSessions, { shouldValidate: true });
    }
  }, [maxAvailableSessions, watch, setValue]);

  useEffect(() => {
    getStudios()
      .then((res) => {
        setStudiosList(res.items);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load studios.");
      })
      .finally(() => setIsLoadingStudios(false));
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
      );
    }
  }, []);

  const fetchStudioServices = async (slug: string) => {
    setIsLoadingServices(true);
    try {
      const data = await getStudioBySlug(slug);
      setStudio(data);
      const allServices = data.categories.flatMap(c => c.services);
      setServices(allServices);
      setValue("selectedServiceId", "");
      setValue("selectedAddonIds", []);
      setSelectedDate("");
      setSelectedTime("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load studio services.");
    } finally {
      setIsLoadingServices(false);
    }
  };

  const navigateStep = async (direction: "next" | "prev") => {
    if (direction === "next") {
      let isValid = false;
      if (currentStep === 1) {
        isValid = await trigger(["studioId"]);
        if (isValid && selectedStudioSlug) {
           await fetchStudioServices(selectedStudioSlug);
        }
      } else if (currentStep === 2) {
        if (!selectedDate || !selectedTime) {
          toast.error("Please select both a date and a time.");
          return;
        }
        isValid = await trigger(["selectedServiceId", "bookingDate", "selectedAddonIds"]);
      } else if (currentStep === 3) {
        isValid = await trigger(["clientName", "clientEmail", "clientPhone"]);
      }
      
      if (!isValid) return;
    }

    const newStep = direction === "next" ? currentStep + 1 : currentStep - 1;
    if (newStep >= 1 && newStep <= 4) {
      gsap.to(formRef.current, {
        opacity: 0,
        x: direction === "next" ? -20 : 20,
        duration: 0.3,
        onComplete: () => {
          setCurrentStep(newStep);
          gsap.fromTo(
            formRef.current,
            { opacity: 0, x: direction === "next" ? 20 : -20 },
            { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }
          );
        },
      });
    }
  };

  const onSubmit = async (data: PublicBookingInput) => {
      setIsSubmitting(true);
      try {
          const result = await createPublicBooking(data);
          if (result.paymentUrl) {
              window.location.href = result.paymentUrl;
          } else {
            toast.warning(result.warning ?? "Booking created. Payment link will be sent manually.");
            router.push(`/book/confirm?reference=${result.reference}`);
          }
      } catch (err) {
          console.error(err);
          toast.error("Failed to create booking.");
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isLoadingStudios) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Select Studio</Label>
              {studiosList.length === 0 ? (
                 <p className="text-muted-foreground">No studios available at the moment.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {studiosList.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setValue("studioId", s.id, { shouldValidate: true })}
                      className={cn(
                        "p-5 rounded-xl border border-border/50 cursor-pointer transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 flex items-center justify-between",
                        selectedStudioId === s.id ? "border-primary bg-primary/10 ring-1 ring-primary" : "bg-card"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        {s.logo ? (
                          <div className="w-12 h-12 rounded-full overflow-hidden border shadow-sm shrink-0 relative">
                            <Image
                                src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ""}/${s.logo}`}
                                alt={s.name}
                                fill
                                className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Building2 className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg break-words whitespace-normal">{s.name}</h4>
                          <p className="text-sm text-muted-foreground break-words whitespace-normal">{(s.metadata?.description as string) || "Select this location"}</p>
                          {(() => {
                            const location = [s.metadata?.address, s.metadata?.city, s.metadata?.state].filter(Boolean).join(", ");
                            return location ? <p className="text-xs text-muted-foreground/80 mt-1 break-words whitespace-normal">{location}</p> : null;
                          })()}
                        </div>
                      </div>
                      {selectedStudioId === s.id && <CheckCircle2 className="text-primary w-6 h-6" />}
                    </div>
                  ))}
                </div>
              )}
              {errors.studioId && <p className="text-destructive text-sm mt-1">{errors.studioId.message}</p>}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            {isLoadingServices ? (
               <div className="flex flex-col items-center justify-center py-12 gap-4">
                 <Loader2 className="w-8 h-8 animate-spin text-primary" />
                 <p className="text-muted-foreground">Loading services for {studio?.name}...</p>
               </div>
            ) : (
              <>
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Select Service</Label>
                  {services.length === 0 ? (
                    <p className="text-muted-foreground">No services available for this studio.</p>
                  ) : (
                    <div className="space-y-4">
                      <Select 
                        onValueChange={(val) => {
                          const [sId, vId] = val.split(":");
                          setValue("selectedServiceId", sId, { shouldValidate: true });
                          setValue("selectedVariantId", vId, { shouldValidate: true });
                        }} 
                        value={selectedServiceId && selectedVariantId ? `${selectedServiceId}:${selectedVariantId}` : ""}
                      >
                        <SelectTrigger className="h-14 rounded-xl text-base bg-card border-input focus:ring-primary focus:ring-offset-1">
                          <SelectValue placeholder="Select a service..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {studio?.categories.map(category => (
                            <SelectGroup key={category.id} className="pb-2">
                              <SelectLabel className="text-primary font-bold text-xs uppercase tracking-wider pl-6 mt-2">{category.name}</SelectLabel>
                              {category.services.flatMap(service => 
                                service.variants.map((variant: { id: string; locationType: string; basePrice?: string | number | null }) => (
                                  <SelectItem key={variant.id} value={`${service.id}:${variant.id}`} className="pl-6 py-2.5 cursor-pointer">
                                    {service.name} ({variant.locationType}) - ₦{Number(variant.basePrice || 0).toLocaleString()}
                                  </SelectItem>
                                ))
                              )}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {selectedService && (
                        <div className="p-6 rounded-xl border border-border/50 bg-primary/5 animate-in fade-in slide-in-from-top-2">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-semibold text-xl">{selectedService.name} {selectedVariant ? `(${selectedVariant.locationType})` : ""}</h4>
                            {/* ✅ Updated to use selected variant price */}
                            <span className="text-xl font-bold text-primary">₦{Number(selectedVariant?.basePrice || selectedService.variants[0]?.basePrice || 0).toLocaleString()}</span>
                          </div>
                          {selectedService.description && (
                            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{selectedService.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 bg-card w-max px-3 py-1.5 rounded-full border border-border/50">
                            <Clock className="w-4 h-4 text-primary" />
                            <span className="font-medium">{selectedVariant?.sessionDurationMins || selectedService.variants[0]?.sessionDurationMins || 0} minutes</span>
                          </div>
                          {selectedService.features && selectedService.features.length > 0 && (
                            <div className="space-y-3 mb-6">
                              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Included Features</h5>
                              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground/90">
                                {selectedService.features.map((feature, idx) => (
                                  <li key={idx} className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <span>{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {selectedVariant?.deliverables && selectedVariant.deliverables.length > 0 && (
                            <div className="space-y-3">
                              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Included Deliverables</h5>
                              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground/90">
                                {selectedVariant.deliverables.map((del: any, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <span>{del.quantity ? `${del.quantity} ` : ""}{del.label} {del.detail ? `(${del.detail})` : ""} {del.isFree ? "(Free)" : ""}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {errors.selectedServiceId && <p className="text-destructive text-sm mt-1">{errors.selectedServiceId.message}</p>}
                </div>
                
                {studio?.addons && studio.addons.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Enhance Your Session (Optional)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {studio.addons.flatMap(addon => 
                        addon.variants.map((variant: { id: string; locationType: string; basePrice?: string | number | null; deliverables?: { quantity?: number | null; label?: string; detail?: string | null; isFree?: boolean }[] }) => {
                          const compositeId = `${addon.id}:${variant.id}`;
                          const isSelected = selectedAddonIds.includes(compositeId);
                          const isExpanded = expandedItems[compositeId];
                          return (
                            <div
                              key={compositeId}
                              onClick={() => {
                                if (isSelected) {
                                  setValue("selectedAddonIds", selectedAddonIds.filter(id => id !== compositeId));
                                } else {
                                  const filtered = selectedAddonIds.filter(id => !id.startsWith(addon.id + ":"));
                                  setValue("selectedAddonIds", [...filtered, compositeId]);
                                }
                              }}
                              className={cn(
                                "p-4 rounded-xl border border-border/50 cursor-pointer transition-all duration-300 hover:border-primary/50 hover:bg-primary/5",
                                isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "bg-card"
                              )}
                            >
                              <div className="flex flex-col h-full">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="font-medium block">{addon.name} ({variant.locationType})</span>
                                    {/* ✅ Updated to use specific variant price */}
                                    <span className="text-sm font-semibold text-primary">+₦{Number(variant.basePrice || 0).toLocaleString()}</span>
                                  </div>
                                  {isSelected && <CheckCircle2 className="text-primary w-5 h-5 flex-shrink-0" />}
                                </div>
                                
                                {(addon.description || (addon.features && addon.features.length > 0) || (variant.deliverables && variant.deliverables.length > 0)) && (
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedItems(prev => ({ ...prev, [compositeId]: !prev[compositeId] }));
                                    }}
                                    className="text-[11px] font-medium text-primary hover:underline self-start mt-1"
                                  >
                                    {isExpanded ? "Hide details" : "View details"}
                                  </button>
                                )}

                                {isExpanded && (
                                  <div className="mt-3 pt-3 border-t border-border/30 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {addon.description && (
                                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{addon.description}</p>
                                    )}
                                    {addon.features && addon.features.length > 0 && (
                                      <ul className="text-xs space-y-2 text-muted-foreground/90 mb-3">
                                        {addon.features.map((feature, idx) => (
                                          <li key={idx} className="flex items-start gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1 shrink-0" />
                                            <span>{feature}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    {variant.deliverables && variant.deliverables.length > 0 && (
                                      <div className="space-y-2 border-t border-border/30 pt-3">
                                        <h6 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Deliverables</h6>
                                        <ul className="text-xs space-y-2 text-muted-foreground/90">
                                          {variant.deliverables.map((del: any, idx: number) => (
                                            <li key={idx} className="flex items-start gap-1.5">
                                              <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1 shrink-0" />
                                              <span>{del.quantity ? `${del.quantity} ` : ""}{del.label} {del.detail ? `(${del.detail})` : ""} {del.isFree ? "(Free)" : ""}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                  <div className="space-y-2 flex flex-col">
                    <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Select Date</Label>
                    <Input
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedTime(""); 
                      }}
                      className="rounded-xl bg-card/50"
                    />
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Available Times</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedDate ? (
                        timeSlots.map((time) => {
                           const isTomorrow = selectedDate === new Date(Date.now() + 86400000).toISOString().split("T")[0];
                           const isBooked = isTomorrow && timeSlots.indexOf(time) < 3;
                           
                           return (
                            <button
                              key={time}
                              type="button"
                              disabled={isBooked}
                              onClick={() => setSelectedTime(time)}
                              className={cn(
                                "py-2 px-3 text-sm rounded-lg border transition-all",
                                isBooked ? "bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed border-transparent" : 
                                selectedTime === time ? "bg-primary text-primary-foreground border-primary shadow-md" : 
                                "bg-card hover:border-primary/50 border-border"
                              )}
                            >
                              {time}
                            </button>
                           );
                        })
                      ) : (
                        <div className="col-span-3 text-sm text-muted-foreground py-2">Please select a date first</div>
                      )}
                    </div>
                    {errors.bookingDate && <p className="text-destructive text-sm mt-2">{errors.bookingDate.message}</p>}
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <div className="space-y-2 flex flex-col max-w-xs">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Number of Sessions</Label>
                      {selectedTime && <span className="text-xs text-primary font-medium">Max: {maxAvailableSessions}</span>}
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={maxAvailableSessions}
                      disabled={!selectedTime}
                      {...register("sessionCount", { valueAsNumber: true })}
                      className="rounded-xl bg-card/50"
                    />
                    {!selectedTime && <p className="text-xs text-muted-foreground">Select a time first to choose sessions.</p>}
                    {errors.sessionCount && <p className="text-destructive text-sm mt-2">{errors.sessionCount.message}</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  {...register("clientName")}
                  className="rounded-xl bg-card/50"
                />
                {errors.clientName && <p className="text-destructive text-sm">{errors.clientName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  {...register("clientEmail")}
                  className="rounded-xl bg-card/50"
                />
                {errors.clientEmail && <p className="text-destructive text-sm">{errors.clientEmail.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Phone Number</Label>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                {...register("clientPhone")}
                className="rounded-xl bg-card/50"
              />
              {errors.clientPhone && <p className="text-destructive text-sm">{errors.clientPhone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Additional Notes (Optional)</Label>
              <Textarea
                placeholder="Tell us about your vision..."
                rows={4}
                {...register("notes")}
                className="rounded-xl bg-card/50 resize-none"
              />
              {errors.notes && <p className="text-destructive text-sm">{errors.notes.message}</p>}
            </div>
          </div>
        );
      case 4: {
        const sessionCount = watch("sessionCount") || 1;
        const servicePrice = Number(selectedVariant?.basePrice || selectedService?.variants[0]?.basePrice || 0);
        const serviceTotal = servicePrice * sessionCount;
        const addonsTotal = selectedAddonIds.length > 0 && studio?.addons
          ? selectedAddonIds.reduce((sum, compositeId) => {
              const [addonId, variantId] = compositeId.split(":");
              const addon = studio.addons.find(a => a.id === addonId);
              const variant = variantId
                ? addon?.variants?.find((v: { id: string; basePrice?: string | number | null }) => v.id === variantId)
                : addon?.variants?.[0];
              return sum + Number(variant?.basePrice || 0);
            }, 0)
          : 0;
        const grandTotal = serviceTotal + addonsTotal;
        const currentPlan = watch("paymentPlan") || "FULL";
        const planMultiplier = currentPlan === "QUARTER" ? 0.25 : currentPlan === "HALF" ? 0.5 : 1;
        const chargeAmount = Math.round(grandTotal * planMultiplier * 100) / 100;

        const plans = [
          { value: "QUARTER" as const, label: "Quarter", percent: "25%", desc: "Secure your spot with a deposit" },
          { value: "HALF" as const, label: "Half", percent: "50%", desc: "Pay half now, rest later" },
          { value: "FULL" as const, label: "Full", percent: "100%", desc: "Complete payment upfront" },
        ];

        return (
          <div className="space-y-8">
            {/* Booking Summary */}
            <div className="bg-card/30 rounded-2xl p-6 border border-border/50 backdrop-blur-sm">
              <h3 className="text-xl font-heading font-bold mb-4 border-b border-border/50 pb-4">Booking Summary</h3>
              <div className="space-y-4 text-sm md:text-base">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium text-right">{selectedService?.name || "Not selected"} {selectedVariant ? `(${selectedVariant.locationType})` : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium text-right">
                    {watch("bookingDate") ? new Date(watch("bookingDate")).toLocaleString() : "TBD"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client Name</span>
                  <span className="font-medium text-right">{watch("clientName") || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Studio</span>
                  <span className="font-medium text-right">{studio?.name || selectedStudioSlug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sessions</span>
                  <span className="font-medium text-right">{sessionCount}</span>
                </div>
                {selectedAddonIds.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Add-ons</span>
                    <span className="font-medium text-right">{selectedAddonIds.length} selected</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-border/50">
                <span className="text-lg font-medium">Total</span>
                <span className="text-2xl font-bold text-primary">
                  ₦{grandTotal.toLocaleString("en-NG")}
                </span>
              </div>
            </div>

            {/* Payment Plan Selector */}
            <div className="space-y-4">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Choose Payment Plan</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const isActive = currentPlan === plan.value;
                  const planAmount = Math.round(grandTotal * (plan.value === "QUARTER" ? 0.25 : plan.value === "HALF" ? 0.5 : 1) * 100) / 100;
                  return (
                    <div
                      key={plan.value}
                      onClick={() => setValue("paymentPlan", plan.value, { shouldValidate: true })}
                      className={cn(
                        "relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 group",
                        isActive
                          ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 ring-1 ring-primary"
                          : "border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      {isActive && (
                        <div className="absolute top-3 right-3">
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="mb-3">
                        <span className={cn(
                          "inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider",
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {plan.percent}
                        </span>
                      </div>
                      <h4 className={cn(
                        "text-lg font-bold mb-1 transition-colors",
                        isActive ? "text-primary" : "text-foreground"
                      )}>
                        {plan.label}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{plan.desc}</p>
                      <p className={cn(
                        "text-xl font-bold",
                        isActive ? "text-primary" : "text-foreground"
                      )}>
                        ₦{planAmount.toLocaleString("en-NG")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Amount to Pay Now */}
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Amount to pay now</p>
                  <p className="text-3xl font-bold text-primary">₦{chargeAmount.toLocaleString("en-NG")}</p>
                </div>
                {currentPlan !== "FULL" && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Remaining balance</p>
                    <p className="text-lg font-semibold text-foreground">₦{(grandTotal - chargeAmount).toLocaleString("en-NG")}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20 text-center">
              <CreditCard className="w-8 h-8 text-primary mx-auto mb-3" />
              <h4 className="font-semibold mb-2">Secure Payment Gateway</h4>
              <p className="text-sm text-muted-foreground">You will be redirected to our secure payment provider to complete your booking.</p>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto" ref={containerRef}>
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <h1 className="text-4xl md:text-6xl font-heading font-bold uppercase tracking-wide">Book a Session</h1>
            <div className="w-2 h-2 rounded-full bg-primary"></div>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Reserve your spot at {studio?.name || "GMAX Studioz"}. Follow the steps below to customize your experience and secure your session.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-12 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border/50 -translate-y-1/2 z-0 hidden md:block"></div>
          <div className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 hidden md:block transition-all duration-500 ease-in-out" style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6 md:gap-0">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex flex-row md:flex-col items-center gap-4 md:gap-2">
                  <div 
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 border-2",
                      isActive ? "bg-background border-primary text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" : 
                      isCompleted ? "bg-primary border-primary text-primary-foreground" : 
                      "bg-background border-border text-muted-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left md:text-center">
                    <div className={cn(
                      "text-sm font-bold uppercase tracking-wider transition-colors",
                      isActive ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground hidden md:block">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Area */}
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 md:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle gradient background */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <div ref={formRef} className="min-h-[400px]">
              {renderStepContent()}
            </div>

            <div className="mt-12 pt-6 border-t border-border/50 flex justify-between items-center">
              <button
                type="button"
                onClick={() => navigateStep("prev")}
                disabled={currentStep === 1 || isSubmitting}
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all",
                  currentStep === 1 ? "opacity-0 pointer-events-none" : "hover:bg-secondary/50 text-foreground"
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => navigateStep("next")}
                  className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "rounded-full px-8 gap-2 group shadow-lg shadow-primary/20"
                  )}
                >
                  Continue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "rounded-full px-8 gap-2 group shadow-lg shadow-primary/20"
                  )}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Proceed to Payment
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}