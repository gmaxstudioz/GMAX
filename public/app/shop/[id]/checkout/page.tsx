"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { purchaseProductSchema, type PurchaseProductInput } from "@/lib/schemas/product.schema";
import { getProductById, purchaseProduct } from "@/lib/api";
import type { ProductOutput } from "@/lib/types/product";
import { ArrowLeft, ShoppingBag, Loader2, CreditCard, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<ProductOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PurchaseProductInput>({
    resolver: zodResolver(purchaseProductSchema),
    defaultValues: {
      productId: id as string,
      buyerName: "",
      buyerEmail: "",
      buyerPhone: "",
    },
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const prod = await getProductById(id);
        setProduct(prod);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Product not found");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(price);

  const onSubmit = async (data: PurchaseProductInput) => {
    try {
      setSubmitting(true);
      const result = await purchaseProduct(data);
      // The backend returns a reference, and we should redirect to /pay/[reference]
      router.push(`/pay/${result.reference}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred during checkout");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-lg">{error || "Product not found"}</p>
        <Link href="/shop" className="text-primary hover:underline">
          Back to Shop
        </Link>
      </main>
    );
  }

  const effectivePrice = product.salePrice ?? product.price;

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-12 lg:gap-20">
      {/* Left side: Order Summary */}
      <div className="w-full md:w-2/5 flex flex-col">
        <Link
          href={`/shop/${id}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10 group self-start"
        >
          <ArrowLeft size={20} className="transform group-hover:-translate-x-1 transition-transform" />
          Back to Product
        </Link>

        <h2 className="text-3xl font-heading font-bold mb-8">Order Summary</h2>
        <div className="bg-[#1f1f1f] rounded-[2rem] p-6 shadow-xl border border-white/5 flex flex-col gap-6">
          <div className="flex gap-4 items-center">
            <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-black/50 flex-shrink-0">
              {product.thumbnailSignedUrl ? (
                <Image src={product.thumbnailSignedUrl} alt={product.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  <ShoppingBag size={32} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-lg text-white line-clamp-2">{product.title}</h3>
              <p className="text-primary font-medium">{formatPrice(effectivePrice)}</p>
            </div>
          </div>
          
          <hr className="border-white/10" />
          
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(effectivePrice)}</span>
          </div>
        </div>
      </div>

      {/* Right side: Checkout Form */}
      <div className="w-full md:w-3/5 flex flex-col pt-12 md:pt-20">
        <h2 className="text-3xl font-heading font-bold mb-8">Checkout Details</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="buyerName" className="text-gray-300">
              Full Name
            </Label>
            <Input
              id="buyerName"
              type="text"
              {...register("buyerName")}
              className="bg-[#1a1a1a] border-white/10 text-white rounded-xl py-6 px-4"
              placeholder="John Doe"
            />
            {errors.buyerName && <span className="text-red-400 text-sm">{errors.buyerName.message}</span>}
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col gap-2 flex-1">
              <Label htmlFor="buyerEmail" className="text-gray-300">
                Email Address
              </Label>
              <Input
                id="buyerEmail"
                type="email"
                {...register("buyerEmail")}
                className="bg-[#1a1a1a] border-white/10 text-white rounded-xl py-6 px-4"
                placeholder="john@example.com"
              />
              {errors.buyerEmail && <span className="text-red-400 text-sm">{errors.buyerEmail.message}</span>}
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <Label htmlFor="buyerPhone" className="text-gray-300">
                Phone Number
              </Label>
              <Input
                id="buyerPhone"
                type="tel"
                {...register("buyerPhone")}
                className="bg-[#1a1a1a] border-white/10 text-white rounded-xl py-6 px-4"
                placeholder="+234 800 000 0000"
              />
              {errors.buyerPhone && <span className="text-red-400 text-sm">{errors.buyerPhone.message}</span>}
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full mt-6 h-14 text-lg rounded-xl flex items-center justify-center gap-2">
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Proceed to Payment
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-4">
            <ShieldCheckIcon className="w-4 h-4" />
            <span>Secure checkout. Payments are processed securely via Paystack.</span>
          </div>
        </form>
      </div>
    </main>
  );
}
