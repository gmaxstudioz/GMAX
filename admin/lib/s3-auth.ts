import "server-only";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export const MAX_SINGLE_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_MULTIPART_PART_NUMBER = 10_000;

const ALLOWED_S3_DIRECTORY_REGEX =
    /^(?:academy\/thumbnails|portfolio|studio\/member\/profile(?:\/[A-Za-z0-9_-]{1,64})?|studio\/logo|studio\/media|store\/[A-Za-z0-9_-]{1,64}\/(?:productItem|thumbnail)|studio\/bookings\/[A-Za-z0-9_-]{1,64}\/photos)$/;

const ALLOWED_S3_KEY_REGEX =
    /^(?:academy\/thumbnails|portfolio|studio\/member\/profile\/[A-Za-z0-9_-]{1,64}|studio\/logo|studio\/media|store\/[A-Za-z0-9_-]{1,64}\/(?:productItem|thumbnail)|studio\/bookings\/[A-Za-z0-9_-]{1,64}\/photos)\/[A-Za-z0-9._-]+$/;

const BLOCKED_CONTENT_TYPES = new Set([
    "text/html",
    "application/xhtml+xml",
    "image/svg+xml",
    "application/javascript",
    "text/javascript",
    "application/x-javascript",
    "text/ecmascript",
    "application/ecmascript",
]);

export function isBlockedContentType(contentType: string): boolean {
    const base = contentType.split(";")[0].trim().toLowerCase();
    return BLOCKED_CONTENT_TYPES.has(base);
}

export function sanitizeFileName(rawName: string): string {
    const base = rawName.split(/[\\/]/).pop() ?? "file";
    const cleaned = base
        .replace(/[^A-Za-z0-9._-]/g, "_")
        .replace(/\.{2,}/g, ".")
        .replace(/^\.+/, "");
    return (cleaned || "file").slice(0, 120);
}

type S3AuthResult =
    | { ok: true; userId: string }
    | { ok: false; response: NextResponse };

export type S3KeyAuthResult =
    | { ok: true; userId: string; key: string }
    | { ok: false; response: NextResponse };

export function resolveUploadDirectory(directory: string, userId: string): string {
    if (directory === "studio/member/profile") {
        return `studio/member/profile/${userId}`;
    }
    return directory;
}

export function normalizeS3ObjectKey(rawKey: string): string | null {
    const trimmed = rawKey.trim();
    if (!trimmed) return null;

    const r2PublicUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/+$/, "");
    let normalized = trimmed;

    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) || trimmed.startsWith("//")) {
        if (!r2PublicUrl) return null;
        try {
            const parsedKey = new URL(trimmed);
            const parsedBase = new URL(r2PublicUrl);
            const basePath = parsedBase.pathname.replace(/\/+$/, "");
            if (
                parsedKey.origin !== parsedBase.origin ||
                (basePath &&
                    parsedKey.pathname !== basePath &&
                    !parsedKey.pathname.startsWith(`${basePath}/`))
            ) {
                return null;
            }
            normalized = parsedKey.pathname.slice(basePath.length).replace(/^\/+/, "");
        } catch {
            return null;
        }
    } else {
        normalized = trimmed.replace(/^\/+/, "");
    }

    if (
        !normalized ||
        normalized.includes("..") ||
        normalized.includes("\\") ||
        /[\x00-\x1f\x7f?#]/.test(normalized)
    ) {
        return null;
    }

    return normalized;
}

async function authorizeTrustedLegacyKeyDelete(
    reqHeaders: Headers,
    key: string,
): Promise<S3AuthResult> {
    if (!key || key.includes("..") || key.includes("\\") || /[\x00-\x1f\x7f]/.test(key)) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Invalid object key" }, { status: 400 }),
        };
    }

    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    const dbUser = await db.query.user.findFirst({
        where: eq(schema.user.id, session.user.id),
        columns: { id: true, role: true },
    });
    if (!dbUser || dbUser.role === "deleted") {
        return {
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    const isPlatformAdmin = dbUser.role === "admin";
    const r2PublicUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/+$/, "");
    const candidateKeys = r2PublicUrl ? [key, `${r2PublicUrl}/${key}`] : [key];

    const matchedPhoto = await db.query.photo.findFirst({
        where: or(
            inArray(schema.photo.r2Key, candidateKeys),
            inArray(schema.photo.thumbnailKey, candidateKeys),
        ),
        with: {
            booking: { columns: { studioId: true } },
        },
    });
    if (matchedPhoto) {
        if (isPlatformAdmin) return { ok: true, userId: dbUser.id };
        if (!matchedPhoto.booking) {
            return {
                ok: false,
                response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
        const memberRow = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, dbUser.id),
                eq(schema.member.studioId, matchedPhoto.booking.studioId),
            ),
            columns: { role: true },
        });
        if (!memberRow || !["owner", "admin", "manager", "developer", "receptionist"].includes(memberRow.role)) {
            return {
                ok: false,
                response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
        return { ok: true, userId: dbUser.id };
    }

    const matchedStudio = await db.query.studio.findFirst({
        where: inArray(schema.studio.logo, candidateKeys),
        columns: { id: true },
    });
    if (matchedStudio) {
        if (isPlatformAdmin) return { ok: true, userId: dbUser.id };
        const studioStaff = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, dbUser.id),
                eq(schema.member.studioId, matchedStudio.id),
                inArray(schema.member.role, ["owner", "developer", "manager"]),
            ),
            columns: { id: true },
        });
        if (!studioStaff) {
            return {
                ok: false,
                response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
        return { ok: true, userId: dbUser.id };
    }

    const [matchedProduct, matchedPortfolio, matchedCourse] = await Promise.all([
        db.query.product.findFirst({
            where: or(
                inArray(schema.product.r2Key, candidateKeys),
                inArray(schema.product.thumbnailKey, candidateKeys),
            ),
            columns: { id: true },
        }),
        db.query.portfolioItem.findFirst({
            where: or(
                inArray(schema.portfolioItem.r2Key, candidateKeys),
                inArray(schema.portfolioItem.thumbnailKey, candidateKeys),
            ),
            columns: { id: true },
        }),
        db.query.academyCourse.findFirst({
            where: inArray(schema.academyCourse.thumbnail, candidateKeys),
            columns: { id: true },
        }),
    ]);

    if (matchedProduct || matchedPortfolio || matchedCourse) {
        if (isPlatformAdmin) return { ok: true, userId: dbUser.id };
        const ownerOrDev = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, dbUser.id),
                inArray(schema.member.role, ["owner", "developer"]),
            ),
            columns: { id: true },
        });
        if (!ownerOrDev) {
            return {
                ok: false,
                response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
        return { ok: true, userId: dbUser.id };
    }

    return {
        ok: false,
        response: NextResponse.json({ error: "Invalid object key" }, { status: 400 }),
    };
}

export async function requireS3DirectoryAccess(
    reqHeaders: Headers,
    directory: string,
    mode: "upload" | "delete" = "upload",
    key?: string,
): Promise<S3AuthResult> {
    if (!ALLOWED_S3_DIRECTORY_REGEX.test(directory) || directory.includes("..")) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Invalid upload directory" }, { status: 400 }),
        };
    }

    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    const dbUser = await db.query.user.findFirst({
        where: eq(schema.user.id, session.user.id),
        columns: { id: true, role: true },
    });
    if (!dbUser || dbUser.role === "deleted") {
        return {
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    if (dbUser.role === "admin") {
        return { ok: true, userId: dbUser.id };
    }

    if (directory === "studio/member/profile") {
        if (mode === "delete") {
            return {
                ok: false,
                response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
        return { ok: true, userId: dbUser.id };
    }

    if (directory.startsWith("studio/member/profile/")) {
        const ownerUserId = directory.slice("studio/member/profile/".length);
        if (!ownerUserId || ownerUserId !== dbUser.id) {
            return {
                ok: false,
                response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
        return { ok: true, userId: dbUser.id };
    }

    const bookingMatch = /^studio\/bookings\/([A-Za-z0-9_-]{1,64})\/photos$/.exec(directory);
    if (bookingMatch) {
        const bookingId = bookingMatch[1];
        const bookingRow = await db.query.booking.findFirst({
            where: eq(schema.booking.id, bookingId),
            columns: { studioId: true },
        });
        if (!bookingRow) {
            return {
                ok: false,
                response: NextResponse.json({ error: "Booking not found" }, { status: 404 }),
            };
        }
        const memberRow = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, dbUser.id),
                eq(schema.member.studioId, bookingRow.studioId),
            ),
            columns: { id: true },
        });
        if (!memberRow) {
            return {
                ok: false,
                response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
        return { ok: true, userId: dbUser.id };
    }

    if (
        directory.startsWith("store/") ||
        directory === "portfolio" ||
        directory === "academy/thumbnails"
    ) {
        const ownerOrDev = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, dbUser.id),
                inArray(schema.member.role, ["owner", "developer"]),
            ),
            columns: { id: true },
        });
        if (!ownerOrDev) {
            return {
                ok: false,
                response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
        return { ok: true, userId: dbUser.id };
    }

    // studio/logo and studio/media
    const studioStaff = await db.query.member.findFirst({
        where: and(
            eq(schema.member.userId, dbUser.id),
            inArray(schema.member.role, ["owner", "developer", "manager"]),
        ),
        columns: { id: true },
    });
    if (!studioStaff) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
    }

    return { ok: true, userId: dbUser.id };
}

export async function requireS3KeyAccess(
    reqHeaders: Headers,
    rawKey: string,
    mode: "upload" | "delete" = "upload",
): Promise<S3KeyAuthResult> {
    const key = normalizeS3ObjectKey(rawKey);
    if (!key) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Invalid object key" }, { status: 400 }),
        };
    }

    if (!ALLOWED_S3_KEY_REGEX.test(key)) {
        if (mode === "delete") {
            const legacyResult = await authorizeTrustedLegacyKeyDelete(reqHeaders, key);
            return legacyResult.ok ? { ...legacyResult, key } : legacyResult;
        }
        return {
            ok: false,
            response: NextResponse.json({ error: "Invalid object key" }, { status: 400 }),
        };
    }

    const lastSlash = key.lastIndexOf("/");
    const directory = key.slice(0, lastSlash);
    const baseResult = await requireS3DirectoryAccess(reqHeaders, directory, mode, key);
    if (!baseResult.ok) return baseResult;

    // For deletes of booking photos, additionally enforce photo deletion roles (owner/admin/manager/receptionist/developer)
    if (mode === "delete" && directory.startsWith("studio/bookings/")) {
        const bookingId = directory.split("/")[2];
        const dbUser = await db.query.user.findFirst({
            where: eq(schema.user.id, baseResult.userId),
            columns: { role: true },
        });
        if (dbUser?.role !== "admin") {
            const bookingRow = await db.query.booking.findFirst({
                where: eq(schema.booking.id, bookingId),
                columns: { studioId: true },
            });
            if (!bookingRow) {
                return {
                    ok: false,
                    response: NextResponse.json({ error: "Booking not found" }, { status: 404 }),
                };
            }
            const memberRow = await db.query.member.findFirst({
                where: and(
                    eq(schema.member.userId, baseResult.userId),
                    eq(schema.member.studioId, bookingRow.studioId),
                ),
                columns: { role: true },
            });
            if (!memberRow || !["owner", "admin", "manager", "developer", "receptionist"].includes(memberRow.role)) {
                return {
                    ok: false,
                    response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
                };
            }
        }
    }

    return { ...baseResult, key };
}
