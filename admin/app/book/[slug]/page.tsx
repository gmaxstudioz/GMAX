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
            ? `Book a photography session at ${studio.name} — GMAX Studioz`
            : "Book your session online",
    };
}

export default async function StudioBookPage({ params }: Props) {
    const { slug } = await params;

    const studio = await prisma.studio.findUnique({
        where: { slug },
        include: {
            categories: {
                include: {
                    services: {
                        include: { studioSession: true },
                        where: { type: { not: "addon" } },
                    },
                },
            },
            studioSessions: true,
            bookings: {
                where: {
                    bookingDate: { gte: new Date() },
                    bookingStatus: { not: "CANCELLED" },
                },
                include: {
                    service: { include: { studioSession: true } },
                },
            },
        },
    });

    if (!studio) return notFound();

    // Get addons separately
    const addons = await prisma.service.findMany({
        where: { category: { studioId: studio.id }, type: "addon" },
    });

    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

    // Serialize dates for client
    const serializedBookings = studio.bookings.map(b => ({
        id: b.id,
        bookingDate: b.bookingDate.toISOString(),
        sessionCount: b.sessionCount,
        service: b.service ? {
            studioSession: b.service.studioSession ? {
                duration: b.service.studioSession.duration,
            } : null,
        } : null,
    }));

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
                categories={studio.categories.map(c => ({
                    id: c.id,
                    name: c.name,
                    services: c.services.map(s => ({
                        id: s.id,
                        name: s.name,
                        type: s.type,
                        price: s.price,
                        salePrice: s.salePrice,
                        studioSession: s.studioSession ? { duration: s.studioSession.duration } : null,
                    })),
                }))}
                addons={addons.map(a => ({
                    id: a.id,
                    name: a.name,
                    price: a.price,
                    salePrice: a.salePrice,
                }))}
                existingBookings={serializedBookings}
                paystackPublicKey={paystackPublicKey}
            />
        </div>
    );
}
