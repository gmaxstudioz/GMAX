"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, CheckCircle2, Calendar, User, CreditCard, Loader2, Building2, Clock, Sparkles, Camera, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { publicBookingSchema, type PublicBookingInput } from "@/lib/schemas/booking.schema";
import { getStudioBySlug, getStudios, createPublicBooking } from "@/lib/api";
import type { PublicStudioOutput, PublicServiceOutput } from "@/lib/types/studio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const steps = [
  { id: 1, title: 'Configuration', icon: Sparkles,  description: 'Build your session'      },
  { id: 2, title: 'Details',       icon: User,      description: 'Your information'        },
  { id: 3, title: 'Payment',       icon: CreditCard, description: 'Confirm & pay'          },
];

export default function BookingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [configStep, setConfigStep] = useState(1);
  const [selectedOccasionType, setSelectedOccasionType] = useState<string>("");
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
      let ok = false;

      if (currentStep === 1) {
        if (configStep === 1) {
          if (!selectedStudioId) { toast.error("Please select a location."); return; }
          setConfigStep(2);
          return;
        } else if (configStep === 2) {
          if (!selectedOccasionType) { toast.error("Please select an occasion."); return; }
          setConfigStep(3);
          return;
        } else if (configStep === 3) {
          if (!selectedServiceId) { toast.error("Please select a package."); return; }
          if (selectedService?.variants.length === 1) setConfigStep(5);
          else setConfigStep(4);
          return;
        } else if (configStep === 4) {
          if (!selectedVariantId) { toast.error("Please select a shoot location."); return; }
          setConfigStep(5);
          return;
        } else if (configStep === 5) {
          if (!selectedDate || !selectedTime) { toast.error("Please select both a date and a time."); return; }
          ok = await trigger(["studioId", "selectedServiceId", "selectedVariantId", "bookingDate", "selectedAddonIds"]);
        }
      } else if (currentStep === 2) {
        ok = await trigger(["clientName", "clientEmail", "clientPhone"]);
      }

      if (!ok) return;

      gsap.to(formRef.current, {
        opacity: 0,
        x: -20,
        duration: 0.3,
        onComplete: () => {
          setCurrentStep((prev) => Math.min(prev + 1, steps.length));
          window.scrollTo({ top: 0, behavior: "smooth" });
          gsap.fromTo(formRef.current, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" });
        },
      });
    } else {
      if (currentStep === 1) {
        if (configStep > 1) {
          let prevConfigStep = configStep - 1;
          if (configStep === 5 && selectedService?.variants.length === 1) {
            prevConfigStep = 3;
          }
          setConfigStep(prevConfigStep);
        }
        return;
      }
      
      gsap.to(formRef.current, {
        opacity: 0,
        x: 20,
        duration: 0.3,
        onComplete: () => {
          setCurrentStep((prev) => Math.max(prev - 1, 1));
          window.scrollTo({ top: 0, behavior: "smooth" });
          gsap.fromTo(formRef.current, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" });
        },
      });
    }
  };

    const onSubmit = async (data: PublicBookingInput) => {
    try {
      setIsSubmitting(true);
      const result = await createPublicBooking({
        ...data,
        sessionCount: data.sessionCount || 1,
      });
      if (result && result.bookingId) {
        toast.success("Booking created! Redirecting to payment...");
        if (result.reference) {
           router.push(`/pay/${result.reference}`);
        } else {
           router.push(`/booking/${result.bookingId}/deliverables`);
        }
      } else {
        toast.error("Failed to submit booking");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
                  case 1: {
        const selectedCategory = studio?.categories.find((c: any) => c.services.some((s: any) => s.id === selectedServiceId));
        const categoryAddons = selectedCategory?.services.filter((s: any) => s.isAddon && s.isActive !== false) || [];

        const occasionAnswers = [
          { label: "Birthday", mappedCategory: "Photography", icon: "🎂" },
          { label: "Wedding", mappedCategory: "Wedding", icon: "💍" },
          { label: "Event", mappedCategory: "Wedding", icon: "🎊" },
          { label: "Graduation", mappedCategory: "Photography", icon: "🎓" },
          { label: "Personal Shoot", mappedCategory: "Photography", icon: "📸" },
          { label: "Other", mappedCategory: "Other", icon: "✨" }
        ];

        return (
          <div className="w-full">
            {/* ─── CONFIG STEP 1: STUDIO ─── */}
            {configStep === 1 && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="mb-8">
                  <Label className="text-2xl font-bold font-heading text-foreground">
                    Select a location close to you
                  </Label>
                  <p className="text-sm text-muted-foreground mt-2">Pick the studio you would like to visit.</p>
                </div>
                {studiosList.length === 0 ? (
                  <p className="text-muted-foreground">No studios available at the moment.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studiosList.map((s: any) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setValue("studioId", s.id, { shouldValidate: true });
                          fetchStudioServices(s.slug);
                          setConfigStep(2);
                        }}
                        className={cn(
                          "p-6 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md",
                          selectedStudioId === s.id
                            ? "border-primary bg-primary/10 ring-1 ring-primary shadow-md"
                            : "border-border/50 bg-card"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          {s.logo ? (
                            <div className="w-14 h-14 rounded-full overflow-hidden border shadow-sm shrink-0 relative">
                              <Image src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ""}/${s.logo}`} alt={s.name} fill className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-bold text-lg font-heading">{s.name}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-1">{(s.metadata?.description as string) || "Select this location"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {errors.studioId && <p className="text-destructive text-sm">{errors.studioId.message}</p>}
              </div>
            )}

            {/* ─── CONFIG STEP 2: OCCASION QUESTION ─── */}
            {configStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="mb-8">
                  <Label className="text-2xl font-bold font-heading text-foreground">
                    What is the occasion?
                  </Label>
                  <p className="text-sm text-muted-foreground mt-2">Let us know what you're celebrating so we can tailor the experience.</p>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {occasionAnswers.map((answer) => (
                    <div
                      key={answer.label}
                      onClick={() => {
                        setSelectedOccasionType(answer.mappedCategory);
                        setConfigStep(3);
                      }}
                      className={cn(
                        "p-6 rounded-2xl border cursor-pointer transition-all duration-300 group hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-3 bg-card hover:shadow-md"
                      )}
                    >
                      <span className="text-4xl group-hover:scale-110 transition-transform">{answer.icon}</span>
                      <span className="font-semibold text-center">{answer.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── CONFIG STEP 3: SERVICE SELECTION ─── */}
            {configStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="mb-8">
                  <Label className="text-2xl font-bold font-heading text-foreground">
                    Select a package
                  </Label>
                  <p className="text-sm text-muted-foreground mt-2">Choose the perfect package for your session.</p>
                </div>

                {isLoadingServices ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm">Loading available sessions…</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {(() => {
                      const filteredCategories = selectedOccasionType === "Other"
                        ? studio?.categories
                        : studio?.categories?.filter((c: any) => c.name.toLowerCase().includes(selectedOccasionType.toLowerCase()));

                      const categoriesToDisplay = filteredCategories?.length ? filteredCategories : studio?.categories;
                      
                      const allServices = categoriesToDisplay?.flatMap((c: any) => c.services.filter((s: any) => !s.isAddon && s.isActive !== false)) || [];
                      
                      if (allServices.length === 0) return <p className="text-muted-foreground">No services found for this selection.</p>;
                      
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {allServices.map((service: any) => {
                            const isSelected = selectedServiceId === service.id;
                            return (
                              <div
                                key={service.id}
                                onClick={() => {
                                  setValue("selectedServiceId", service.id, { shouldValidate: true });
                                  setValue("selectedAddonIds", []);
                                  setSelectedDate("");
                                  setSelectedTime("");
                                  
                                  if (service.variants.length === 1) {
                                    setValue("selectedVariantId", service.variants[0].id, { shouldValidate: true });
                                    setConfigStep(5);
                                  } else {
                                    setValue("selectedVariantId", "", { shouldValidate: false });
                                    setConfigStep(4);
                                  }
                                }}
                                className={cn(
                                  "relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 group overflow-hidden flex flex-col justify-center min-h-[120px]",
                                  isSelected ? "border-primary bg-primary/10 ring-1 ring-primary shadow-md" : "border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
                                )}
                              >
                                {isSelected && <CheckCircle2 className="absolute top-4 right-4 w-5 h-5 text-primary" />}
                                <div className="pr-8">
                                  <h4 className="font-heading font-bold text-lg leading-snug">{service.name}</h4>
                                  {service.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{service.description}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {errors.selectedServiceId && <p className="text-destructive text-sm">{errors.selectedServiceId.message}</p>}
              </div>
            )}

            {/* ─── CONFIG STEP 4: LOCATION TOGGLE ─── */}
            {configStep === 4 && selectedService && selectedService.variants.length > 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="mb-8">
                  <Label className="text-2xl font-bold font-heading text-foreground">
                    Where would you like to snap?
                  </Label>
                  <p className="text-sm text-muted-foreground mt-2">Select your preferred location type for this session.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {selectedService.variants.map((variant: any) => {
                    const isSelectedV = selectedVariantId === variant.id;
                    const locationMeta: Record<string, { label: string; icon: string }> = {
                      STUDIO:   { label: "Studio",          icon: "🏢" },
                      OUTDOOR:  { label: "Outdoor",         icon: "🌿" },
                      BOTH:     { label: "Studio & Outdoor", icon: "✨" },
                      MULTIPLE: { label: "Multiple Locations", icon: "📍" },
                    };
                    const meta = locationMeta[variant.locationType] ?? { label: variant.locationType, icon: "📷" };

                    return (
                      <div
                        key={variant.id}
                        onClick={() => {
                          setValue("selectedVariantId", variant.id, { shouldValidate: true });
                          setConfigStep(5);
                        }}
                        className={cn(
                          "relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 group hover:shadow-md",
                          isSelectedV ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5"
                        )}
                      >
                        {isSelectedV && <CheckCircle2 className="absolute top-4 right-4 w-5 h-5 text-primary" />}
                        <div className="text-3xl mb-3">{meta.icon}</div>
                        <p className="font-semibold text-base">{meta.label}</p>
                        <p className="text-primary font-bold mt-1 text-sm">₦{Number(variant.basePrice).toLocaleString("en-NG")}</p>
                      </div>
                    );
                  })}
                </div>
                {errors.selectedVariantId && <p className="text-destructive text-sm">{errors.selectedVariantId.message}</p>}
              </div>
            )}

            {/* ─── CONFIG STEP 5: SESSION CONFIG ─── */}
            {configStep === 5 && selectedVariant && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="mb-4">
                  <Label className="text-2xl font-bold font-heading text-foreground">
                    Configure your session
                  </Label>
                  <p className="text-sm text-muted-foreground mt-2">Personalize your outfits, add-ons, and choose a date.</p>
                </div>

                <div className="flex items-center justify-between p-5 rounded-2xl bg-primary/5 border border-primary/20">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Price per session</p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      ₦{Number(selectedVariant.basePrice).toLocaleString("en-NG")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Duration</p>
                    <div className="flex items-center gap-1.5 justify-end mt-1">
                      <Clock className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-lg">{selectedVariant.sessionDurationMins}min</span>
                    </div>
                  </div>
                </div>

                {/* Outfits Stepper */}
                <div className="space-y-4 pt-4 border-t border-border/50">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium text-foreground uppercase tracking-wider">
                      How many outfits?
                    </Label>
                    {selectedTime && (
                      <span className="text-xs text-primary font-medium bg-primary/10 px-3 py-1 rounded-full">
                        Max: {maxAvailableSessions}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                      <button type="button" onClick={() => { const cur = watch("sessionCount") || 1; if (cur > 1) setValue("sessionCount", cur - 1, { shouldValidate: true }); }} className="w-12 h-12 flex items-center justify-center text-xl font-bold hover:bg-muted/50 transition-colors">−</button>
                      <div className="w-14 h-12 flex items-center justify-center font-bold text-lg border-x border-border">{watch("sessionCount") || 1}</div>
                      <button type="button" onClick={() => { const cur = watch("sessionCount") || 1; if (cur < maxAvailableSessions) setValue("sessionCount", cur + 1, { shouldValidate: true }); }} className="w-12 h-12 flex items-center justify-center text-xl font-bold hover:bg-muted/50 transition-colors">+</button>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">₦{(Number(selectedVariant.basePrice) * (watch("sessionCount") || 1)).toLocaleString("en-NG")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{watch("sessionCount") || 1} outfit{(watch("sessionCount") || 1) !== 1 ? "s" : ""} · subtotal</p>
                    </div>
                  </div>
                  {!selectedTime && <p className="text-xs text-muted-foreground/70">Select a time slot below to unlock the maximum available outfits.</p>}
                  {errors.sessionCount && <p className="text-destructive text-sm">{errors.sessionCount.message}</p>}
                </div>

                {/* Add-ons */}
                {categoryAddons.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-border/50">
                    <Label className="text-sm font-medium text-foreground uppercase tracking-wider">
                      Enhance Your Session <span className="ml-2 text-xs normal-case font-normal text-muted-foreground/60">(optional)</span>
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryAddons.flatMap((addon: any) =>
                        addon.variants.map((variant: any) => {
                          const compositeId = `${addon.id}:${variant.id}`;
                          const isChosen    = selectedAddonIds.includes(compositeId);
                          return (
                            <div
                              key={compositeId}
                              onClick={() => {
                                if (isChosen) {
                                  setValue("selectedAddonIds", selectedAddonIds.filter(id => id !== compositeId));
                                } else {
                                  const filtered = selectedAddonIds.filter(id => !id.startsWith(`${addon.id}:`));
                                  setValue("selectedAddonIds", [...filtered, compositeId]);
                                }
                              }}
                              className={cn("p-5 rounded-2xl border cursor-pointer transition-all duration-300 hover:shadow-sm", isChosen ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5")}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-semibold text-base block">{addon.name}</span>
                                  <span className="text-sm font-bold text-primary mt-1 block">+₦{Number(variant.basePrice || 0).toLocaleString("en-NG")}</span>
                                </div>
                                {isChosen && <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Date & Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-border/50">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground uppercase tracking-wider">Select Date</Label>
                    <Input type="date" min={new Date().toISOString().split("T")[0]} value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedTime(""); }} className="rounded-xl bg-card/50 h-12" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground uppercase tracking-wider">Available Times</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedDate ? (
                        timeSlots.map(time => {
                          const isBooked = isTomorrow && timeSlots.indexOf(time) < 3;
                          return (
                            <button key={time} type="button" disabled={isBooked} onClick={() => setSelectedTime(time)} className={cn("py-2.5 px-3 text-sm font-medium rounded-xl border transition-all", isBooked ? "bg-muted/50 text-muted-foreground opacity-40 cursor-not-allowed border-transparent" : selectedTime === time ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card hover:border-primary/50 border-border")}>
                              {time}
                            </button>
                          );
                        })
                      ) : (
                        <div className="col-span-3 text-sm text-muted-foreground py-3 bg-muted/30 text-center rounded-xl border border-dashed border-border">Select a date to view times</div>
                      )}
                    </div>
                    {errors.bookingDate && <p className="text-destructive text-sm mt-2">{errors.bookingDate.message}</p>}
                  </div>
                </div>

              </div>
            )}
          </div>
        );
      }
      case 2:
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <Label className="text-2xl font-bold font-heading text-foreground">
                Your Details
              </Label>
              <p className="text-sm text-muted-foreground mt-2">Please provide your contact information.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  {...register("clientName")}
                  className="rounded-xl bg-card/50 h-12"
                />
                {errors.clientName && <p className="text-destructive text-sm">{errors.clientName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  {...register("clientEmail")}
                  className="rounded-xl bg-card/50 h-12"
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
                className="rounded-xl bg-card/50 h-12"
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
      case 3: {
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

        {/* Stepper (Desktop) */}
        <div className="mb-12 relative hidden md:block">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border/50 -translate-y-1/2 z-0"></div>
          <div className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-500 ease-in-out" style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}></div>
          
          <div className="relative z-10 flex justify-between gap-0">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex flex-col items-center gap-2">
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
                  <div className="text-center">
                    <div className={cn(
                      "text-sm font-bold uppercase tracking-wider transition-colors",
                      isActive ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stepper (Mobile) */}
        <div className="mb-8 md:hidden">
          <div className="flex items-center justify-between bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 text-primary">
              {steps.find(s => s.id === currentStep)?.icon && (() => {
                const CurrentIcon = steps.find(s => s.id === currentStep)!.icon;
                return (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CurrentIcon className="w-5 h-5" />
                  </div>
                );
              })()}
              <div>
                <span className="text-sm font-bold uppercase tracking-wider block">
                  {steps.find(s => s.id === currentStep)?.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {steps.find(s => s.id === currentStep)?.description}
                </span>
              </div>
            </div>
            <div className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-full">
              Step {currentStep} of {steps.length}
            </div>
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