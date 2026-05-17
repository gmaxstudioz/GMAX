// lib/api.ts — API client for the public portal
//
// Makes REST calls matching the oRPC OpenAPI routes defined in the API's contracts.
// Each function maps to a specific contract route (method + path).
//
// Contract path reference:
//   Studio:   POST /studio/get/{slug}
//   Booking:  GET  /bookings/check-client       POST /bookings/public
//   Products: GET  /products  /products/{id}     POST /products/purchase  /products/download  /products/access-link
//             GET  /products/verify-access
//   Payments: GET  /payments/verify-purchase
//   Photos:   POST /photos/{bookingId}/client-access  /photos/{bookingId}/client-download

import type {
    ProductOutput, PurchaseProductOutput,
    DownloadOutput, VerifyAccessTokenOutput,
} from "./types/product";
import type { PublicStudioOutput } from "./types/studio";
import type { PublicBookingOutput, CheckClientOutput } from "./types/booking";
import type { ClientPhotoAccessOutput, ClientDownloadOutput } from "./types/photo";
import type { PaginatedResponse } from "./types/common";
import type { PublicBookingInput } from "./schemas/booking.schema";
import type { PurchaseProductInput, RequestAccessLinkInput, RequestDownloadInput } from "./schemas/product.schema";
import type { ClientDownloadPhotoInput, ClientPhotoAccessInput } from "./schemas/photo.schema";

const API = process.env.NEXT_PUBLIC_API_URL!;

// ── Core fetch helpers ────────────────────────────────────────────────────────

export class ApiError extends Error {
    status: number;
    data: unknown;

    constructor(status: number, message: string, data?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | undefined>,
): Promise<T> {
    const url = new URL(`${API}${path}`);

    // Append query params for GET requests
    if (method === "GET" && params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) url.searchParams.set(key, value);
        }
    }

    const res = await fetch(url.toString(), {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new ApiError(
            res.status,
            error?.message ?? `API error: ${res.status}`,
            error,
        );
    }

    return res.json();
}

function get<T>(path: string, params?: Record<string, string | undefined>) {
    return request<T>("GET", path, undefined, params);
}

function post<T>(path: string, body: unknown) {
    return request<T>("POST", path, body);
}

// ── Studio ────────────────────────────────────────────────────────────────────

/** POST /studio/get/{slug} — contract: getStudioContract */
export const getStudioBySlug = (slug: string) =>
    post<PublicStudioOutput>(`/studio/get/${slug}`, { slug });

/** GET /studio/getAll — contract: getAllStudiosContract */
export const getStudios = (page = 1, perPage = 20) =>
    get<{ items: { id: string; name: string; slug: string; logo: string | null }[]; meta: { total: number; page: number; perPage: number; totalPages: number } }>("/studio/getAll", {
        page: String(page),
        perPage: String(perPage),
    });

// ── Booking ───────────────────────────────────────────────────────────────────

/** GET /bookings/check-client — contract: CheckClientContract */
export const checkClient = (studioId: string, name: string, email?: string) =>
    get<CheckClientOutput>("/bookings/check-client", { studioId, name, email });

/** POST /bookings/public — contract: CreatePublicBookingContract */
export const createPublicBooking = (input: PublicBookingInput) =>
    post<PublicBookingOutput>("/bookings/public", input);

// ── Products ──────────────────────────────────────────────────────────────────

/** GET /products — contract: GetAllProductsContract */
export const getProducts = (page = 1, perPage = 20) =>
    get<PaginatedResponse<ProductOutput>>("/products", {
        page: String(page),
        perPage: String(perPage),
    });

/** GET /products/{productId} — contract: GetProductContract */
export const getProductById = (productId: string) =>
    get<ProductOutput>(`/products/${productId}`);

/** POST /products/purchase — contract: PurchaseProductContract */
export const purchaseProduct = (input: PurchaseProductInput) =>
    post<PurchaseProductOutput>("/products/purchase", input);

/** POST /products/access-link — contract: RequestAccessLinkContract */
export const requestAccessLink = (input: RequestAccessLinkInput) =>
    post<{ sent: boolean }>("/products/access-link", input);

/** GET /products/verify-access — contract: VerifyAccessTokenContract */
export const verifyAccessToken = (token: string) =>
    get<VerifyAccessTokenOutput>("/products/verify-access", { token });

/** POST /products/download — contract: RequestDownloadContract */
export const requestDownload = (input: RequestDownloadInput) =>
    post<DownloadOutput>("/products/download", input);

// ── Payments ──────────────────────────────────────────────────────────────────

/** GET /payments/verify-purchase — contract: verifyPurchaseContract */
export const verifyPurchase = (reference: string) =>
    get<{ verified: boolean; buyerId?: string }>("/payments/verify-purchase", { reference });

/** GET /payments/public-details/{reference} — contract: getPublicPaymentDetailsContract */
export const getPublicPaymentDetails = (reference: string) =>
    get<any>(`/payments/public-details/${reference}`);

// ── Photos ────────────────────────────────────────────────────────────────────

/** POST /photos/{bookingId}/client-access — contract: ClientPhotoAccessContract */
export const getClientPhotos = (input: ClientPhotoAccessInput) =>
    post<ClientPhotoAccessOutput>(`/photos/${input.bookingId}/client-access`, input);

/** POST /photos/{bookingId}/client-download — contract: ClientDownloadPhotoContract */
export const downloadPhoto = (input: ClientDownloadPhotoInput) =>
    post<ClientDownloadOutput>(`/photos/${input.bookingId}/client-download`, input);

// ── Portfolio ─────────────────────────────────────────────────────────────────

export type PortfolioItem = {
    id: string;
    title: string | null;
    category: string;
    r2Key: string;
    thumbnailKey: string | null;
    isPublished: boolean;
    sortOrder: number;
};

export type PortfolioResponse = {
    items: PortfolioItem[];
    categories: string[];
};

/** GET /portfolio — contract: GetPublicPortfolioContract */
export const getPortfolio = (category?: string) =>
    get<PortfolioResponse>("/portfolio", category ? { category } : {});