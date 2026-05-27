import { APP_NAME } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookingWizard } from "./_components/BookingWizard";
import Image from "next/image";

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const studio = await prisma.studio.findUnique({
        where: { slug },
        select: { name: true },
    });

    return {
        title: studio ? `Book at ${studio.name}` : "Book a Session",
        description: studio
            ? `Book a photography session at ${studio.name} — ${APP_NAME}`
            : "Book your session online",
    };
}

export default async function StudioBookPage({ params }: Props) {
    const { slug } = await params;

    const studio = await prisma.studio.findUnique({
        where: { slug },
        include: {
            services: {
                include: { studioSession: true, variants: true },
                where: { isAddon: false },
            },
            studioSessions: true,
        },
    });

    if (!studio) return notFound();

    // Get addons separately
    const addons = await prisma.service.findMany({
        where: { studioId: studio.id, isAddon: true },
        include: { variants: true },
    });

    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            {/* Studio Header */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 text-center sm:text-left">
                {studio.logo && (
                    <div className="h-16 w-16 rounded-2xl overflow-hidden border shadow-sm shrink-0">
                        <Image
                            src={`${r2PublicUrl}/${studio.logo}`}
                            alt={studio.name}
                            className="h-full w-full object-cover"
                        />
                    </div>
                )}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">{studio.name}</h1>
                    <p className="text-muted-foreground text-sm mt-1">Book your session online</p>
                </div>
            </div>

            <BookingWizard
                studioId={studio.id}
                categories={["PHOTOGRAPHY", "VIDEOGRAPHY", "OTHERS"].map(cat => ({
                    id: cat,
                    name: cat,
                    services: studio.services
                        .filter(s => s.category === cat && s.variants && s.variants.length > 0)
                        .map(s => ({
                            id: s.id,
                            name: s.name,
                            isAddon: s.isAddon,
                            basePrice: Number(s.variants.find(v => v.locationType.toUpperCase() !== "BOTH")?.basePrice ?? s.variants[0].basePrice),
                            bothVariantPrice: s.variants.find(v => v.locationType.toUpperCase() === "BOTH") ? Number(s.variants.find(v => v.locationType.toUpperCase() === "BOTH")!.basePrice) : null,
                            sessionDurationMins: s.variants[0]?.sessionDurationMins ?? 45,
                        })),
                }))}
                addons={addons
                    .filter(a => a.variants && a.variants.length > 0)
                    .map(a => ({
                        id: a.id,
                        name: a.name,
                        basePrice: Number(a.variants.find(v => v.locationType.toUpperCase() !== "BOTH")?.basePrice ?? a.variants[0].basePrice),
                    }))}
            />
        </div>
    );
}
