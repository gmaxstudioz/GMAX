import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRightIcon, CameraIcon, MapPinIcon } from "lucide-react";
import { StudioMetadata } from "@/lib/schemas/studio";
import Image from "next/image";

export default async function BookPage() {
    const studios = await prisma.studio.findMany({
        select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            metadata: true,
            _count: {
                select: { categories: true, members: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            {/* Hero */}
            <div className="text-center mb-10 sm:mb-14 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">
                    <CameraIcon className="h-3.5 w-3.5" />
                    Book Online
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                    Book Your Perfect Session
                </h1>
                <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
                    Choose a studio, pick your service, and book in minutes. Professional results guaranteed.
                </p>
            </div>

            {/* Studio Grid */}
            {studios.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <CameraIcon className="h-12 w-12 mx-auto opacity-30 mb-4" />
                    <p className="text-lg">No studios available yet</p>
                    <p className="text-sm mt-1">Check back soon!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {studios.map(studio => {
                        const meta = studio.metadata as StudioMetadata;
                        return (
                            <Link
                                key={studio.id}
                                href={`/book/${studio.slug}`}
                                className="group"
                            >
                                <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-primary/30">
                                    {/* Logo */}
                                    <div className="h-40 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden rounded-t-xl">
                                        {studio.logo ? (
                                            <Image
                                                src={`${r2PublicUrl}/${studio.logo}`}
                                                alt={studio.name}
                                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="text-3xl font-bold text-muted-foreground/30">
                                                {studio.name.slice(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {studio.name}
                                            <ArrowRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                        </CardTitle>
                                        {meta?.address && (
                                            <CardDescription className="flex items-center gap-1">
                                                <MapPinIcon className="h-3 w-3" />
                                                {meta.address}
                                            </CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-2">
                                            <Badge variant="secondary" className="text-xs">
                                                {studio._count.categories} {studio._count.categories === 1 ? "category" : "categories"}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                {studio._count.members} staff
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
