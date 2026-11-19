import "server-only";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export const MAX_SINGLE_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_MULTIPART_PART_NUMBER = 10_000;

const ALLOWED_S3_DIRECTORY_REGEX =
    /^(?:academy\/thumbnails|portfolio|studio\/member\/profile|studio\/logo|studio\/media|store\/[A-Za-z0-9_-]{1,64}\/(?:productItem|thumbnail)|studio\/bookings\/[A-Za-z0-9_-]{1,64}\/photos)$/;

const ALLOWED_S3_KEY_REGEX =
    /^(?:academy\/thumbnails|portfolio|studio\/member\/profile|studio\/logo|studio\/media|store\/[A-Za-z0-9_-]{1,64}\/(?:productItem|thumbnail)|studio\/bookings\/[A-Za-z0-9_-]{1,64}\/photos)\/[A-Za-z0-9._-]+$/;

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
    const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
    return (cleaned || "file").slice(0, 120);
}

type S3AuthResult =
    | { ok: true; userId: string }
    | { ok: false; response: NextResponse };

export async function requireS3DirectoryAccess(
    reqHeaders: Headers,
    directory: string,
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
    key: string,
    mode: "upload" | "delete" = "upload",
): Promise<S3AuthResult> {
    if (!ALLOWED_S3_KEY_REGEX.test(key) || key.includes("..")) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Invalid object key" }, { status: 400 }),
        };
    }

    const lastSlash = key.lastIndexOf("/");
    const directory = key.slice(0, lastSlash);
    const baseResult = await requireS3DirectoryAccess(reqHeaders, directory);
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

    return baseResult;
}
