"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";

const words = ["CREATIVE", "STUDIO"];

export default function Home() {
  const textRef = useRef<HTMLParagraphElement>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const tl = gsap.timeline({ repeat: -1, delay: 1 });

    words.forEach((_, i) => {
      tl.to(el, {
        opacity: 0,
        y: -20,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => {
          indexRef.current = (indexRef.current + 1) % words.length;
          el.textContent = words[indexRef.current];
        },
      })
      .to(el, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.out",
      })
      .to(el, { duration: 1 }); // hold for 1s before next swap
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <main>
        <section className="flex flex-col items-center">
            <div className="flex flex-col items-center justify-center h-screen text-center">
                <div className="flex items-center gap-4">
                    <span className="w-6 h-6 rounded-full bg-primary" />
                    <h1 className="font-bold font-heading text-9xl text-center">GMAX</h1>
                    <span className="w-6 h-6 rounded-full bg-primary" />
                </div>
                <p ref={textRef} className="text-8xl font-heading text-center">CREATIVE</p>
                <div className="flex flex-wrap items-center gap-2 md:flex-row mt-10">
                    <Button variant="default" size="lg">Book Us</Button>
                    <Button variant="default" size="icon-lg" aria-label="Submit">
                        <ArrowUpRight size={24} />
                    </Button>
                </div>
            </div>
            <div></div>
        </section>
    </main>
  );
}
