import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookingWizard } from "./_components/BookingWizard";
import Image from "next/image";

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const studio: any = await db.query.studio.findFirst({
        where: (s, { eq }) => eq(s.slug, slug),
        columns: { name: true },
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

    const studio: any = await db.query.studio.findFirst({
        where: (s, { eq }) => eq(s.slug, slug),
        with: {
            services: {
                with: { studioSession: true, serviceVariants: true },
            },
            studioSessions: true,
            bookings: {
                where: (b, { gte, not, and, eq }) => and(
                    gte(b.bookingDate, new Date().toISOString()),
                    not(eq(b.bookingStatus, "CANCELLED"))
                ),
                with: {
                    service: { with: { studioSession: true } },
                },
            },
        },
    });

    if (!studio) return notFound();

    // Get addons separately
    const addons: any = await db.query.service.findMany({
        where: (s, { eq, and }) => and(eq(s.studioId, studio.id), eq(s.isAddon, true)),
        with: { serviceVariants: true },
    });

    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

    // Serialize dates for client
    const serializedBookings = studio.bookings.map((b: any) => ({
        id: b.id,
        bookingDate: typeof b.bookingDate === 'string' ? b.bookingDate : new Date(b.bookingDate).toISOString(),
        sessionCount: b.sessionCount,
        service: b.service ? {
            studioSession: b.service.studioSession ? {
                duration: b.service.studioSession.duration,
            } : null,
        } : null,
    }));

    const categoriesMap = new Map();
    for (const s of studio.services) {
        if (s.isAddon) continue;
        const catName = s.category;
        if (!categoriesMap.has(catName)) {
            categoriesMap.set(catName, {
                id: catName,
                name: catName,
                services: [],
            });
        }
        categoriesMap.get(catName).services.push(s);
    }
    const studioCategories = Array.from(categoriesMap.values());

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
                categories={studioCategories.map(c => ({
                    id: c.id,
                    name: c.name,
                    services: c.services
                        .filter((s: any) => s.serviceVariants && s.serviceVariants.length > 0)
                        .map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            isAddon: s.isAddon,
                            basePrice: Number(s.serviceVariants[0].basePrice),
                            studioSession: s.studioSession ? { duration: s.studioSession.duration } : null,
                        })),
                }))}
                addons={addons
                    .filter((a: any) => a.serviceVariants && a.serviceVariants.length > 0)
                    .map((a: any) => ({
                        id: a.id,
                        name: a.name,
                        basePrice: Number(a.serviceVariants[0].basePrice),
                    }))}
                existingBookings={serializedBookings}
                paystackPublicKey={paystackPublicKey}
            />
        </div>
    );
}
