"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, CheckCircle2, Calendar, User, CreditCard, Loader2, Building2 } from "lucide-react";
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
  
  const [studiosList, setStudiosList] = useState<{ id: string; name: string; slug: string }[]>([]);
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
    },
  });

  const selectedStudioId = watch("studioId");
  const selectedStudioSlug = studiosList.find(s => s.id === selectedStudioId)?.slug;
  const selectedServiceId = watch("selectedServiceId");
  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedAddonIds = watch("selectedAddonIds") || [];

  // Update form's bookingDate when date or time changes
  useEffect(() => {
    if (selectedDate && selectedTime) {
      setValue("bookingDate", `${selectedDate}T${selectedTime}`, { shouldValidate: true });
    } else {
      setValue("bookingDate", "");
    }
  }, [selectedDate, selectedTime, setValue]);

  useEffect(() => {
    // Fetch all studios for Step 1
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
      // Reset selections when changing studio
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
        // Ensure date and time are both selected
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
      const res = await createPublicBooking(data);
      toast.success("Booking created! Redirecting to payment gateway...");
      if (res.paymentUrl) {
        router.push(res.paymentUrl);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create booking.");
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
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{s.name}</h4>
                          <p className="text-sm text-muted-foreground">Select this location</p>
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
                        onValueChange={(val) => setValue("selectedServiceId", val, { shouldValidate: true })} 
                        value={selectedServiceId}
                      >
                        <SelectTrigger className="h-14 rounded-xl text-base bg-card border-input focus:ring-primary focus:ring-offset-1">
                          <SelectValue placeholder="Select a service..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {studio?.categories.map(category => (
                            <SelectGroup key={category.id} className="pb-2">
                              <SelectLabel className="text-primary font-bold text-xs uppercase tracking-wider pl-6 mt-2">{category.name}</SelectLabel>
                              {category.services.map(service => (
                                <SelectItem key={service.id} value={service.id} className="pl-6 py-2.5 cursor-pointer">
                                  {service.name} - ${service.price}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {selectedService && (
                        <div className="p-6 rounded-xl border border-border/50 bg-primary/5 animate-in fade-in slide-in-from-top-2">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-semibold text-xl">{selectedService.name}</h4>
                            <span className="text-xl font-bold text-primary">${selectedService.price}</span>
                          </div>
                          {selectedService.description && (
                            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{selectedService.description}</p>
                          )}
                          {selectedService.features && selectedService.features.length > 0 && (
                            <div className="space-y-3">
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
                      {studio.addons.map((addon) => {
                        const isSelected = selectedAddonIds.includes(addon.id);
                        const isExpanded = expandedItems[addon.id];
                        return (
                          <div
                            key={addon.id}
                            onClick={() => {
                              if (isSelected) {
                                setValue("selectedAddonIds", selectedAddonIds.filter(id => id !== addon.id));
                              } else {
                                setValue("selectedAddonIds", [...selectedAddonIds, addon.id]);
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
                                  <span className="font-medium block">{addon.name}</span>
                                  <span className="text-sm font-semibold text-primary">+${addon.price}</span>
                                </div>
                                {isSelected && <CheckCircle2 className="text-primary w-5 h-5 flex-shrink-0" />}
                              </div>
                              
                              {(addon.description || (addon.features && addon.features.length > 0)) && (
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedItems(prev => ({ ...prev, [addon.id]: !prev[addon.id] }));
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
                                    <ul className="mt-auto text-xs space-y-2 text-muted-foreground/90">
                                      {addon.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1 shrink-0" />
                                          <span>{feature}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                        setSelectedTime(""); // Reset time when date changes
                      }}
                      className="rounded-xl bg-card/50"
                    />
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Available Times</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedDate ? (
                        ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map((time) => {
                           // Mocking availability - usually this comes from the backend
                           // Let's pretend times before noon are "booked" for tomorrow just as an example
                           const isTomorrow = selectedDate === new Date(Date.now() + 86400000).toISOString().split("T")[0];
                           const isBooked = isTomorrow && ["09:00", "10:00", "11:00"].includes(time);
                           
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
      case 4:
        return (
          <div className="space-y-8">
            <div className="bg-card/30 rounded-2xl p-6 border border-border/50 backdrop-blur-sm">
              <h3 className="text-xl font-heading font-bold mb-4 border-b border-border/50 pb-4">Booking Summary</h3>
              <div className="space-y-4 text-sm md:text-base">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium text-right">{selectedService?.name || "Not selected"}</span>
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
              </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total Estimate</span>
                  <span className="text-2xl font-bold text-primary">
                    ${(
                       (selectedService?.price || 0) + 
                       (selectedAddonIds.length > 0 && studio?.addons ? selectedAddonIds.reduce((sum, id) => {
                         const addon = studio.addons.find(a => a.id === id);
                         return sum + (addon?.price || 0);
                       }, 0) : 0)
                     ).toFixed(2)}
                  </span>
                </div>
            </div>
            
            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20 text-center">
              <CreditCard className="w-8 h-8 text-primary mx-auto mb-3" />
              <h4 className="font-semibold mb-2">Secure Payment Gateway</h4>
              <p className="text-sm text-muted-foreground">You will be redirected to our secure payment provider to complete your booking.</p>
            </div>
          </div>
        );
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
