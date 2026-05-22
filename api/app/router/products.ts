import { contract } from "@/app/contract";
import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { authMiddleware, optionalAuthMiddleware, BaseContext } from "./middleware";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { getPresignedUrl } from "@/lib/r2";
import { sendAccessLinkEmail, sendSMS } from "@/lib/termii";
import { Prisma } from "@/lib/generated/prisma/client";

// Initialize the oRPC implementation builder with the base context
const os = implement(contract).$context<BaseContext>();

// Generates a structured receipt identifier for transaction tracking
function generateReceiptNumber(): string {
    return `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

// Generates a secure, random hex string for authentication tokens
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:3000";

function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

function effectivePrice(price: Prisma.Decimal, salePrice: Prisma.Decimal | null | undefined): number {
    const p = price.toNumber();
    const sp = salePrice != null ? salePrice.toNumber() : null;
    return sp !== null ? sp : p;
}

async function mapProductToOutput(data: {
    id: string;
    title: string;
    description: string;
    price: Prisma.Decimal;         // ✅ Typed as Prisma.Decimal
    salePrice: Prisma.Decimal | null; // ✅ Typed as Prisma.Decimal
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
        ? await getPresignedUrl(data.thumbnailKey, 3600)
        : null;

    const signedUrl = (includeDownloadUrl && data.r2Key)
        ? await getPresignedUrl(data.r2Key, 600)
        : null;

    return {
        id: data.id,
        title: data.title,
        description: data.description,
        price: data.price.toNumber(),                                     // ✅ Convert to number safely
        salePrice: data.salePrice != null ? data.salePrice.toNumber() : null, // ✅ Convert to number safely
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

// Endpoint to create a new product catalog item
export const createProduct = os.product.create
    .use(authMiddleware)
    .handler(async ({ input, errors }) => {
        // Look up if a product title already exists using a case-insensitive check
        const existing = await prisma.product.findFirst({
            where: { title: { equals: input.title, mode: "insensitive" } },
        });
        
        // Throw bad request error if a title conflict is detected
        if (existing) throw errors.BAD_REQUEST({
            message: "A product with this title already exists.",
        });

        // Insert the new product record and pull structural category relations
        const data = await prisma.product.create({ data: input, include: { category: true } });
        return mapProductToOutput(data);
    });

// Endpoint to permanently remove a product from the system
export const deleteProduct = os.product.delete
    .use(authMiddleware)
    .handler(async ({ input, errors }) => {
        // Verify the product exists prior to executing deletion queries
        const existing = await prisma.product.findUnique({ where: { id: input.productId } });
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Product", resourceId: input.productId } });

        // Wipe the target record from the database table
        await prisma.product.delete({ where: { id: input.productId } });
        return { id: input.productId, deleted: true as const };
    });

// Endpoint to modify data fields within an existing product
export const updateProduct = os.product.update
    .use(authMiddleware)
    .handler(async ({ input, errors }) => {
        const { productId, ...updateData } = input;
        
        // Verify target product profile exists before merging changes
        const existing = await prisma.product.findUnique({ where: { id: productId } });
        if (!existing) throw errors.NOT_FOUND({
            data: { resourceType: "Product", resourceId: productId },
        });

        // Apply changes to the record field keys and return populated mutations
        const data = await prisma.product.update({
            where: { id: productId },
            data: updateData,
            include: { category: true },
        });
        return mapProductToOutput(data);
    });

// Endpoint to pull single product attributes using its unique key identifier
export const getProductById = os.product.getById
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        // Query database for a published product entry
        const data = await prisma.product.findUnique({
            where: { id: input.productId, isPublished: true },
            include: { category: true },
        });
        
        // Handle scenarios where product ID is missing or unpublished
        if (!data) throw errors.NOT_FOUND({
            data: { resourceType: "Product", resourceId: input.productId },
        });
        return mapProductToOutput(data, false);
    });

// Endpoint to fetch paginated collections of visible products
export const getAllProducts = os.product.getAll
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const { page, perPage } = input;
        const where = { isPublished: true };

        // Query database count and selection windows in parallel loops
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

        // Formulate mathematical page ceilings
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

// Endpoint to register intent to purchase a store product
export const purchaseProduct = os.product.purchase
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        // Query to check if the target digital item exists and is online
        const product = await prisma.product.findUnique({
            where: { id: input.productId, isPublished: true },
        });
        if (!product) throw errors.NOT_FOUND({
            data: { resourceType: "Product", resourceId: input.productId },
        });

        // Query if client already exists matching either the provided email OR phone string
        let buyer = await prisma.buyer.findFirst({
            where: {
                OR: [
                    { email: input.buyerEmail },
                    { phone: input.buyerPhone }
                ]
            },
        });

        // Insert new client entity if lookup returns empty results
        if (!buyer) {
            buyer = await prisma.buyer.create({
                data: {
                    name: input.buyerName,
                    email: input.buyerEmail,
                    phone: input.buyerPhone,
                },
            });
        } else {
            const updates: Record<string, string> = {};
            if (input.buyerName && input.buyerName !== buyer.name) updates.name = input.buyerName;
            
            // Protect against assigning a phone number already registered by another profile
            if (input.buyerPhone && input.buyerPhone !== buyer.phone) {
                const phoneOwner = await prisma.buyer.findUnique({ where: { phone: input.buyerPhone } });
                if (phoneOwner && phoneOwner.id !== buyer.id) {
                    throw errors.BAD_REQUEST({
                        message: "This phone number is already linked to another registered email profile."
                    });
                }
                updates.phone = input.buyerPhone;
            }

            // Apply updates to existing buyer reference row if payload details have changed
            if (Object.keys(updates).length > 0) {
                buyer = await prisma.buyer.update({
                    where: { id: buyer.id },
                    data: updates,
                });
            }
        }

        // Assert customer does not have pre-existing active access to the resource
        const existingAccess = await prisma.productAccess.findUnique({
            where: { productId_buyerId: { productId: product.id, buyerId: buyer.id } },
        });
        if (existingAccess) throw errors.BAD_REQUEST({
            message: "You already have access to this product.",
        });

        // Calculate checkout pricing context structures
        const amount = effectivePrice(product.price, product.salePrice);
        const reference = `gmax-shop-${uuidv4().slice(0, 8)}`;
        const receiptNumber = generateReceiptNumber();

        // Log a pending payload invoice table record mapping the purchase variables
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

// Endpoint to request an access login token sent directly via email hooks
export const requestAccessLink = os.product.requestAccessLink
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        // Query to match unique buyer profiles linked to the inbound email address
        const buyer = await prisma.buyer.findUnique({
            where: { email: input.email },
        });

        // Mock confirmation success response immediately to safeguard system records from discovery scanners
        if (!buyer) return { sent: true };

        // Structure a random security link token and calculate an expiry window set to 15 minutes
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Store access credentials string reference directly inside database records
        const tokenRecord = await prisma.buyerAccessToken.create({
            data: { buyerId: buyer.id, token, expiresAt, used: false },
        });

        const accessLink = `${PORTAL_URL}/shop/access?token=${token}`;
        let deliveryMethod: "EMAIL" | "SMS" | null = null;

        if (buyer.email) {
            try {
                const emailResult = await sendAccessLinkEmail({
                    email: buyer.email,
                    buyerName: buyer.name,
                    accessLink,
                });
                if (emailResult) {
                    deliveryMethod = "EMAIL";
                }
            } catch (error) {
                console.error("[Shop] Access link email failed:", error);
            }
        }

        if (!deliveryMethod && buyer.phone) {
            try {
                await sendSMS(buyer.phone, `Your GMAX access link: ${accessLink}`);
                deliveryMethod = "SMS";
            } catch (error) {
                console.error("[Shop] Access link SMS failed:", error);
            }
        }

        if (!deliveryMethod) {
            console.error(`[Shop] No delivery channel available for buyer ${buyer.id}`);
            throw new Error("No delivery channel available for access link.");
        }

        console.info(
            `[Shop] Magic access link record ${tokenRecord.id} created and delivered via ${deliveryMethod}`
        );

        return { sent: true };
    });

// Endpoint to authenticate client browser sessions using incoming magic token arguments
export const verifyAccessToken = os.product.verifyAccessToken
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        // Read match configurations and include cascade buyer authorization arrays
        const record = await prisma.buyerAccessToken.findUnique({
            where: { token: input.token },
            include: { buyer: { include: { purchases: { include: { product: true } } } } },
        });

        // Reject request if access token does not exist, has been flagged used, or timestamp exceeds limits
        if (!record || record.used || record.expiresAt < new Date()) {
            throw errors.UNAUTHORIZED({ message: "Invalid or expired access link." });
        }

        // Flag the magic link access token within data rows to ensure single-use guarantees
        await prisma.buyerAccessToken.update({
            where: { id: record.id },
            data: { used: true },
        });

        // Create a new continuous session tracking string valid across 24 hours
        const sessionToken = generateToken();
        await prisma.buyerAccessToken.create({
            data: {
                buyerId: record.buyerId,
                token: sessionToken,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                used: false,
            },
        });

        return {
            buyerId: record.buyerId,
            sessionToken,
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

// Endpoint to request bucket delivery locations for safe download routing
export const requestDownload = os.product.requestDownload
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        // Check database for active browser session token properties
        const tokenRecord = await prisma.buyerAccessToken.findUnique({
            where: { token: input.token },
        });

        // Reject request processing if user credentials fail timestamp thresholds
        if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < new Date()) {
            throw errors.UNAUTHORIZED({ message: "Invalid or expired session." });
        }

        // Check if buyer has verified financial transaction clearance matching the product asset
        const access = await prisma.productAccess.findUnique({
            where: {
                productId_buyerId: {
                    productId: input.productId,
                    buyerId: tokenRecord.buyerId,
                },
            },
            include: { product: true },
        });

        // Handle permissions anomalies or timed resource lockouts
        if (!access) throw errors.FORBIDDEN({ message: "You do not have access to this product." });
        if (access.expiresAt && access.expiresAt < new Date()) {
            throw errors.FORBIDDEN({ message: "Your access to this product has expired." });
        }
        if (!access.product.r2Key) {
            throw errors.BAD_REQUEST({ message: "Product file is not available yet." });
        }

        // Advance historical usage matrices counters inside product telemetry tables
        await prisma.productAccess.update({
            where: { id: access.id },
            data: {
                downloadCount: { increment: 1 },
                lastDownloadAt: new Date(),
            },
        });

        // Generate dynamic asset cloud file endpoints configured to self-destruct in 10 minutes
        const downloadUrl = await getPresignedUrl(access.product.r2Key, 600);
        const expiresAt = new Date(Date.now() + 600 * 1000);

        return {
            downloadUrl,
            fileName: access.product.fileName ?? access.product.title,
            expiresAt: expiresAt.toISOString(),
        };
    });