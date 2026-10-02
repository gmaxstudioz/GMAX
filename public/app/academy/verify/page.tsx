"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyAcademyPayment } from "@/lib/api";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import gsap from "gsap";

function VerifyContent() {
    const searchParams = useSearchParams();
    const reference = searchParams.get("reference");

    const [status, setStatus] = useState<"loading" | "success" | "error">(reference ? "loading" : "error");

    useEffect(() => {
        if (!reference) return;

        async function verify() {
            try {
                const res = await verifyAcademyPayment(reference as string);
                if (res.verified) {
                    setStatus("success");
                } else {
                    setTimeout(async () => {
                        try {
                            const retryRes = await verifyAcademyPayment(reference as string);
                            if (retryRes.verified) setStatus("success");
                            else setStatus("error");
                        } catch {
                            setStatus("error");
                        }
                    }, 2000);
                }
            } catch {
                setStatus("error");
            }
        }

        verify();
    }, [reference]);

    useEffect(() => {
        if (status !== "loading") {
            gsap.fromTo(".result-card", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 });
        }
    }, [status]);

    return (
        <div className="w-full max-w-md result-card">
            {status === "loading" && (
                <div className="text-center space-y-6">
                    <Loader2 className="w-12 h-12 animate-spin text-neutral-500 mx-auto" />
                    <h2 className="text-2xl font-bold tracking-tight">Verifying Registration...</h2>
                    <p className="text-neutral-400">Please wait while we confirm your payment.</p>
                </div>
            )}

            {status === "success" && (
                <div className="text-center space-y-6 bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl">
                    <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">You&apos;re In!</h2>
                    <p className="text-neutral-400 text-lg">
                        Your payment was successful and your registration is confirmed.
                    </p>
                    <p className="text-neutral-500 text-sm">
                        We&apos;ve sent a confirmation email and SMS with your class schedule and details.
                    </p>
                    <div className="pt-6">
                        <Link href="/academy" className="inline-block bg-white text-black font-semibold rounded-lg px-8 py-4 hover:bg-neutral-200 transition-colors w-full">
                            Back to Academy
                        </Link>
                    </div>
                </div>
            )}

            {status === "error" && (
                <div className="text-center space-y-6 bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl">
                    <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Verification Failed</h2>
                    <p className="text-neutral-400 text-lg">
                        We couldn&apos;t verify your payment right now.
                    </p>
                    <p className="text-neutral-500 text-sm">
                        If you were debited, please contact support with your reference: <br/>
                        <span className="font-mono text-white mt-2 inline-block">{reference || "Unknown"}</span>
                    </p>
                    <div className="pt-6">
                        <Link href="/academy" className="inline-block bg-white text-black font-semibold rounded-lg px-8 py-4 hover:bg-neutral-200 transition-colors w-full">
                            Return to Courses
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function VerifyAcademyPayment() {
    return (
        <main className="min-h-screen pt-40 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex items-center justify-center">
            <Suspense fallback={<div className="w-full max-w-md"><Loader2 className="w-12 h-12 animate-spin text-neutral-500 mx-auto" /></div>}>
                <VerifyContent />
            </Suspense>
        </main>
    );
}
