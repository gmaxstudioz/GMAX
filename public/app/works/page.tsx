"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const categories = ["All", "Wedding Photography", "Videography", "Events", "Commercial", "Portraits"];

// Creating 25 items to achieve exactly 5 rows on a 5-column desktop layout (which matches the sizing of 4 columns on a 7xl layout)
const worksData = Array.from({ length: 24 }).map((_, index) => {
  const categoryList = ["Wedding Photography", "Videography", "Events", "Commercial", "Portraits"];
  return {
    id: index + 1,
    src: `/works/image-${index + 1}.jpg`,
    category: categoryList[index % categoryList.length]
  };
});

export default function WorksPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeWorkIndex, setActiveWorkIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filteredWorks = activeCategory === "All" 
    ? worksData 
    : worksData.filter(work => work.category === activeCategory);

  useEffect(() => {
    if (gridRef.current) {
      const items = gridRef.current.querySelectorAll('.work-item');
      gsap.fromTo(items, 
        { opacity: 0, scale: 0.9, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "power2.out", overwrite: true }
      );
    }
  }, [activeCategory]);

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

      {/* Grid */}
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
                src={work.src}
                alt={`${work.category} work`}
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
                  {work.category}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredWorks.length === 0 && (
        <div className="w-full flex justify-center py-20 text-gray-500 text-lg">
          No projects found in this category.
        </div>
      )}
    </main>
  );
}
