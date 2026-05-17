import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { BaseContext, optionalAuthMiddleware } from "./middleware";

const os = implement(contract).$context<BaseContext>();

export const getPublicPortfolio = os.portfolio.getPublic
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const where: any = { isPublished: true };

        if (input.category) {
            where.category = input.category;
        }

        const items = await prisma.portfolioItem.findMany({
            where,
            orderBy: { sortOrder: "asc" },
            select: {
                id: true,
                title: true,
                category: true,
                r2Key: true,
                thumbnailKey: true,
                isPublished: true,
                sortOrder: true,
            },
        });

        // Get distinct categories from published items
        const allPublished = await prisma.portfolioItem.findMany({
            where: { isPublished: true },
            select: { category: true },
            distinct: ["category"],
        });
        const categories = allPublished.map((i) => i.category).sort();

        return { items, categories };
    });
