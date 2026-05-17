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
                categories: {
                    include: {
                        services: {
                            where: { type: { not: "addon" } },
                        },
                    },
                },
                studioSessions: true,
            },
        });

        if (!studio) throw errors.NOT_FOUND({
            data: { resourceType: "Studio", resourceId: input.slug },
        });

        const addons = await prisma.service.findMany({
            where: { type: "addon", category: { studioId: studio.id } },
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
            categories: studio.categories.map((cat) => ({
                id: cat.id,
                name: cat.name,
                type: cat.type,
                services: cat.services.map((s) => ({
                    id: s.id,
                    name: s.name,
                    type: s.type,
                    description: s.description,
                    features: s.features,
                    price: s.price,
                    salePrice: s.salePrice,
                })),
            })),
            studioSessions: studio.studioSessions.map((ss) => ({
                id: ss.id,
                name: ss.name,
                duration: ss.duration,
            })),
            addons: addons.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                description: a.description,
                features: a.features,
                price: a.price,
                salePrice: a.salePrice,
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