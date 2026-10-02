"use client";
import { APP_NAME } from "@/lib/constants";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Share, Play, ArrowUpRight, Moon, Sun, Copy, X } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import Silk from "@/components/Silk";

const InstagramIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const FacebookIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);

const YoutubeIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2.5 7.1C2.6 5.9 3.5 5 4.7 4.9 8.2 4.6 15.8 4.6 19.3 4.9 20.5 5 21.4 5.9 21.5 7.1 21.8 9.5 21.8 14.5 21.5 16.9 21.4 18.1 20.5 19 19.3 19.1 15.8 19.4 8.2 19.4 4.7 19.1 3.5 19 2.6 18.1 2.5 16.9 2.2 14.5 2.2 9.5 2.5 7.1Z"/>
    <path d="M10 15L15 12L10 9V15Z"/>
  </svg>
);
import Magnetic from "@/components/ui/magnetic";

const links = [
  { href: "/", label: "GMAX OFFICIAL WEBSITE" },
  { href: "/book", label: "BOOK A SESSION HERE" },
  { href: "/academy", label: "ACADEMY" },
  { href: "/about", label: "ABOUT US" },
  { href: "/shop", label: "SHOP" },
];

export default function LinksPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  const handleShare = () => {
    setIsShareOpen(true);
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
      setIsShareOpen(false);
    }
  };

  return (
    <div className="min-h-screen text-foreground font-sans selection:bg-primary selection:text-primary-foreground relative overflow-hidden bg-background">
      {/* Silk Background */}
      <div className="absolute inset-0 z-0">
        {mounted && (
          <Silk 
            color={resolvedTheme === "dark" ? "#796000" : "#fff8da"} 
            speed={5}
            scale={1}
            
            noiseIntensity={1.5} 
          />
        )}
      </div>
      
      {/* Content wrapper with z-index to stay above background */}
      <div className="relative z-10 min-h-screen">
        {/* Top action buttons */}
      <div className="flex justify-between items-center p-6 w-full max-w-3xl mx-auto">
        <button 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-3 bg-muted hover:bg-accent rounded-full transition-colors flex items-center justify-center"
          aria-label="Toggle theme"
        >
          {mounted && theme === "dark" ? (
            <Sun size={20} className="text-foreground" />
          ) : (
            <Moon size={20} className="text-foreground" />
          )}
        </button>
        <button 
          onClick={handleShare}
          className="p-3 bg-muted hover:bg-accent rounded-full transition-colors flex items-center justify-center"
        >
          <Share size={20} className="text-foreground" />
        </button>
      </div>

      <main className="flex flex-col items-center px-4 w-full max-w-[680px] mx-auto pb-24">
        {/* Profile Section */}
        <div className="flex flex-col items-center mt-2">
          <div className="relative w-[100px] h-[100px] md:w-[120px] md:h-[120px] rounded-full overflow-hidden mb-4 border-2 border-transparent">
             <Image
              src="/gmax-logo.png"
              alt={APP_NAME}
              fill
              className="object-cover"
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-foreground mt-2 mb-6">
            {APP_NAME}
          </h1>

          {/* Social Icons */}
          <div className="flex items-center gap-6 mb-10">
            <a href="https://www.instagram.com/gmax_studioz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              <InstagramIcon size={30} strokeWidth={1.5} />
            </a>
            <a href="https://www.tiktok.com/@gmaxshotit" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              <Play size={30} strokeWidth={1.5} /> {/* Play as a fallback for TikTok */}
            </a>
            <a href="https://web.facebook.com/gmaxstudioz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              <FacebookIcon size={30} strokeWidth={1.5} />
            </a>
            <a href="https://www.youtube.com/@gmaxstudioz1" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              <YoutubeIcon size={30} strokeWidth={1.5} />
            </a>
          </div>
        </div>

        {/* Links */}
        <div className="w-full flex flex-col gap-4">
          {links.map((link, index) => (
            <Magnetic key={index}>
              <Link 
                href={link.href}
                className="group relative flex items-center justify-center w-full py-5 px-6 bg-card hover:bg-accent border border-border hover:scale-[1.02] transition-all duration-300 shadow-sm"
              >
                <span className="text-card-foreground group-hover:text-accent-foreground text-sm md:text-base font-bold tracking-widest uppercase">
                  {link.label}
                </span>
              </Link>
            </Magnetic>
          ))}
        </div>

        {/* Floating Action Button (Join GMAX on Links) */}
        <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="pointer-events-auto">
            <Magnetic>
              <Link 
                href="/book"
                className="flex items-center gap-3 bg-primary text-primary-foreground px-12 py-6 rounded-full text-xl font-bold shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 transition-transform"
              >
                Book Us Now <ArrowUpRight size={24} />
              </Link>
            </Magnetic>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full pb-32 pt-8 flex justify-center items-center gap-2 text-xs font-medium">
        <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        <span>•</span>
        <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        <span>•</span>
        <Link href="/" className="hover:text-foreground transition-colors">gmaxstudioz.com</Link>
      </footer>

      </div>
      {/* Share Dialog */}
      {isShareOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsShareOpen(false)}
              className="absolute top-4 right-4 p-2 bg-muted hover:bg-accent rounded-full transition-colors"
            >
              <X size={16} className="text-foreground" />
            </button>
            <h2 className="text-xl font-bold mb-4 text-foreground text-center">Share this page</h2>
            <p className="text-muted-foreground text-sm text-center mb-6">
              Share this link with others to easily connect to GMAX STUDIOZ.
            </p>
            <button 
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-4 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              <Copy size={18} />
              Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
