"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { buttonVariants } from "@/components/ui/button";
import Magnetic from "@/components/ui/magnetic";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NotFound() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const tl = gsap.timeline();

    tl.fromTo(
      ".not-found-404",
      { opacity: 0, y: 100, scale: 0.8 },
      { opacity: 1, y: 0, scale: 1, duration: 1, ease: "power4.out" }
    )
      .fromTo(
        ".not-found-text",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.2 },
        "-=0.6"
      )
      .fromTo(
        ".not-found-btn",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
        "-=0.4"
      );
  }, []);

  return (
    <main
      ref={containerRef}
      className="flex flex-col items-center justify-center min-h-[80vh] py-32 text-center overflow-hidden"
    >
      <div className="relative w-full flex justify-center">
        <h1 className="not-found-404 text-[25vw] md:text-[20vw] leading-none font-extrabold font-heading text-primary/10 select-none">
          404
        </h1>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[4vw]">
          <h2 className="not-found-text text-4xl md:text-6xl font-heading font-medium mb-4 pointer-events-auto">
            Lost in the Lens
          </h2>
          <p className="not-found-text text-gray-400 text-lg md:text-xl max-w-md mx-auto pointer-events-auto px-4">
            We couldn't find the page you're looking for. It might have been moved or deleted.
          </p>
        </div>
      </div>

      <div className="not-found-btn mt-12 pointer-events-auto z-10">
        <Magnetic>
          <Link href="/" className={cn("inline-flex items-center gap-2")}>
            <span className={buttonVariants({ variant: "default", size: "icon-lg" })}>
              <ArrowLeft size={20} />
            </span>
            <span className={buttonVariants({ variant: "default", size: "lg" })}>
              Back to Home
            </span>
          </Link>
        </Magnetic>
      </div>
    </main>
  );
}
