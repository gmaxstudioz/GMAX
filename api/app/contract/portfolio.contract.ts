import { baseContract } from "./errors";
import { z } from "zod";

const PortfolioItemOutputSchema = z.object({
    id: z.string(),
    title: z.string().nullable(),
    category: z.string(),
    r2Key: z.string(),
    thumbnailKey: z.string().nullable(),
    isPublished: z.boolean(),
    sortOrder: z.number(),
});

const PortfolioListOutputSchema = z.object({
    items: z.array(PortfolioItemOutputSchema),
    categories: z.array(z.string()),
});

export const GetPublicPortfolioContract = baseContract
    .route({
        method: "GET",
        path: "/portfolio",
        successStatus: 200,
        summary: "Get published portfolio items",
        description: "Get all published portfolio items for the public works page.",
        tags: ["Portfolio"],
    })
    .input(z.object({
        category: z.string().optional(),
    }))
    .output(PortfolioListOutputSchema);
