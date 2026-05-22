import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Raleway, Playfair_Display } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/web/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const playfairDisplayHeading = Playfair_Display({subsets:['latin'],variable:'--font-heading'});

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "GMAX Studioz — Studio Management Platform",
    template: "%s | GMAX Studioz",
  },
  description:
    "GMAX Studioz is a professional studio management platform for booking sessions, managing clients, and growing your creative business.",
  keywords: [
    "studio management",
    "booking platform",
    "creative studio",
    "session booking",
    "GMAX Studioz",
  ],
  authors: [{ name: "GMAX Studioz" }],
  creator: "GMAX Studioz",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "GMAX Studioz",
    title: "GMAX Studioz — Studio Management Platform",
    description:
      "Professional studio management platform for booking sessions, managing clients, and growing your creative business.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GMAX Studioz — Studio Management Platform",
    description:
      "Professional studio management platform for booking sessions, managing clients, and growing your creative business.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable, playfairDisplayHeading.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </ThemeProvider>
      </body>
    </html>
  );
}
