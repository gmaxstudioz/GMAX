"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buttonVariants } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Magnetic from "@/components/ui/magnetic";
import Link from "next/link";
import { cn } from "@/lib/utils";
import ServicesSection from "@/components/web/ServicesSection";
import { getPortfolio, type PortfolioItem } from "@/lib/api";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

const words = ["CREATIVE", "STUDIO"];

const heroImages = [
  { src: "/works/image-1.jpg", top: "5%", left: "5%" },
  { src: "/works/image-2.jpg", top: "8%", right: "5%" },
  { src: "/works/image-3.jpg", top: "40%", left: "2%" },
  { src: "/works/image-4.jpg", top: "42%", right: "2%" },
  { src: "/works/image-5.jpg", bottom: "5%", left: "5%" },
  { src: "/works/image-6.jpg", bottom: "8%", right: "5%" },
  { src: "/works/image-7.jpg", top: "10%", left: "25%" },
  { src: "/works/image-8.jpg", top: "12%", right: "25%" },
  { src: "/works/image-9.jpg", bottom: "10%", left: "25%" },
  { src: "/works/image-10.jpg", bottom: "12%", right: "25%" },
  { src: "/works/image-11.jpg", top: "25%", left: "15%" },
  { src: "/works/image-12.jpg", top: "28%", right: "15%" },
  { src: "/works/image-13.jpg", bottom: "25%", left: "15%" },
  { src: "/works/image-14.jpg", bottom: "28%", right: "15%" },
  { src: "/works/image-15.jpg", top: "75%", left: "45%" },
];

export default function Home() {
  const textRef = useRef<HTMLParagraphElement>(null);
  const indexRef = useRef(0);
  const imagesRef = useRef<(HTMLDivElement | null)[]>([]);
  const worksGridRef = useRef<HTMLDivElement>(null);
  const worksTextRef = useRef<HTMLParagraphElement>(null);
  const worksBtnRef = useRef<HTMLDivElement>(null);
  const [activeWorkIndex, setActiveWorkIndex] = useState<number | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);

  const footerText = "We masterfully blur the line between reality and art, crafting cinematic legacies and luxury imagery that command attention and stand the test of time.";
  const footerWords = footerText.split(" ");

  useEffect(() => {
    getPortfolio().then(data => setPortfolioItems(data.items.slice(0, 8))).catch(() => {});
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
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
      .to(el, { duration: 1 });
    });

    // Parallax
    imagesRef.current.forEach((imgEl, index) => {
      if (!imgEl) return;
      
      const speed = 1 + (index % 3) * 0.5;

      gsap.to(imgEl, {
        y: () => -window.innerHeight * speed,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-section",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    });

    // Repulsion
    const heroEl = document.querySelector('.hero-section');
    if (!heroEl) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      imagesRef.current.forEach((imgEl) => {
        if (!imgEl) return;
        const img = imgEl.querySelector('img');
        if (!img) return;

        const rect = imgEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const distanceX = clientX - centerX;
        const distanceY = clientY - centerY;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        
        const maxDistance = 300;
        if (distance < maxDistance && distance > 0) {
          const force = (maxDistance - distance) / maxDistance;
          const moveX = -(distanceX / distance) * force * 50; 
          const moveY = -(distanceY / distance) * force * 50;
          
          gsap.to(img, { x: moveX, y: moveY, duration: 0.5, ease: "power2.out" });
        } else {
          gsap.to(img, { x: 0, y: 0, duration: 0.5, ease: "power2.out" });
        }
      });
    };

    heroEl.addEventListener("mousemove", handleMouseMove as any);

    // Works Grid Animation
    if (worksGridRef.current) {
      const workItems = worksGridRef.current.querySelectorAll('.work-item');
      gsap.fromTo(workItems,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: worksGridRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse"
          }
        }
      );
    }

    // Works Text & Button Animation
    if (worksTextRef.current && worksBtnRef.current) {
      const textWords = worksTextRef.current.querySelectorAll('.works-word');
      const tlWorks = gsap.timeline({
        scrollTrigger: {
          trigger: worksTextRef.current,
          start: "top 85%",
          toggleActions: "play none none reverse"
        }
      });

      tlWorks.to(textWords, {
        y: "0%",
        duration: 0.6,
        stagger: 0.02,
        ease: "power3.out"
      })
      .fromTo(worksBtnRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
        "-=0.3"
      );
    }

    return () => {
      tl.kill();
      heroEl.removeEventListener("mousemove", handleMouseMove as any);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <main>
        <section className="hero-section relative flex flex-col items-center justify-center w-full min-h-screen overflow-hidden">
            {heroImages.map((image, index) => (
              <div 
                key={index}
                ref={(el) => {
                    imagesRef.current[index] = el;
                }}
                className={cn(
                  "absolute z-0 pointer-events-none w-[90px] h-[120px] md:w-[150px] md:h-[200px]",
                  index >= 6 && "hidden md:block"
                )}
                style={{
                  ...(image.top && { top: image.top }),
                  ...(image.bottom && { bottom: image.bottom }),
                  ...(image.left && { left: image.left }),
                  ...(image.right && { right: image.right }),
                }}
              >
                <Image
                  src={image.src}
                  alt={`Hero Image ${index + 1}`}
                  fill
                  className="rounded-xl object-cover shadow-2xl"
                  priority={index < 4}
                />
              </div>
            ))}

            <div className="relative z-10 flex flex-col items-center justify-center h-screen text-center mt-[-20vh]">
                <div className="flex items-center justify-center gap-6 md:gap-12">
                    <div className="w-4 h-4 md:w-8 md:h-8 rounded-full bg-primary"></div>
                    <h1 className="font-extrabold font-heading text-9xl text-center">GMAX</h1>
                    <div className="w-4 h-4 md:w-8 md:h-8 rounded-full bg-primary"></div>
                </div>
                <p ref={textRef} className="text-7xl font-heading text-center">CREATIVE</p>
                <div className="flex flex-wrap items-center gap-2 md:flex-row mt-12">
                    <Magnetic>
                        <Link
                            href="/book"
                            className={cn("inline-flex items-center gap-2")}
                        >
                            <span className={buttonVariants({ variant: "default", size: "lg" })}>Book Us</span>
                            <span className={buttonVariants({ variant: "default", size: "icon-lg" })}>
                                <ArrowUpRight size={20} />
                            </span>
                        </Link>
                    </Magnetic>
                </div>
            </div>
        </section>

        {/* Short About Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-32 md:py-48 flex flex-col md:flex-row gap-16 items-center">
          <div className="w-full md:w-1/2 flex flex-col gap-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div>
              <h2 className="text-xl md:text-2xl uppercase tracking-widest text-gray-400 font-medium">GMAX Studioz</h2>
            </div>
            <h3 className="text-4xl md:text-6xl font-heading font-bold leading-tight">
              We craft cinematic legacies.
            </h3>
            <p className="text-gray-400 text-lg md:text-xl leading-relaxed">
              We are a collective of visual storytellers, obsessed with capturing the raw emotion and undeniable beauty of every moment. From intimate portraits to grand celebrations, our lens finds the magic that others naturally miss.
            </p>
            <div className="mt-8">
              <Magnetic>
                <Link
                  href="/about"
                  className={cn("inline-flex items-center gap-2")}
                >
                  <span className={buttonVariants({ variant: "outline", size: "lg" })}>More About Us</span>
                  <span className={buttonVariants({ variant: "outline", size: "icon-lg" })}>
                    <ArrowUpRight size={20} />
                  </span>
                </Link>
              </Magnetic>
            </div>
          </div>
          <div className="w-full md:w-1/2 relative aspect-[4/3] rounded-[2rem] overflow-hidden group">
            <Image
              src="/works/image-10.jpg"
              alt="About GMAX"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-700"></div>
          </div>
        </section>

        <section className="w-full mb-60">
          <ServicesSection />
        </section>
        <section className="max-w-7xl mx-auto h-scree px-4">
          <div className="mb-15 flex items-center gap-2">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div>
            <h1 className="text-4xl font-heading font-bold">Our Works</h1>
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div>
          </div>

          <div ref={worksGridRef} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(portfolioItems.length > 0 ? portfolioItems : Array.from({ length: 8 }).map((_, i) => ({
              id: String(i),
              title: null,
              category: ["Wedding Photography", "Videography", "Events", "Commercial", "Portraits"][i % 5],
              r2Key: "",
              thumbnailKey: null,
              isPublished: true,
              sortOrder: i,
              _static: true,
              _src: `/works/image-${i + 1}.jpg`,
            } as any))).map((work: any, index: number) => {
              const isActive = activeWorkIndex === index;
              const imgSrc = work._static ? work._src : `${R2_PUBLIC_URL}/${work.r2Key}`;
              return (
                <div 
                  key={work.id} 
                  className="work-item group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
                  onClick={() => setActiveWorkIndex(isActive ? null : index)}
                >
                  <Image
                    src={imgSrc}
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
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col items-center gap-6 justify-center mt-16 bg-[#1f1f1f]/50 py-4 md:py-10 px-4 rounded-2xl">
            <p ref={worksTextRef} className="text-2xl md:text-4xl max-w-4xl text-center font-heading leading-snug">
              {footerWords.map((word, i) => (
                <span key={i} className="inline-block overflow-hidden relative mr-[0.25em] pb-2 -mb-2">
                  <span className="inline-block transform translate-y-full works-word">{word}</span>
                </span>
              ))}
            </p>
            <div ref={worksBtnRef}>
              <Magnetic>
                  <Link
                      href="/works"
                      className={cn("inline-flex items-center gap-2")}
                  >
                      <span className={buttonVariants({ variant: "secondary", size: "lg" })}>View All</span>
                      <span className={buttonVariants({ variant: "secondary", size: "icon-lg" })}>
                          <ArrowUpRight size={20} />
                      </span>
                  </Link>
              </Magnetic>
            </div>
          </div>
        </section>
  </main>
  );
}
