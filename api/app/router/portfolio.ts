import { db } from "@/lib/db";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { BaseContext, optionalAuthMiddleware } from "./middleware";
import { eq } from "drizzle-orm";
import { portfolioItem } from "@/lib/schema";

const os = implement(contract).$context<BaseContext>();

export const getPublicPortfolio = os.portfolio.getPublic
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const items = await db.query.portfolioItem.findMany({
            where: (item, { and, eq }) => {
                const conditions = [eq(item.isPublished, true)];
                if (input.category) conditions.push(eq(item.category, input.category));
                return and(...conditions);
            },
            orderBy: (item, { asc }) => [asc(item.sortOrder)],
            columns: {
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
        const allPublished = await db.selectDistinct({ category: portfolioItem.category })
            .from(portfolioItem)
            .where(eq(portfolioItem.isPublished, true));
        
        const categories = allPublished.map((i) => i.category!).sort();

        return { items, categories };
    });
