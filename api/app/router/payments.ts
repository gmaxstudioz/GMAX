// router/payments.ts
import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { BaseContext, optionalAuthMiddleware } from "./middleware";

const os = implement(contract).$context<BaseContext>();

export const verifyPurchase = os.payment.verifyPurchase
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const payment = await prisma.payment.findUnique({
            where: { paystackReference: input.reference },
            include: {
                productAccess: true,
            },
        });

        if (!payment || payment.status !== "PAID") {
            return { verified: false };
        }

        return {
            verified: true,
            buyerId: payment.productAccess?.buyerId,
        };
    });