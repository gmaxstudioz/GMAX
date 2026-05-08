import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Book a Session — GMAX Studioz",
    description: "Browse studios and book your session online.",
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col">
            {/* Minimal Header */}
            <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3 sm:px-6">
                    <Link href="/" className="text-lg font-bold tracking-tight">
                        GMAX <span className="text-primary">Studioz</span>
                    </Link>
                    <a href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Sign In
                    </a>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Minimal Footer */}
            <footer className="border-t py-6">
                <p className="text-center text-xs text-muted-foreground">
                    © {new Date().getFullYear()} GMAX Studioz. All rights reserved.
                </p>
            </footer>
        </div>
    );
}
