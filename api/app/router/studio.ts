import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { optionalAuthMiddleware, BaseContext } from "./middleware";
import { contract } from "../contract";

const os = implement(contract).$context<BaseContext>();

export const getStudioBySlug = os.studio.getBySlug
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const studio = await prisma.studio.findUnique({
            where: { slug: input.slug },
            include: {
                services: {
                    where: { isAddon: false }, // Updated query
                    include: { studioSession: true, variants: { include: { deliverables: true } } }, // Include variants & deliverables
                },
                studioSessions: true,
            },
        });

        if (!studio) throw errors.NOT_FOUND({
            data: { resourceType: "Studio", resourceId: input.slug },
        });

        const addons = await prisma.service.findMany({
            where: { isAddon: true, studioId: studio.id }, // Updated query
            include: { studioSession: true, variants: { include: { deliverables: true } } }, // Include variants & deliverables
        });

        return {
            id: studio.id,
            name: studio.name,
            slug: studio.slug,
            logo: (studio.logo && studio.logo.length > 0) ? studio.logo : null,
            metadata: (() => {
                const raw = studio.metadata;
                if (raw == null) return null;
                if (typeof raw === 'string') {
                    try { return JSON.parse(raw); } catch { return null; }
                }
                return raw as Record<string, unknown>;
            })(),
            createdAt: studio.createdAt.toISOString(),
            updatedAt: studio.updatedAt.toISOString(),
            categories: (["PHOTOGRAPHY", "VIDEOGRAPHY", "OTHERS"] as const).map((cat) => ({
                id: cat,
                name: cat.charAt(0) + cat.slice(1).toLowerCase(),
                type: cat,
                services: studio.services.filter(s => s.category === cat).map((s) => ({
                    id: s.id,
                    name: s.name,
                    category: s.category,
                    isAddon: s.isAddon, // Updated mapping
                    description: s.description,
                    features: s.features,
                    variants: s.variants.map((v) => ({
                        id: v.id,
                        locationType: v.locationType,
                        basePrice: v.basePrice.toString(), // Convert Prisma Decimal to string
                        maxPrice: v.maxPrice ? v.maxPrice.toString() : null,
                        sessionDurationMins: v.sessionDurationMins,
                        logisticsIncluded: v.logisticsIncluded,
                        deliverables: v.deliverables.map((d) => ({
                            id: d.id,
                            label: d.label,
                            quantity: d.quantity,
                            detail: d.detail,
                            isFree: d.isFree
                        }))
                    }))
                })),
            })).filter(c => c.services.length > 0),
            studioSessions: studio.studioSessions.map((ss) => ({
                id: ss.id,
                name: ss.name,
                duration: ss.duration,
            })),
            addons: addons.map((a) => ({
                id: a.id,
                name: a.name,
                category: a.category,
                isAddon: a.isAddon, // Updated mapping
                description: a.description,
                features: a.features,
                variants: a.variants.map((v) => ({
                    id: v.id,
                    locationType: v.locationType,
                    basePrice: v.basePrice.toString(), // Convert Prisma Decimal to string
                    maxPrice: v.maxPrice ? v.maxPrice.toString() : null,
                    sessionDurationMins: v.sessionDurationMins,
                    logisticsIncluded: v.logisticsIncluded,
                    deliverables: v.deliverables.map((d) => ({
                        id: d.id,
                        label: d.label,
                        quantity: d.quantity,
                        detail: d.detail,
                        isFree: d.isFree
                    }))
                }))
            })),
        };
    });

export const getAllStudios = os.studio.getAll
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const page = input.page || 1;
        const perPage = input.perPage || 20;
        
        const [studios, total] = await Promise.all([
            prisma.studio.findMany({
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: { createdAt: "desc" },
                include: {
                    _count: {
                        select: { members: true, bookings: true }
                    }
                }
            }),
            prisma.studio.count()
        ]);

        const pageCount = Math.ceil(total / perPage);
        
        return {
            items: studios.map(s => ({
                id: s.id,
                name: s.name,
                slug: s.slug,
                logo: (s.logo && s.logo.length > 0) ? s.logo : null,
                metadata: (() => {
                    const raw = s.metadata;
                    if (raw == null) return null;
                    if (typeof raw === 'string') {
                        try { return JSON.parse(raw); } catch { return null; }
                    }
                    return raw as Record<string, unknown>;
                })(),
                createdAt: s.createdAt.toISOString(),
                updatedAt: s.updatedAt.toISOString(),
                _count: s._count,
            })),
            meta: {
                total,
                page,
                perPage,
                pageCount,
                hasNextPage: page < pageCount,
                hasPreviousPage: page > 1,
            }
        };
    });