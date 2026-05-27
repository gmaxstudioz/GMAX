import { APP_NAME } from "@/lib/constants";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import NavBar from "@/components/web/NavBar";
import { ThemeProvider } from "@/components/web/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import Footer from "@/components/web/Footer";

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
  metadataBase: new URL("https://gmaxstudioz.com"),
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "We bring your ideas to life with stunning visuals and creative solutions. Masterfully blurring the line between reality and art.",
  keywords: ["photography", "videography", "creative studio", "portraits", "events", "GMAX"],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://gmaxstudioz.com",
    title: APP_NAME,
    description: "We bring your ideas to life with stunning visuals and creative solutions.",
    siteName: APP_NAME,
    images: [
      {
        url: "/gmax-logo.png",
        width: 1200,
        height: 630,
        alt: APP_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: "We bring your ideas to life with stunning visuals and creative solutions.",
    images: ["/gmax-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
            <NavBar />
            {children}
            <Footer />
            <Toaster richColors position="top-right" />
          </ThemeProvider>
      </body>
    </html>
  );
}
