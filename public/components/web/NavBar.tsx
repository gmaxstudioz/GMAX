"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { buttonVariants } from "../ui/button";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import Magnetic from "../ui/magnetic";

const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/works", label: "Our Work" },
    { href: "/shop", label: "Shop" },
];

export default function NavBar() {
    const isMobile = useIsMobile();
    const [menuOpen, setMenuOpen] = useState(false);

    const menuRef = useRef<HTMLElement>(null);
    const topBarRef = useRef<HTMLSpanElement>(null);
    const midBarRef = useRef<HTMLSpanElement>(null);
    const botBarRef = useRef<HTMLSpanElement>(null);
    const tlRef = useRef<gsap.core.Timeline | null>(null);

    // Animate hamburger bars into X and back
    const animateIcon = useCallback((open: boolean) => {
        const tl = gsap.timeline({ defaults: { duration: 0.3, ease: "power2.inOut" } });

        if (open) {
            tl.to(midBarRef.current, { opacity: 0, scaleX: 0, duration: 0.15 })
              .to(topBarRef.current, { y: 7, rotation: 45 }, 0.1)
              .to(botBarRef.current, { y: -7, rotation: -45 }, 0.1);
        } else {
            tl.to(topBarRef.current, { y: 0, rotation: 0 })
              .to(botBarRef.current, { y: 0, rotation: 0 }, 0)
              .to(midBarRef.current, { opacity: 1, scaleX: 1, duration: 0.15 }, 0.15);
        }
    }, []);

    // Animate mobile menu open/close
    useEffect(() => {
        if (!isMobile || !menuRef.current) return;

        const nav = menuRef.current;
        const links = nav.querySelectorAll(".mobile-nav-link");

        if (menuOpen) {
            // Open animation
            gsap.set(nav, { display: "flex", height: "auto" });
            const fullHeight = nav.scrollHeight;
            gsap.set(nav, { height: 0, opacity: 0 });

            tlRef.current = gsap.timeline();
            tlRef.current
                .to(nav, {
                    height: fullHeight,
                    opacity: 1,
                    duration: 0.4,
                    ease: "power3.out",
                })
                .fromTo(
                    links,
                    { opacity: 0, x: -20 },
                    { opacity: 1, x: 0, duration: 0.3, stagger: 0.06, ease: "power2.out" },
                    "-=0.2"
                );
        } else {
            // Close animation
            if (tlRef.current) tlRef.current.kill();
            gsap.to(nav, {
                height: 0,
                opacity: 0,
                duration: 0.3,
                ease: "power3.in",
                onComplete: () => {
                    gsap.set(nav, { display: "none" });
                },
            });
        }

        return () => {
            if (tlRef.current) tlRef.current.kill();
        };
    }, [menuOpen, isMobile]);

    const handleToggle = () => {
        const next = !menuOpen;
        animateIcon(next);
        setMenuOpen(next);
    };

    const handleLinkClick = () => {
        animateIcon(false);
        setMenuOpen(false);
    };

    return (
        <header className="fixed w-full z-50 backdrop-blur-md bg-background/80">
            {/* Top bar */}
            <div className="flex justify-between items-center py-4 px-6 md:px-20">
                <div className="flex items-center">
                    <Image
                        src="/gmax-logo.png"
                        alt="Gmax Logo"
                        width={40}
                        height={40}
                    />
                </div>

                {/* Desktop nav */}
                {!isMobile && (
                    <nav className="flex gap-10">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={buttonVariants({ variant: "link", size: "lg" })}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                )}

                {/* Desktop CTA */}
                {!isMobile && (
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
                )}

                {/* Mobile hamburger – custom 3-bar icon for GSAP morphing */}
                {isMobile && (
                    <button
                        onClick={handleToggle}
                        className="relative flex flex-col justify-center items-center w-10 h-10 gap-[5px] p-2 text-foreground"
                        aria-label="Toggle menu"
                    >
                        <span
                            ref={topBarRef}
                            className="block w-6 h-[2px] bg-foreground rounded-full origin-center"
                        />
                        <span
                            ref={midBarRef}
                            className="block w-6 h-[2px] bg-foreground rounded-full origin-center"
                        />
                        <span
                            ref={botBarRef}
                            className="block w-6 h-[2px] bg-foreground rounded-full origin-center"
                        />
                    </button>
                )}
            </div>

            {/* Mobile menu – always rendered, animated via GSAP */}
            {isMobile && (
                <nav
                    ref={menuRef}
                    className="flex-col gap-2 px-6 pb-6 overflow-hidden items-center"
                    style={{ display: "none", height: 0, opacity: 0 }}
                >
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn("mobile-nav-link", buttonVariants({ variant: "link", size: "lg" }))}
                            onClick={handleLinkClick}
                        >
                            {link.label}
                        </Link>
                    ))}
                    <Magnetic>
                        <Link
                            href="/contact"
                            className={cn("mobile-nav-link inline-flex items-center gap-2 mt-2")}
                            onClick={handleLinkClick}
                        >
                            <span className={buttonVariants({ variant: "default", size: "lg" })}>Book Us</span>
                            <span className={buttonVariants({ variant: "default", size: "icon-lg" })}>
                                <ArrowUpRight size={20} />
                            </span>
                        </Link>
                    </Magnetic>
                </nav>
            )}
        </header>
    );
}