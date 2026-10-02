"use client";

import { useState, useEffect } from "react";
import { registerForCourse } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

declare global {
    interface Window {
        PaystackPop: {
            new (): {
                newTransaction(options: Record<string, unknown>): void;
            };
        };
    }
}

interface Batch {
    id: string;
    name: string;
    startDate: string | Date;
    endDate: string | Date;
}

interface CourseData {
    id: string;
    price: number | string;
    batches?: Batch[];
}

export function CourseSignupForm({ course }: { course: CourseData }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);

    useEffect(() => {
        if (document.getElementById("paystack-script")) {
            setTimeout(() => setScriptLoaded(true), 0);
            return;
        }
        const script = document.createElement("script");
        script.id = "paystack-script";
        script.src = "https://js.paystack.co/v2/inline.js";
        script.onload = () => setScriptLoaded(true);
        document.head.appendChild(script);
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        
        if (!scriptLoaded || !window.PaystackPop) {
            setError("Payment system is loading. Please wait...");
            return;
        }

        const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
        if (!publicKey) {
            setError("Payment is not configured. Please contact support.");
            return;
        }

        setLoading(true);
        setError(null);
        
        const formData = new FormData(e.currentTarget);
        const data = {
            courseId: course.id,
            batchId: formData.get("batchId") as string,
            firstName: formData.get("firstName") as string,
            lastName: formData.get("lastName") as string,
            email: formData.get("email") as string,
            phone: formData.get("phone") as string,
            paymentPlan: formData.get("paymentPlan") as "FULL" | "HALF" | "QUARTER",
            howDidYouHear: formData.get("howDidYouHear") as string,
        };

        try {
            const res = await registerForCourse(data);
            
            const popup = new window.PaystackPop();
            popup.newTransaction({
                key: publicKey,
                email: res.email,
                amount: Math.round(res.amount * 100),
                ref: res.reference,
                currency: "NGN",
                onSuccess: () => {
                    router.push(`/academy/verify?reference=${res.reference}`);
                },
                onCancel: () => {
                    setLoading(false);
                },
            });
            
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to register. Please try again.";
            setError(errorMessage);
            setLoading(false);
        }
    }

    const [selectedPlan, setSelectedPlan] = useState("FULL");
    
    // Calculate display price
    const basePrice = Number(course.price);
    let displayPrice = basePrice;
    if (selectedPlan === "QUARTER") displayPrice = basePrice * 0.25;
    if (selectedPlan === "HALF") displayPrice = basePrice * 0.50;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                    {error}
                </div>
            )}
            
            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Batch / Session</label>
                <select 
                    name="batchId" 
                    required 
                    className="w-full bg-background border border-input rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
                >
                    <option value="">-- Choose a Batch --</option>
                    {course.batches?.map((batch: Batch) => (
                        <option key={batch.id} value={batch.id}>
                            {batch.name} ({format(new Date(batch.startDate), "do MMMM")} - {format(new Date(batch.endDate), "do MMMM")})
                        </option>
                    ))}
                </select>
                {(!course.batches || course.batches.length === 0) && (
                    <p className="text-xs text-destructive mt-1">No batches available for this course yet.</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">First Name</label>
                    <input 
                        type="text" 
                        name="firstName" 
                        required 
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
                        placeholder="Jane"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Name</label>
                    <input 
                        type="text" 
                        name="lastName" 
                        required 
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
                        placeholder="Doe"
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</label>
                <input 
                    type="email" 
                    name="email" 
                    required 
                    className="w-full bg-background border border-input rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
                    placeholder="jane@example.com"
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone Number</label>
                    <input 
                        type="tel" 
                        name="phone" 
                        required 
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
                        placeholder="+234..."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How did you hear about us?</label>
                    <select 
                        name="howDidYouHear" 
                        required 
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
                    >
                        <option value="">-- Select --</option>
                        <option value="Social Media">Social Media</option>
                        <option value="Friend/Family">Friend or Family</option>
                        <option value="Website">Website</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Plan</label>
                <div className="grid grid-cols-3 gap-2">
                    <label className={`cursor-pointer border rounded-lg p-3 text-center transition-colors ${selectedPlan === "FULL" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:border-muted-foreground"}`}>
                        <input type="radio" name="paymentPlan" value="FULL" checked={selectedPlan === "FULL"} onChange={(e) => setSelectedPlan(e.target.value)} className="hidden" />
                        <div className="text-xs font-semibold uppercase">100% Full</div>
                    </label>
                    <label className={`cursor-pointer border rounded-lg p-3 text-center transition-colors ${selectedPlan === "HALF" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:border-muted-foreground"}`}>
                        <input type="radio" name="paymentPlan" value="HALF" checked={selectedPlan === "HALF"} onChange={(e) => setSelectedPlan(e.target.value)} className="hidden" />
                        <div className="text-xs font-semibold uppercase">50% Part</div>
                    </label>
                    <label className={`cursor-pointer border rounded-lg p-3 text-center transition-colors ${selectedPlan === "QUARTER" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:border-muted-foreground"}`}>
                        <input type="radio" name="paymentPlan" value="QUARTER" checked={selectedPlan === "QUARTER"} onChange={(e) => setSelectedPlan(e.target.value)} className="hidden" />
                        <div className="text-xs font-semibold uppercase">25% Part</div>
                    </label>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={loading || !course.batches || course.batches.length === 0}
                className="w-full mt-4 bg-primary text-primary-foreground font-semibold rounded-lg px-4 py-4 hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Pay ₦{displayPrice.toLocaleString()}</>}
            </button>
            <p className="text-center text-xs text-muted-foreground mt-4">
                Payments are securely processed by Paystack
            </p>
        </form>
    );
}
