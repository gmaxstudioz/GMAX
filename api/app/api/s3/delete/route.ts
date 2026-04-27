import { S3 } from "@/lib/S3Client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function DELETE(req: Request) {
    try {
        // ── 1. Authentication ──────────────────────────────────────────
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // ── 2. Parse and validate request body ────────────────────────
        const body = await req.json();
        
        const key = body.key;

         if (typeof key !== "string" || key.length === 0) {
            return NextResponse.json(
                { error: "Missing or invalid object key" },
                { status: 400 }
            );
        }

        // ── 3. Ownership check ────────────────────────────────────────
        // Look up the photo record to determine which studio owns this object.
        const photo = await prisma.photo.findFirst({
            where: { r2Key: key },
            include: { booking: true },
        });

        if (!photo) {
            // Key not found in DB — refuse to delete an untracked object.
            return NextResponse.json(
                { error: "Object not found or access denied" },
                { status: 403 }
            );
        }

        const studioId = photo.booking.studioId;

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId },
        });

        if (!member) {
            return NextResponse.json(
                { error: "Forbidden: you are not a member of the studio that owns this object" },
                { status: 403 }
            );
        }

        // ── 4. Send DeleteObjectCommand ───────────────────────────────
        const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        });

        await S3.send(command);

        return NextResponse.json(
            { message: "File deleted successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("[S3 Delete] Error:", error);
        return NextResponse.json(
            { error: "Failed to delete file" },
            { status: 500 }
        );
    }
}
