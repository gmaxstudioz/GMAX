"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ServicesSection from "@/components/web/ServicesSection";

export default function AboutPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const missionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline();

    // Initial Hero Animation
    tl.fromTo(
      ".about-title span",
      { y: 150, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2, stagger: 0.1, ease: "power4.out" }
    ).fromTo(
      imageRef.current,
      { scale: 1.1, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1.5, ease: "power3.out" },
      "-=0.8"
    );

    // Scroll Animations for Mission Section
    if (missionRef.current) {
      gsap.fromTo(
        missionRef.current.querySelectorAll('.mission-text'),
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: missionRef.current,
            start: "top 80%",
          }
        }
      );
    }

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <main className="min-h-screen pt-32 pb-24 w-full">
      {/* Hero Section */}
      <section ref={heroRef} className="px-4 sm:px-6 md:px-20 max-w-[100rem] mx-auto mb-24">
        <h1 className="about-title text-[12vw] leading-none font-heading font-extrabold mb-12 flex flex-wrap gap-x-6 overflow-hidden">
          <span className="inline-block transform translate-y-full">THE</span>
          <span className="inline-block transform translate-y-full">VISION</span>
          <span className="inline-block text-primary italic transform translate-y-full">BEHIND</span>
          <span className="inline-block transform translate-y-full">
            GMAX
            <span className="text-primary">.</span>
          </span>
        </h1>
        
        <div ref={imageRef} className="relative w-full h-[60vh] md:h-[80vh] rounded-[2rem] overflow-hidden opacity-0">
          <Image 
            src="/works/image-2.jpg" 
            alt="About GMAX Studio" 
            fill 
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/30 mix-blend-multiply"></div>
        </div>
      </section>

      {/* Mission / Story Section */}
      <section ref={missionRef} className="px-4 sm:px-6 md:px-20 max-w-7xl mx-auto py-20 flex flex-col md:flex-row gap-16 items-start">
        <div className="w-full md:w-1/3">
          <div className="flex items-center gap-2 mb-6 mission-text opacity-0 transform translate-y-10">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div>
            <h2 className="text-xl md:text-2xl uppercase tracking-widest text-gray-400 font-medium">Our Story</h2>
          </div>
        </div>
        
        <div className="w-full md:w-2/3 flex flex-col gap-10">
          <p className="mission-text text-3xl md:text-5xl font-heading leading-tight opacity-0 transform translate-y-10">
            We are a collective of visual storytellers, obsessed with capturing the raw emotion and undeniable beauty of every moment.
          </p>
          
          <div className="mission-text grid grid-cols-1 md:grid-cols-2 gap-10 text-base md:text-lg text-gray-400 leading-relaxed opacity-0 transform translate-y-10">
            <p>
              Founded with a passion for excellence, GMAX Studioz has evolved into a premier destination for luxury videography and photography. We don't just point and shoot; we craft cinematic legacies. Whether it's an intimate portrait or a grand wedding, our lens finds the magic that others naturally miss.
            </p>
            <p>
              Our aesthetic is dark, premium, and inherently cinematic. We believe that true art lies in the shadows just as much as the light. By meticulously controlling every frame, we elevate standard moments into unforgettable masterpieces.
            </p>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="px-4 sm:px-6 md:px-20 max-w-7xl mx-auto py-20 mt-12 border-t border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col gap-4 group">
            <h3 className="text-4xl md:text-6xl font-heading font-bold text-gray-800 transition-colors duration-500 group-hover:text-white">01.</h3>
            <h4 className="text-2xl font-medium text-white mt-2">Cinematic Approach</h4>
            <p className="text-gray-400">Every project is treated like a feature film, utilizing state-of-the-art equipment and Hollywood-grade color grading techniques.</p>
          </div>
          <div className="flex flex-col gap-4 group">
            <h3 className="text-4xl md:text-6xl font-heading font-bold text-gray-800 transition-colors duration-500 group-hover:text-primary">02.</h3>
            <h4 className="text-2xl font-medium text-white mt-2">Uncompromising Quality</h4>
            <p className="text-gray-400">We obsess over the details. From pre-production to the final edit, excellence is not just a goal, it's our absolute standard.</p>
          </div>
          <div className="flex flex-col gap-4 group">
            <h3 className="text-4xl md:text-6xl font-heading font-bold text-gray-800 transition-colors duration-500 group-hover:text-white">03.</h3>
            <h4 className="text-2xl font-medium text-white mt-2">Authentic Emotion</h4>
            <p className="text-gray-400">Beyond technical perfection, we strive to capture the genuine, unscripted emotions that make your personal story uniquely yours.</p>
          </div>
        </div>
      </section>

      <section className="w-full">
        <ServicesSection />
      </section>

    </main>
  );
}
