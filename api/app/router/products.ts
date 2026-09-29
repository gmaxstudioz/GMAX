import { contract } from "@/app/contract";
import { db } from "@/lib/db";
import { implement } from "@orpc/server";
import { authMiddleware, optionalAuthMiddleware, BaseContext } from "./middleware";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { getPresignedUrl } from "@/lib/r2";
import { sendAccessLinkEmail, sendSMS } from "@/lib/termii";
import { product, buyer, productAccess, payment, buyerAccessToken } from "@/lib/schema";
import { eq, and, or, inArray, asc, desc, ilike, sql } from "drizzle-orm";
import { getPostHogClient } from "@/lib/auth";

// Initialize the oRPC implementation builder with the base context
const os = implement(contract).$context<BaseContext>();

async function captureEvent(event: string, properties: Record<string, string | number | boolean>) {
    const posthog = getPostHogClient();
    if (!posthog) return;

    posthog.capture({ event, properties });
    await posthog.flush();
}

// Generates a structured receipt identifier for transaction tracking
function generateReceiptNumber(): string {
    return `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

// Generates a secure, random hex string for authentication tokens
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:3000";

function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

function effectivePrice(price: string, salePrice: string | null | undefined): number {
    const p = parseFloat(price);
    const sp = salePrice != null ? parseFloat(salePrice) : null;
    return sp !== null ? sp : p;
}

async function mapProductToOutput(data: {
    id: string;
    title: string;
    description: string;
    price: string;
    salePrice: string | null;
    categoryId: string | null;
    productCategory: { id: string; name: string; slug: string } | null;
    r2Key: string | null;
    fileName: string | null;
    fileSize: number | null;
    mimeType: string | null;
    thumbnailKey: string | null;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
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
        price: parseFloat(data.price),
        salePrice: data.salePrice != null ? parseFloat(data.salePrice) : null,
        categoryId: data.categoryId,
        category: data.productCategory,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        isPublished: data.isPublished,
        createdAt: new Date(data.createdAt).toISOString(),
        updatedAt: new Date(data.updatedAt).toISOString(),
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
        const existing = await db.query.product.findFirst({
            where: (p, { ilike }) => ilike(p.title, input.title),
        });
        
        // Throw bad request error if a title conflict is detected
        if (existing) throw errors.BAD_REQUEST({
            message: "A product with this title already exists.",
        });

        // Insert the new product record and pull structural category relations
        const id = uuidv4();
        const [inserted] = await db.insert(product).values({
            id,
            ...input,
            price: input.price.toString(),
            salePrice: input.salePrice?.toString() ?? null,
            updatedAt: new Date().toISOString(),
        }).returning();

        const data = await db.query.product.findFirst({
            where: (p, { eq }) => eq(p.id, inserted.id),
            with: { productCategory: true }
        });

        if (!data) throw new Error("Failed to retrieve created product");

        await captureEvent("product_created", { is_published: data.isPublished });
        return mapProductToOutput(data);
    });

// Endpoint to permanently remove a product from the system
export const deleteProduct = os.product.delete
    .use(authMiddleware)
    .handler(async ({ input, errors }) => {
        // Verify the product exists prior to executing deletion queries
        const existing = await db.query.product.findFirst({ 
            where: (p, { eq }) => eq(p.id, input.productId) 
        });
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Product", resourceId: input.productId } });

        // Wipe the target record from the database table
        await db.delete(product).where(eq(product.id, input.productId));
        await captureEvent("product_deleted", {});
        return { id: input.productId, deleted: true as const };
    });

// Endpoint to modify data fields within an existing product
export const updateProduct = os.product.update
    .use(authMiddleware)
    .handler(async ({ input, errors }) => {
        const { productId, ...updateData } = input;
        
        // Verify target product profile exists before merging changes
        const existing = await db.query.product.findFirst({ 
            where: (p, { eq }) => eq(p.id, productId) 
        });
        if (!existing) throw errors.NOT_FOUND({
            data: { resourceType: "Product", resourceId: productId },
        });

        const updatePayload: any = { ...updateData, updatedAt: new Date().toISOString() };
        if (updateData.price !== undefined) updatePayload.price = updateData.price.toString();
        if (updateData.salePrice !== undefined) updatePayload.salePrice = updateData.salePrice?.toString() ?? null;

        // Apply changes to the record field keys and return populated mutations
        await db.update(product)
            .set(updatePayload)
            .where(eq(product.id, productId));

        const data = await db.query.product.findFirst({
            where: (p, { eq }) => eq(p.id, productId),
            with: { productCategory: true }
        });

        if (!data) throw new Error("Failed to retrieve updated product");

        await captureEvent("product_updated", { is_published: data.isPublished });
        return mapProductToOutput(data);
    });

// Endpoint to pull single product attributes using its unique key identifier
export const getProductById = os.product.getById
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        // Query database for a published product entry
        const data = await db.query.product.findFirst({
            where: (p, { eq, and }) => and(eq(p.id, input.productId), eq(p.isPublished, true)),
            with: { productCategory: true },
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

        // Query database count and selection windows in parallel loops
        const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(product).where(eq(product.isPublished, true));
        const total = Number(count);
        
        const items = await db.query.product.findMany({
            where: (p, { eq }) => eq(p.isPublished, true),
            with: { productCategory: true },
            offset: (page - 1) * perPage,
            limit: perPage,
            orderBy: (p, { desc }) => [desc(p.createdAt)],
        });

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
        const productData = await db.query.product.findFirst({
            where: (p, { eq, and }) => and(eq(p.id, input.productId), eq(p.isPublished, true)),
        });
        if (!productData) throw errors.NOT_FOUND({
            data: { resourceType: "Product", resourceId: input.productId },
        });

        // Query if client already exists matching either the provided email OR phone string
        let buyerData = await db.query.buyer.findFirst({
            where: (b, { or, eq }) => or(
                eq(b.email, input.buyerEmail),
                eq(b.phone, input.buyerPhone)
            )
        });

        // Insert new client entity if lookup returns empty results
        if (!buyerData) {
            const id = uuidv4();
            const [inserted] = await db.insert(buyer).values({
                id,
                name: input.buyerName,
                email: input.buyerEmail,
                phone: input.buyerPhone,
                updatedAt: new Date().toISOString(),
            }).returning();
            buyerData = inserted;
        } else {
            const updates: Record<string, string> = {};
            if (input.buyerName && input.buyerName !== buyerData.name) updates.name = input.buyerName;
            
            // Protect against assigning a phone number already registered by another profile
            if (input.buyerPhone && input.buyerPhone !== buyerData.phone) {
                const phoneOwner = await db.query.buyer.findFirst({ 
                    where: (b, { eq }) => eq(b.phone, input.buyerPhone) 
                });
                if (phoneOwner && phoneOwner.id !== buyerData.id) {
                    throw errors.BAD_REQUEST({
                        message: "This phone number is already linked to another registered email profile."
                    });
                }
                updates.phone = input.buyerPhone;
            }

            // Apply updates to existing buyer reference row if payload details have changed
            if (Object.keys(updates).length > 0) {
                updates.updatedAt = new Date().toISOString();
                const [updated] = await db.update(buyer)
                    .set(updates)
                    .where(eq(buyer.id, buyerData.id))
                    .returning();
                buyerData = updated;
            }
        }

        // Assert customer does not have pre-existing active access to the resource
        const existingAccess = await db.query.productAccess.findFirst({
            where: (pa, { eq, and }) => and(
                eq(pa.productId, productData.id), 
                eq(pa.buyerId, buyerData.id)
            )
        });
        if (existingAccess) throw errors.BAD_REQUEST({
            message: "You already have access to this product.",
        });

        // Calculate checkout pricing context structures
        const amount = effectivePrice(productData.price, productData.salePrice);
        const reference = `gmax-shop-${uuidv4().slice(0, 8)}`;
        const receiptNumber = generateReceiptNumber();

        // Log a pending payload invoice table record mapping the purchase variables
        const paymentId = uuidv4();
        await db.insert(payment).values({
            id: paymentId,
            amount: amount.toString(),
            method: "TRANSFER",
            status: "PENDING",
            paystackReference: reference,
            receiptNumber,
            recordedById: null,
            paystackResponse: {
                pendingProduct: { title: productData.title },
                pendingBuyer: { name: buyerData.name, email: buyerData.email },
                productId: productData.id,
                buyerId: buyerData.id,
            },
        });

        await captureEvent("product_checkout_started", {
            has_sale_price: productData.salePrice !== null,
        });

        return {
            paymentUrl: null,
            reference,
            amount,
            buyerId: buyerData.id,
        };
    });

// ── Magic Link Flow ───────────────────────────────────────────────────────────

// Endpoint to request an access login token sent directly via email hooks
export const requestAccessLink = os.product.requestAccessLink
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        // Query to match unique buyer profiles linked to the inbound email address
        const buyerData = await db.query.buyer.findFirst({
            where: (b, { eq }) => eq(b.email, input.email),
        });

        // Mock confirmation success response immediately to safeguard system records from discovery scanners
        if (!buyerData) return { sent: true };

        // Structure a random security link token and calculate an expiry window set to 15 minutes
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        // Store access credentials string reference directly inside database records
        const tokenRecordId = uuidv4();
        const [tokenRecord] = await db.insert(buyerAccessToken).values({
            id: tokenRecordId,
            buyerId: buyerData.id, 
            token, 
            expiresAt, 
            used: false
        }).returning();

        const accessLink = `${PORTAL_URL}/shop/access/${token}`;
        let deliveryMethod: "EMAIL" | "SMS" | null = null;

        if (buyerData.email) {
            try {
                const emailResult = await sendAccessLinkEmail({
                    email: buyerData.email,
                    buyerName: buyerData.name,
                    accessLink,
                });
                if (emailResult) {
                    deliveryMethod = "EMAIL";
                }
            } catch (error) {
                console.error("[Shop] Access link email failed:", error);
            }
        }

        if (!deliveryMethod && buyerData.phone) {
            try {
                await sendSMS(buyerData.phone, `Your GMAX access link: ${accessLink}`);
                deliveryMethod = "SMS";
            } catch (error) {
                console.error("[Shop] Access link SMS failed:", error);
            }
        }

        if (!deliveryMethod) {
            console.error(`[Shop] No delivery channel available for buyer ${buyerData.id}`);
            throw new Error("No delivery channel available for access link.");
        }

        console.info(
            `[Shop] Magic access link record ${tokenRecord.id} created and delivered via ${deliveryMethod}`
        );

        await captureEvent("product_access_link_requested", { delivery_method: deliveryMethod });

        return { sent: true };
    });

// Endpoint to authenticate client browser sessions using incoming magic token arguments
export const verifyAccessToken = os.product.verifyAccessToken
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        // Read match configurations and include cascade buyer authorization arrays
        const record = await db.query.buyerAccessToken.findFirst({
            where: (b, { eq }) => eq(b.token, input.token),
            with: { 
                buyer: { 
                    with: { 
                        productAccesses: { 
                            with: { product: true } 
                        } 
                    } 
                } 
            },
        });

        // Reject request if access token does not exist, has been flagged used, or timestamp exceeds limits
        if (!record || record.used || new Date(record.expiresAt) < new Date()) {
            throw errors.UNAUTHORIZED({ message: "Invalid or expired access link." });
        }

        // Flag the magic link access token within data rows to ensure single-use guarantees
        await db.update(buyerAccessToken)
            .set({ used: true })
            .where(eq(buyerAccessToken.id, record.id));

        // Create a new continuous session tracking string valid across 24 hours
        const sessionToken = generateToken();
        const newSessionId = uuidv4();
        await db.insert(buyerAccessToken).values({
            id: newSessionId,
            buyerId: record.buyerId,
            token: sessionToken,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            used: false,
        });

        return {
            buyerId: record.buyerId,
            sessionToken,
            purchases: record.buyer.productAccesses.map((p) => ({
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
        const tokenRecord = await db.query.buyerAccessToken.findFirst({
            where: (b, { eq }) => eq(b.token, input.token),
        });

        // Reject request processing if user credentials fail timestamp thresholds
        if (!tokenRecord || tokenRecord.used || new Date(tokenRecord.expiresAt) < new Date()) {
            throw errors.UNAUTHORIZED({ message: "Invalid or expired session." });
        }

        // Check if buyer has verified financial transaction clearance matching the product asset
        const access = await db.query.productAccess.findFirst({
            where: (pa, { eq, and }) => and(
                eq(pa.productId, input.productId),
                eq(pa.buyerId, tokenRecord.buyerId)
            ),
            with: { product: true },
        });

        // Handle permissions anomalies or timed resource lockouts
        if (!access) throw errors.FORBIDDEN({ message: "You do not have access to this product." });
        if (access.expiresAt && new Date(access.expiresAt) < new Date()) {
            throw errors.FORBIDDEN({ message: "Your access to this product has expired." });
        }
        if (!access.product.r2Key) {
            throw errors.BAD_REQUEST({ message: "Product file is not available yet." });
        }

        // Advance historical usage matrices counters inside product telemetry tables
        await db.update(productAccess)
            .set({
                downloadCount: access.downloadCount + 1,
                lastDownloadAt: new Date().toISOString(),
            })
            .where(eq(productAccess.id, access.id));

        // Generate dynamic asset cloud file endpoints configured to self-destruct in 10 minutes
        const downloadUrl = await getPresignedUrl(access.product.r2Key, 600);
        const expiresAt = new Date(Date.now() + 600 * 1000);

        await captureEvent("product_download_requested", {
            download_count: access.downloadCount + 1,
        });

        return {
            downloadUrl,
            fileName: access.product.fileName ?? access.product.title,
            expiresAt: expiresAt.toISOString(),
        };
    });
