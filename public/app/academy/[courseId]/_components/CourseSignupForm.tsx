"use client";

import { useState, useEffect } from "react";
import { registerForCourse } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">
                    {error}
                </div>
            )}
            
            <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Select Batch / Session</label>
                <select 
                    name="batchId" 
                    required 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neutral-500 transition-colors"
                >
                    <option value="">-- Choose a Batch --</option>
                    {course.batches?.map((batch: Batch) => (
                        <option key={batch.id} value={batch.id}>
                            {batch.name} ({new Date(batch.startDate).toLocaleDateString()} - {new Date(batch.endDate).toLocaleDateString()})
                        </option>
                    ))}
                </select>
                {(!course.batches || course.batches.length === 0) && (
                    <p className="text-xs text-red-400 mt-1">No batches available for this course yet.</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">First Name</label>
                    <input 
                        type="text" 
                        name="firstName" 
                        required 
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                        placeholder="Jane"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Last Name</label>
                    <input 
                        type="text" 
                        name="lastName" 
                        required 
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                        placeholder="Doe"
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Email Address</label>
                <input 
                    type="email" 
                    name="email" 
                    required 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                    placeholder="jane@example.com"
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Phone Number</label>
                    <input 
                        type="tel" 
                        name="phone" 
                        required 
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                        placeholder="+234..."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">How did you hear about us?</label>
                    <select 
                        name="howDidYouHear" 
                        required 
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neutral-500 transition-colors"
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
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Payment Plan</label>
                <div className="grid grid-cols-3 gap-2">
                    <label className={`cursor-pointer border rounded-lg p-3 text-center transition-colors ${selectedPlan === "FULL" ? "bg-white text-black border-white" : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-600"}`}>
                        <input type="radio" name="paymentPlan" value="FULL" checked={selectedPlan === "FULL"} onChange={(e) => setSelectedPlan(e.target.value)} className="hidden" />
                        <div className="text-xs font-semibold uppercase">100% Full</div>
                    </label>
                    <label className={`cursor-pointer border rounded-lg p-3 text-center transition-colors ${selectedPlan === "HALF" ? "bg-white text-black border-white" : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-600"}`}>
                        <input type="radio" name="paymentPlan" value="HALF" checked={selectedPlan === "HALF"} onChange={(e) => setSelectedPlan(e.target.value)} className="hidden" />
                        <div className="text-xs font-semibold uppercase">50% Part</div>
                    </label>
                    <label className={`cursor-pointer border rounded-lg p-3 text-center transition-colors ${selectedPlan === "QUARTER" ? "bg-white text-black border-white" : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-600"}`}>
                        <input type="radio" name="paymentPlan" value="QUARTER" checked={selectedPlan === "QUARTER"} onChange={(e) => setSelectedPlan(e.target.value)} className="hidden" />
                        <div className="text-xs font-semibold uppercase">25% Part</div>
                    </label>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={loading || !course.batches || course.batches.length === 0}
                className="w-full mt-4 bg-white text-black font-semibold rounded-lg px-4 py-4 hover:bg-neutral-200 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Pay ₦{displayPrice.toLocaleString()}</>}
            </button>
            <p className="text-center text-xs text-neutral-600 mt-4">
                Payments are securely processed by Paystack
            </p>
        </form>
    );
}
