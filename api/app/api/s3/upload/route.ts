import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import z from "zod";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/S3Client";

// ── Size limits ────────────────────────────────────────────────────────────────
const MB = 1024 * 1024;
const IMAGE_MAX = 50 * MB;   //  50 MB for images
const VIDEO_MAX = 500 * MB;  // 500 MB for video / other files

// ── Path sanitization ──────────────────────────────────────────────────────────
// Allow only alphanumeric, dash, underscore, dot, and forward-slash.
// Strip any path-traversal sequences and reject absolute paths.
function sanitizePath(input: string): string {
    return input
        .replace(/\.\.\//g, "")   // strip ../
        .replace(/^\//,    "")    // strip leading /
        .replace(/[^a-zA-Z0-9._\-/]/g, "_"); // replace disallowed chars
}

// ── Schema ─────────────────────────────────────────────────────────────────────
// fileSize max is validated dynamically after parsing (depends on isImage),
// so we keep a generous upper bound here and tighten it in the handler.
export const fileUploadSchema = z.object({
    fileName:  z.string().min(1, "File name is required"),
    fileType:  z.string().min(1, "File type is required"),
    fileSize:  z.number().int().min(1, "File size is required").max(VIDEO_MAX, "File exceeds maximum allowed size"),
    isImage:   z.boolean(),
    directory: z.string().optional(), // e.g. "studio/bookings/{bookingId}/"
});

export async function POST(req: Request) {
    try {
        // ── 1. Authentication ──────────────────────────────────────────────────
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // ── 2. Parse & validate ────────────────────────────────────────────────
        const body = await req.json();
        const validation = fileUploadSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid file data", details: validation.error.issues },
                { status: 400 }
            );
        }

        const { fileName, fileType, fileSize, isImage, directory } = validation.data;

        // ── 3. Per-type size cap ───────────────────────────────────────────────
        const sizeLimit = isImage ? IMAGE_MAX : VIDEO_MAX;
        if (fileSize > sizeLimit) {
            return NextResponse.json(
                { error: `File size exceeds the ${isImage ? "50 MB image" : "500 MB video"} limit` },
                { status: 400 }
            );
        }

        // ── 4. Sanitize paths ──────────────────────────────────────────────────
        const safeFileName  = sanitizePath(fileName);
        const safeDirectory = sanitizePath(directory || "studio/logo");

        if (!safeFileName) {
            return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
        }

        const fileKey = `${safeDirectory}/${uuidv4()}-${safeFileName}`;

        // ── 5. Generate presigned URL ──────────────────────────────────────────
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileKey,
            ContentType: fileType,
            ContentLength: fileSize,
        });

        const presignedUrl = await getSignedUrl(S3, command, { expiresIn: 360 });

        return NextResponse.json({ presignedUrl, key: fileKey });

    } catch (error) {
        console.error("[S3 Upload] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate presigned URL" },
            { status: 500 }
        );
    }
}