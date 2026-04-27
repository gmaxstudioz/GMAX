"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Magnetic from '@/components/ui/magnetic';

export default function Footer() {
  return (
    <footer className="relative w-full bg-[#0a0a0a] text-white pt-24 pb-8 px-4 sm:px-6 mt-32 border-t border-white/10 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col gap-16">
        
        {/* Top Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-16">
          <div className="max-w-2xl">
            <h2 className="text-5xl md:text-7xl font-heading font-medium leading-tight mb-8">
              Ready to create something <span className="text-primary italic">extraordinary?</span>
            </h2>
            <Magnetic>
              <Link href="/book" className="inline-flex items-center gap-2 text-xl font-medium border-b-2 border-white pb-1 hover:text-gray-300 hover:border-gray-300 transition-colors">
                Let&apos;s Talk <ArrowUpRight size={24} />
              </Link>
            </Magnetic>
          </div>
          
          <div className="flex gap-12 md:gap-24 text-sm md:text-base font-medium">
            <div className="flex flex-col gap-4">
              <span className="text-gray-500 uppercase tracking-widest text-xs mb-2">Sitemap</span>
              <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
              <Link href="/about" className="hover:text-gray-300 transition-colors">About us</Link>
              <Link href="/works" className="hover:text-gray-300 transition-colors">Our Works</Link>
              <Link href="/shop" className="hover:text-gray-300 transition-colors">Shop</Link>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-gray-500 uppercase tracking-widest text-xs mb-2">Socials</span>
              <a href="https://web.facebook.com/gmaxstudioz" className="hover:text-gray-300 transition-colors flex items-center gap-2">Facebook<ArrowUpRight size={14} className="opacity-50"/></a>
              <a href="https://www.instagram.com/gmax_studioz" className="hover:text-gray-300 transition-colors flex items-center gap-2">Instagram <ArrowUpRight size={14} className="opacity-50"/></a>
              <a href="https://www.tiktok.com/@gmaxshotit" className="hover:text-gray-300 transition-colors flex items-center gap-2">TikTok <ArrowUpRight size={14} className="opacity-50"/></a>
              <a href="https://www.youtube.com/@gmaxstudioz1" className="hover:text-gray-300 transition-colors flex items-center gap-2">YouTube <ArrowUpRight size={14} className="opacity-50"/></a>
            </div>
          </div>
        </div>

        {/* Huge Logo text at the bottom */}
        <div className="w-full flex items-center justify-center mt-12 md:mt-20 pointer-events-none select-none">
          <h1 className="text-[13vw] leading-none font-extrabold font-heading text-primary/5 tracking-tighter">
            GMAX STUDIO
          </h1>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 text-xs md:text-sm text-gray-500">
          <p>© {new Date().getFullYear()} GMAX Studioz. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
