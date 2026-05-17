"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestAccessLinkSchema, type RequestAccessLinkInput } from "@/lib/schemas/product.schema";
import { requestAccessLink } from "@/lib/api";
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccessPage() {
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestAccessLinkInput>({
    resolver: zodResolver(requestAccessLinkSchema),
  });

  const onSubmit = async (data: RequestAccessLinkInput) => {
    try {
      setSubmitting(true);
      setError(null);
      await requestAccessLink(data);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request access link");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 flex flex-col items-center justify-center relative">
      <div className="absolute top-32 left-4 md:left-20">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft size={20} className="transform group-hover:-translate-x-1 transition-transform" />
          Back to Shop
        </Link>
      </div>

      <div className="w-full max-w-md mt-16 md:mt-0">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-heading font-bold mb-4">Access Purchases</h1>
          <p className="text-gray-400 text-lg">
            Enter your email address to receive a secure link to download your digital purchases.
          </p>
        </div>

        {success ? (
          <div className="bg-[#1f1f1f] rounded-[2rem] p-8 text-center border border-white/5 flex flex-col items-center gap-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <h2 className="text-2xl font-bold">Link Sent!</h2>
            <p className="text-gray-400">
              We've sent an email with a secure access link. Please check your inbox (and spam folder).
            </p>
            <Button
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => setSuccess(false)}
            >
              Request another link
            </Button>
          </div>
        ) : (
          <div className="bg-[#1f1f1f] rounded-[2rem] p-8 shadow-xl border border-white/5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-gray-300">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  className="bg-[#1a1a1a] border-white/10 text-white rounded-xl py-6 px-4"
                  placeholder="hello@example.com"
                />
                {errors.email && <span className="text-red-400 text-sm">{errors.email.message}</span>}
              </div>

              <Button type="submit" disabled={submitting} className="w-full h-14 text-lg rounded-xl flex items-center justify-center gap-2">
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send Access Link
                  </>
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
