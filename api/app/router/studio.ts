import { db } from "@/lib/db";
import { implement } from "@orpc/server";
import { optionalAuthMiddleware, BaseContext } from "./middleware";
import { contract } from "../contract";
import { eq, sql } from "drizzle-orm";
import { studio } from "@/lib/schema";

const os = implement(contract).$context<BaseContext>();

export const getStudioBySlug = os.studio.getBySlug
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const foundStudio = await db.query.studio.findFirst({
            where: (studio, { eq }) => eq(studio.slug, input.slug),
            with: {
                services: {
                    where: (service, { eq }) => eq(service.isAddon, false),
                    with: { studioSession: true, serviceVariants: { with: { serviceDeliverables: true } } },
                },
                studioSessions: true,
            },
        });

        if (!foundStudio) throw errors.NOT_FOUND({
            data: { resourceType: "Studio", resourceId: input.slug },
        });

        const addons = await db.query.service.findMany({
            where: (service, { and, eq }) => and(eq(service.isAddon, true), eq(service.studioId, foundStudio.id)),
            with: { studioSession: true, serviceVariants: { with: { serviceDeliverables: true } } },
        });

        return {
            id: foundStudio.id,
            name: foundStudio.name,
            slug: foundStudio.slug,
            logo: (foundStudio.logo && foundStudio.logo.length > 0) ? foundStudio.logo : null,
            metadata: (() => {
                const raw = foundStudio.metadata;
                if (raw == null) return null;
                if (typeof raw === 'string') {
                    try { return JSON.parse(raw); } catch { return null; }
                }
                return raw as Record<string, unknown>;
            })(),
            createdAt: new Date(foundStudio.createdAt).toISOString(),
            updatedAt: new Date(foundStudio.updatedAt).toISOString(),
            categories: Array.from(new Set(foundStudio.services.map(s => s.category))).map((catName) => ({
                id: catName,
                name: catName,
                type: catName,
                services: foundStudio.services.filter(s => s.category === catName).map((s) => ({
                    id: s.id,
                    name: s.name,
                    isAddon: s.isAddon,
                    description: s.description,
                    features: s.features || [],
                    discountPercentage: s.discountPercentage || 0,
                    variants: s.serviceVariants.map((v) => ({
                        id: v.id,
                        locationType: v.locationType,
                        basePrice: v.basePrice.toString(),
                        maxPrice: v.maxPrice ? v.maxPrice.toString() : null,
                        sessionDurationMins: v.sessionDurationMins,
                        logisticsIncluded: v.logisticsIncluded,
                        deliverables: v.serviceDeliverables.map((d) => ({
                            id: d.id,
                            label: d.label,
                            quantity: d.quantity,
                            detail: d.detail,
                            isFree: d.isFree
                        }))
                    }))
                })),
            })),
            studioSessions: foundStudio.studioSessions.map((ss) => ({
                id: ss.id,
                name: ss.name,
                duration: ss.duration,
            })),
            addons: addons.map((a) => ({
                id: a.id,
                name: a.name,
                isAddon: a.isAddon,
                description: a.description,
                features: a.features || [],
                discountPercentage: a.discountPercentage || 0,
                variants: a.serviceVariants.map((v) => ({
                    id: v.id,
                    locationType: v.locationType,
                    basePrice: v.basePrice.toString(),
                    maxPrice: v.maxPrice ? v.maxPrice.toString() : null,
                    sessionDurationMins: v.sessionDurationMins,
                    logisticsIncluded: v.logisticsIncluded,
                    deliverables: v.serviceDeliverables.map((d) => ({
                        id: d.id,
                        label: d.label,
                        quantity: d.quantity,
                        detail: d.detail,
                        isFree: d.isFree
                    }))
                }))
            })),
        } as any;
    });

export const getAllStudios = os.studio.getAll
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const page = input.page || 1;
        const perPage = input.perPage || 20;
        
        const countResult = await db.select({ total: sql<number>`count(*)::int` }).from(studio);
        const total = countResult[0].total;

        const studios = await db.query.studio.findMany({
            offset: (page - 1) * perPage,
            limit: perPage,
            orderBy: (studio, { desc }) => [desc(studio.createdAt)],
            extras: {
                membersCount: sql<number>`(SELECT count(*)::int FROM "member" WHERE "member"."studioId" = "studio"."id")`.as("membersCount"),
                bookingsCount: sql<number>`(SELECT count(*)::int FROM "booking" WHERE "booking"."studioId" = "studio"."id")`.as("bookingsCount"),
            }
        });

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
                createdAt: new Date(s.createdAt).toISOString(),
                updatedAt: new Date(s.updatedAt).toISOString(),
                _count: {
                    members: Number(s.membersCount || 0),
                    bookings: Number(s.bookingsCount || 0)
                },
            })),
            meta: {
                total,
                page,
                perPage,
                pageCount,
                hasNextPage: page < pageCount,
                hasPreviousPage: page > 1,
            }
        } as any;
    });