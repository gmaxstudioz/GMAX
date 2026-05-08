"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { getProducts } from "@/lib/api";
import type { ProductOutput } from "@/lib/types/product";
import { ShoppingBag, Search, Loader2 } from "lucide-react";
import Magnetic from "@/components/ui/magnetic";


export default function ShopPage() {
  const [products, setProducts] = useState<ProductOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const res = await getProducts(1, 50);
        setProducts(res.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  useEffect(() => {
    if (!containerRef.current || loading) return;
    const items = containerRef.current.querySelectorAll(".shop-item");
    if (items.length === 0) return;
    gsap.fromTo(
      items,
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.05, ease: "power2.out", overwrite: true }
    );
  }, [searchQuery, loading]);

  const formatPrice = (price: number, salePrice: number | null) => {
    const fmt = (v: number) =>
      new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(v);
    if (salePrice != null) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-primary">{fmt(salePrice)}</span>
          <span className="text-gray-600 line-through text-sm">{fmt(price)}</span>
        </span>
      );
    }
    return <span>{fmt(price)}</span>;
  };

  return (
    <main className="min-h-screen pt-32 pb-24 w-full">
      <div className="flex flex-col items-center text-center mb-12 px-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-primary"></div>
          <h1 className="text-5xl md:text-7xl font-heading font-bold">The Studio Shop</h1>
          <div className="w-3 h-3 rounded-full bg-primary"></div>
        </div>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl">
          Elevate your craft with our premium curated digital assets, presets, and limited edition prints.
        </p>
      </div>

      {/* Search Input */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mb-12 flex justify-end">
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded-full py-2.5 pl-10 pr-4 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="w-full text-center py-20 text-red-400 text-lg">
          {error}
        </div>
      )}

      {/* Products Grid */}
      {!loading && !error && (
        <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 md:px-6 min-h-[40vh]">
          {filteredProducts.map((product) => (
            <Link href={`/shop/${product.id}`} key={product.id} className="shop-item group flex flex-col gap-4 cursor-pointer">
              <div className="relative aspect-[4/5] w-full rounded-[2rem] overflow-hidden bg-[#1f1f1f]">
                {product.thumbnailSignedUrl ? (
                  <Image
                    src={product.thumbnailSignedUrl}
                    alt={product.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <ShoppingBag size={48} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-8">
                  <Magnetic>
                    <span className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-semibold hover:bg-gray-200 transition-colors shadow-2xl">
                      <ShoppingBag size={20} /> View Details
                    </span>
                  </Magnetic>
                </div>
              </div>
              <div className="flex flex-col gap-1 px-2 mt-2">
                <h3 className="text-2xl font-heading font-semibold text-white group-hover:text-primary transition-colors">
                  {product.title}
                </h3>
                <div className="text-gray-400 font-medium text-lg">
                  {formatPrice(product.price, product.salePrice)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && filteredProducts.length === 0 && (
        <div className="w-full text-center py-20 text-gray-500 text-lg">
          No products found matching your search.
        </div>
      )}
    </main>
  );
}
