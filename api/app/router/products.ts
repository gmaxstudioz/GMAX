import { contract } from "@/app/contract";
import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { authMiddleware, optionalAuthMiddleware, BaseContext } from "./middleware";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { getPresignedUrl } from "@/lib/r2";

const os = implement(contract).$context<BaseContext>();

function generateReceiptNumber(): string {
    return `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

function effectivePrice(price: number, salePrice: number | null | undefined): number {
    return salePrice != null ? salePrice : price;
}

async function mapProductToOutput(data: {
    id: string;
    title: string;
    description: string;
    price: number;
    salePrice: number | null;
    categoryId: string | null;
    category: { id: string; name: string; slug: string } | null;
    r2Key: string | null;
    fileName: string | null;
    fileSize: number | null;
    mimeType: string | null;
    thumbnailKey: string | null;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
}, includeDownloadUrl = false) {
    const thumbnailSignedUrl = data.thumbnailKey
        ? await getPresignedUrl(data.thumbnailKey, 3600) // 1 hour for thumbnails
        : null;

    // Only generate the actual file URL when explicitly requested
    // — never on list views
    const signedUrl = (includeDownloadUrl && data.r2Key)
        ? await getPresignedUrl(data.r2Key, 600) // 10 minutes for downloads
        : null;

    return {
        id: data.id,
        title: data.title,
        description: data.description,
        price: data.price,
        salePrice: data.salePrice,
        categoryId: data.categoryId,
        category: data.category,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        isPublished: data.isPublished,
        createdAt: data.createdAt.toISOString(),
        updatedAt: data.updatedAt.toISOString(),
        signedUrl,
        thumbnailSignedUrl,
    };
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export const createProduct = os.product.create
    .use(authMiddleware)
    .handler(async ({ input, errors }) => {
        const existing = await prisma.product.findFirst({
            where: { title: { equals: input.title, mode: "insensitive" } },
        });
        if (existing) throw errors.BAD_REQUEST({
            message: "A product with this title already exists.",
        });

        const data = await prisma.product.create({ data: input, include: { category: true } });
        return mapProductToOutput(data);
    });

export const deleteProduct = os.product.delete
    .use(authMiddleware)
    .handler(async ({ input, errors }) => {
        const existing = await prisma.product.findUnique({ where: { id: input.productId } });
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Product", resourceId: input.productId } });

        await prisma.product.delete({ where: { id: input.productId } });
        return { id: input.productId, deleted: true as const };
    });


export const updateProduct = os.product.update
    .use(authMiddleware)
    .handler(async ({ input, errors }) => {
        const { productId, ...updateData } = input;
        const existing = await prisma.product.findUnique({ where: { id: productId } });
        if (!existing) throw errors.NOT_FOUND({
            data: { resourceType: "Product", resourceId: productId },
        });

        const data = await prisma.product.update({
            where: { id: productId },
            data: updateData,
            include: { category: true },
        });
        return mapProductToOutput(data);
    });

export const getProductById = os.product.getById
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const data = await prisma.product.findUnique({
            where: { id: input.productId, isPublished: true },
            include: { category: true },
        });
        if (!data) throw errors.NOT_FOUND({
            data: { resourceType: "Product", resourceId: input.productId },
        });
        return mapProductToOutput(data, false);
    });

export const getAllProducts = os.product.getAll
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const { page, perPage } = input;
        const where = { isPublished: true };

        const [total, items] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                include: { category: true },
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: { createdAt: "desc" },
            }),
        ]);

        const pageCount = Math.ceil(total / perPage);
        return {
            items: await Promise.all(items.map(p => mapProductToOutput(p, false))),
            meta: {
                total, page, perPage, pageCount,
                hasNextPage: page < pageCount,
                hasPreviousPage: page > 1,
            },
        };
    });


// ── Purchase Flow ─────────────────────────────────────────────────────────────

export const purchaseProduct = os.product.purchase
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const product = await prisma.product.findUnique({
            where: { id: input.productId, isPublished: true },
        });
        if (!product) throw errors.NOT_FOUND({
            data: { resourceType: "Product", resourceId: input.productId },
        });

        // Find or create buyer
        let buyer = await prisma.buyer.findFirst({
            where: { email: input.buyerEmail },
        });

        if (!buyer) {
            buyer = await prisma.buyer.create({
                data: {
                    name: input.buyerName,
                    email: input.buyerEmail,
                    phone: input.buyerPhone,
                },
            });
        } else {
            // Update returning buyer's info if they provide new details
            const updates: Record<string, string> = {};
            if (input.buyerName && input.buyerName !== buyer.name) updates.name = input.buyerName;
            if (input.buyerPhone && input.buyerPhone !== buyer.phone) updates.phone = input.buyerPhone;
            if (Object.keys(updates).length > 0) {
                buyer = await prisma.buyer.update({
                    where: { id: buyer.id },
                    data: updates,
                });
            }
        }

        // Guard: already purchased and access hasn't expired
        const existingAccess = await prisma.productAccess.findUnique({
            where: { productId_buyerId: { productId: product.id, buyerId: buyer.id } },
        });
        if (existingAccess) throw errors.BAD_REQUEST({
            message: "You already have access to this product.",
        });

        const amount = effectivePrice(product.price, product.salePrice);
        const reference = `gmax-shop-${uuidv4().slice(0, 8)}`;
        const receiptNumber = generateReceiptNumber();

        await prisma.payment.create({
            data: {
                amount,
                method: "TRANSFER",
                status: "PENDING",
                paystackReference: reference,
                receiptNumber,
                recordedById: null,
                paystackResponse: {
                    pendingProduct: { title: product.title },
                    pendingBuyer: { name: buyer.name, email: buyer.email },
                    productId: product.id,
                    buyerId: buyer.id,
                },
            },
        });

        return {
            paymentUrl: null,
            reference,
            amount,
            buyerId: buyer.id,
        };
    });

// ── Magic Link Flow ───────────────────────────────────────────────────────────

export const requestAccessLink = os.product.requestAccessLink
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const buyer = await prisma.buyer.findUnique({
            where: { email: input.email },
        });

        // Always return { sent: true } — don't reveal whether email exists
        if (!buyer) return { sent: true };

        const token = generateToken();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await prisma.buyerAccessToken.create({
            data: { buyerId: buyer.id, token, expiresAt, used: false },
        });

        // TODO: send email with magic link
        // await sendMagicLinkEmail(buyer.email, token);
        console.log(`[Shop] Magic link for ${buyer.email}: ${process.env.PORTAL_URL}/shop/access?token=${token}`);

        return { sent: true };
    });

export const verifyAccessToken = os.product.verifyAccessToken
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const record = await prisma.buyerAccessToken.findUnique({
            where: { token: input.token },
            include: { buyer: { include: { purchases: { include: { product: true } } } } },
        });

        if (!record || record.used || record.expiresAt < new Date()) {
            throw errors.UNAUTHORIZED({ message: "Invalid or expired access link." });
        }

        // Mark magic link token as used
        await prisma.buyerAccessToken.update({
            where: { id: record.id },
            data: { used: true },
        });

        // Issue a new short-lived session token for download requests
        const sessionToken = generateToken();
        await prisma.buyerAccessToken.create({
            data: {
                buyerId: record.buyerId,
                token: sessionToken,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                used: false,
            },
        });

        return {
            buyerId: record.buyerId,
            sessionToken, // frontend stores this in memory, sends with download requests
            purchases: record.buyer.purchases.map((p) => ({
                productId: p.productId,
                productTitle: p.product.title,
                downloadCount: p.downloadCount,
                expiresAt: p.expiresAt ?? null,
                grantedAt: p.grantedAt,
            })),
        };
    });

// ── Download Flow ─────────────────────────────────────────────────────────────

export const requestDownload = os.product.requestDownload
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        // Verify session token
        const tokenRecord = await prisma.buyerAccessToken.findUnique({
            where: { token: input.token },
        });

        if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < new Date()) {
            throw errors.UNAUTHORIZED({ message: "Invalid or expired session." });
        }

        // Verify buyer has access to this product
        const access = await prisma.productAccess.findUnique({
            where: {
                productId_buyerId: {
                    productId: input.productId,
                    buyerId: tokenRecord.buyerId,
                },
            },
            include: { product: true },
        });

        if (!access) throw errors.FORBIDDEN({ message: "You do not have access to this product." });
        if (access.expiresAt && access.expiresAt < new Date()) {
            throw errors.FORBIDDEN({ message: "Your access to this product has expired." });
        }
        if (!access.product.r2Key) {
            throw errors.BAD_REQUEST({ message: "Product file is not available yet." });
        }

        // Update download count
        await prisma.productAccess.update({
            where: { id: access.id },
            data: {
                downloadCount: { increment: 1 },
                lastDownloadAt: new Date(),
            },
        });

        const downloadUrl = await getPresignedUrl(access.product.r2Key, 600);
        const expiresAt = new Date(Date.now() + 600 * 1000);

        return {
            downloadUrl,
            fileName: access.product.fileName ?? access.product.title,
            expiresAt: expiresAt.toISOString(),
        };
    });