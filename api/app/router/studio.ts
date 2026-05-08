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
            logo: studio.logo,
            metadata: studio.metadata as Record<string, unknown> | null,
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