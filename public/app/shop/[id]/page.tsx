"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getProductById, getProducts, purchaseProduct } from "@/lib/api";
import type { ProductOutput } from "@/lib/types/product";
import { ArrowLeft, ShoppingCart, ShoppingBag, Loader2, Tag } from "lucide-react";
import Magnetic from "@/components/ui/magnetic";
import { Button } from "@/components/ui/button";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<ProductOutput | null>(null);
  const [recommendations, setRecommendations] = useState<ProductOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [prod, all] = await Promise.all([
          getProductById(id),
          getProducts(1, 10),
        ]);
        setProduct(prod);
        setRecommendations(all.items.filter((p) => p.id !== id).slice(0, 3));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Product not found");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(price);

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
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-7xl mx-auto">
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10 group"
      >
        <ArrowLeft
          size={20}
          className="transform group-hover:-translate-x-1 transition-transform"
        />
        Back to Shop
      </Link>

      {/* ── Product hero ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-12 lg:gap-20 items-center justify-center">

        {/* Left: Image — now 3/5 width, taller aspect ratio */}
        <div className="w-full h-[50vh] md:w-3/5 relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-[#1f1f1f] shadow-2xl">
          {product.thumbnailSignedUrl ? (
            <Image
              src={product.thumbnailSignedUrl}
              alt={product.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <ShoppingBag size={80} />
            </div>
          )}
        </div>

        {/* Right: Details — now 2/5 width, sticky on scroll */}
        <div className="w-full md:w-2/5 flex flex-col justify-center md:sticky md:top-32">

          {/* Category badge */}
          <span className="inline-flex items-center gap-1.5 self-start mb-5 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-sm font-medium tracking-wide uppercase">
            <Tag size={13} />
            {product.category?.name || "No category"}
          </span>

          <h1 className="text-4xl md:text-6xl font-heading font-extrabold mb-6 leading-tight">
            {product.title}
          </h1>

          <div className="flex items-center gap-3 mb-10">
            {product.salePrice != null ? (
              <>
                <p className="text-3xl text-primary font-medium">
                  {formatPrice(product.salePrice)}
                </p>
                <p className="text-xl text-gray-600 line-through">
                  {formatPrice(product.price)}
                </p>
              </>
            ) : (
              <p className="text-3xl text-primary font-medium">
                {formatPrice(product.price)}
              </p>
            )}
          </div>

          <p className="text-gray-400 text-lg md:text-xl leading-relaxed mb-12">
            {product.description}
          </p>

          <div className="flex gap-4">
            <Magnetic>
              <Button
                size="lg"
                className="w-full md:w-auto px-12 pr-4 h-16 text-xl rounded-full"
                onClick={() => router.push(`/shop/${product.id}/checkout`)}
              >
                <ShoppingCart className="size-6 mr-2" />
                Buy now
                <span className="bg-white rounded-full px-4 py-1 text-black">
                  {formatPrice(effectivePrice)}
                </span>
              </Button>
            </Magnetic>
          </div>
        </div>
      </div>

      {/* ── Recommendations ──────────────────────────────────────── */}
      {recommendations.length > 0 && (
        <div className="mt-32 pt-16 border-t border-white/10">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <h2 className="text-3xl font-heading font-bold">You might also like</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {recommendations.map((prod) => (
              <Link
                href={`/shop/${prod.id}`}
                key={prod.id}
                className="group flex flex-col gap-4 cursor-pointer"
              >
                <div className="relative aspect-[4/5] w-full rounded-[2rem] overflow-hidden bg-[#1f1f1f]">
                  {prod.thumbnailSignedUrl ? (
                    <Image
                      src={prod.thumbnailSignedUrl}
                      alt={prod.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <ShoppingBag size={48} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                    <Magnetic>
                      <span className="flex items-center gap-3 bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition-colors shadow-2xl">
                        <ShoppingBag size={18} /> View Details
                      </span>
                    </Magnetic>
                  </div>
                </div>
                <div className="flex flex-col gap-1 px-2 mt-2">
                  <h3 className="text-xl font-heading font-semibold text-white group-hover:text-primary transition-colors">
                    {prod.title}
                  </h3>
                  <p className="text-gray-400 font-medium">
                    {formatPrice(prod.salePrice ?? prod.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}