"use client";

import React, { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import Image from "next/image";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const servicesData = [
  {
    id: "videography",
    title: "Videography",
    description: "We craft cinematic visual stories that capture the essence of your brand. From promotional campaigns to event coverage, our high-quality video production engages your audience and brings your vision to life on screen. Ideal for weddings, birthday, party, events.",
    media: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    type: "video",
  },
  {
    id: "photography",
    title: "Photography",
    description: "We freeze moments in time with stunning clarity and artistic direction. Whether it's product photography, lifestyle shoots, or corporate portraits, we deliver scroll-stopping imagery that elevates your visual presence. Ideal for weddings, birthday, party, events.",
    media: "/works/image-17.jpg",
    type: "image",
  },
];

export default function ServicesSection() {
  const [hoveredService, setHoveredService] = useState<string | null>(null);
  const [activeService, setActiveService] = useState<string | null>(null);

  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    const xTo = gsap.quickTo(el, "left", { duration: 0.5, ease: "power3" });
    const yTo = gsap.quickTo(el, "top", { duration: 0.5, ease: "power3" });

    const handleMouseMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section className="relative w-full max-w-7xl mx-auto h-auto py-24 px-4 sm:px-6 flex flex-col gap-9">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div>
        <h1 className="text-4xl font-heading font-bold">What we do</h1>
        <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div>
      </div>
      <div className="flex flex-col gap-4">
        {servicesData.map((service) => {
          const isHovered = hoveredService === service.id;
          const isActive = activeService === service.id;

          return (
            <div
              key={service.id}
              className={cn(
                "group relative flex flex-col w-full overflow-hidden transition-all duration-500 ease-out cursor-pointer p-4 md:p-6",
                isActive ? "bg-[#1f1f1f] rounded-xl" : isHovered ? "bg-[#1f1f1f] rounded-xl" : "bg-transparent rounded-xl"
              )}
              onMouseEnter={() => setHoveredService(service.id)}
              onMouseLeave={() => setHoveredService(null)}
              onClick={() => setActiveService(isActive ? null : service.id)}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  {/* Inline Thumbnail */}
                  <div
                    className={cn(
                      "relative overflow-hidden transition-all duration-500 ease-out flex-shrink-0",
                      isActive
                        ? "w-16 h-16 rounded-xl md:w-20 md:h-20"
                        : "w-20 h-10 rounded-full md:w-24 md:h-12"
                    )}
                  >
                    {service.type === "video" ? (
                      <video
                        src={service.media}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image
                        src={service.media}
                        alt={service.title}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <h3 className="text-3xl md:text-7xl font-medium tracking-tight text-white">{service.title}</h3>
                </div>

                <div className="text-white flex-shrink-0 flex items-center justify-center w-10 h-10">
                  {isActive ? <Minus size={44} /> : <Plus size={44} />}
                </div>
              </div>

              {/* Expandable Content */}
              <div
                className={cn(
                  "grid transition-all duration-500 ease-out",
                  isActive ? "grid-rows-[1fr] opacity-100 mt-6" : "grid-rows-[0fr] opacity-0 mt-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Mobile Media (hidden on desktop because desktop uses cursor tracker) */}
                    <p className="text-gray-300 text-lg md:text-xl max-w-2xl leading-relaxed">
                      {service.description}
                    </p>
                    <div className="w-full h-48 relative rounded-xl overflow-hidden md:hidden">
                      {service.type === "video" ? (
                        <video
                          src={service.media}
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Image
                          src={service.media}
                          alt={service.title}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Cursor Tracking Preview */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 z-50 hidden md:block w-72 h-96 rounded-2xl overflow-hidden"
        style={{
          transform: "translate(-50%, -50%)",
          opacity: hoveredService && !activeService ? 1 : 0,
          scale: hoveredService && !activeService ? 1 : 0.5,
          transition: "opacity 0.3s ease, scale 0.3s ease",
        }}
      >
        {hoveredService && (
          <div className="relative w-full h-full">
            {servicesData.find((s) => s.id === hoveredService)?.type === "video" ? (
              <video
                src={servicesData.find((s) => s.id === hoveredService)?.media}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={servicesData.find((s) => s.id === hoveredService)?.media || ""}
                alt="Preview"
                fill
                className="object-cover"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
