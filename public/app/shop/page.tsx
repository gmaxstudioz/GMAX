"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { products } from "@/lib/shop-data";
import { ShoppingBag, Search } from "lucide-react";
import Magnetic from "@/components/ui/magnetic";
import { cn } from "@/lib/utils";

export default function ShopPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const categories = ["All", ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll('.shop-item');
    if (items.length === 0) return;
    gsap.fromTo(
      items,
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.05, ease: "power2.out", overwrite: true }
    );
  }, [activeCategory, searchQuery]);

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

      {/* Controls: Search and Filter */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Category Filters */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as string)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 border border-white/10",
                activeCategory === cat 
                  ? "bg-primary text-primary-foreground border-primary scale-105" 
                  : "bg-transparent text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
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

      <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 md:px-6 min-h-[40vh]">
        {filteredProducts.map((product) => (
          <Link href={`/shop/${product.id}`} key={product.id} className="shop-item group flex flex-col gap-4 cursor-pointer">
            <div className="relative aspect-[4/5] w-full rounded-[2rem] overflow-hidden bg-[#1f1f1f]">
              <Image
                src={product.src}
                alt={product.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                {product.category}
              </div>
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
              <p className="text-gray-400 font-medium text-lg">{product.price}</p>
            </div>
          </Link>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="w-full text-center py-20 text-gray-500 text-lg">
          No products found matching your search or filter.
        </div>
      )}
    </main>
  );
}
