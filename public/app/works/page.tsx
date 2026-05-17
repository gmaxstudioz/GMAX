"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { getPortfolio, type PortfolioItem } from "@/lib/api";
import { Loader2 } from "lucide-react";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

function getImageUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

export default function WorksPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeWorkIndex, setActiveWorkIndex] = useState<string | null>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  // Fetch portfolio items from API
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getPortfolio();
        setItems(data.items);
        setCategories(data.categories);
      } catch (err) {
        console.error("Failed to load portfolio:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredWorks = activeCategory === "All"
    ? items
    : items.filter(work => work.category === activeCategory);

  useEffect(() => {
    if (gridRef.current && filteredWorks.length > 0) {
      const gridItems = gridRef.current.querySelectorAll('.work-item');
      gsap.fromTo(gridItems,
        { opacity: 0, scale: 0.9, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "power2.out", overwrite: true }
      );
    }
  }, [activeCategory, filteredWorks.length]);

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 w-full mx-auto">
      <div className="flex flex-col items-center text-center mb-16">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-4 h-4 rounded-full bg-primary"></div>
          <h1 className="text-5xl md:text-7xl font-heading font-bold">Our Portfolio</h1>
          <div className="w-4 h-4 rounded-full bg-primary"></div>
        </div>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl">
          Explore our collection of cinematic visual stories, frozen moments in time, and scroll-stopping imagery.
        </p>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-16">
        <button
          onClick={() => setActiveCategory("All")}
          className={cn(
            "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border border-white/10",
            activeCategory === "All"
              ? "bg-primary text-primary-foreground border-primary scale-105"
              : "bg-transparent text-gray-300 hover:bg-white/5"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border border-white/10",
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary scale-105"
                : "bg-transparent text-gray-300 hover:bg-white/5"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <p className="text-lg">No portfolio items yet. Check back soon!</p>
        </div>
      )}

      {/* Grid */}
      {!loading && filteredWorks.length > 0 && (
        <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full h-auto px-4 md:px-40">
          {filteredWorks.map((work) => {
            const isActive = activeWorkIndex === work.id;
            return (
              <div
                key={work.id}
                className="work-item group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
                onClick={() => setActiveWorkIndex(isActive ? null : work.id)}
              >
                <Image
                  src={getImageUrl(work.r2Key)}
                  alt={work.title || work.category}
                  fill
                  className={cn(
                    "object-cover rounded-xl transition-transform duration-700 md:group-hover:scale-105",
                    isActive && "scale-105"
                  )}
                />
                <div className={cn(
                  "absolute inset-0 rounded-xl bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-all duration-500 flex flex-col justify-end p-6",
                  "md:opacity-0 md:group-hover:opacity-100",
                  isActive ? "opacity-100" : "opacity-0"
                )}>
                  <span className={cn(
                    "text-white font-medium text-lg tracking-wide transition-transform duration-500 transform",
                    "md:translate-y-4 md:group-hover:translate-y-0",
                    isActive ? "translate-y-0" : "translate-y-4"
                  )}>
                    {work.title || work.category}
                  </span>
                  <span className="text-white/60 text-sm mt-1">
                    {work.category}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredWorks.length === 0 && items.length > 0 && (
        <div className="w-full flex justify-center py-20 text-gray-500 text-lg">
          No projects found in this category.
        </div>
      )}
    </main>
  );
}
