import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/S3Client";
import { isBlockedContentType, requireS3DirectoryAccess, resolveUploadDirectory, sanitizeFileName } from "@/lib/s3-auth";
import z from "zod";

const schema = z.object({
    fileName: z.string().min(1),
    fileType: z.string().min(1),
    directory: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const validation = schema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid data", details: validation.error.issues },
                { status: 400 }
            );
        }

        const { fileName, fileType, directory } = validation.data;
        if (isBlockedContentType(fileType)) {
            return NextResponse.json({ error: "Disallowed content type" }, { status: 400 });
        }

        const dir = directory || "studio/media";
        const authResult = await requireS3DirectoryAccess(req.headers, dir);
        if (!authResult.ok) return authResult.response;

        const resolvedDir = resolveUploadDirectory(dir, authResult.userId);
        const key = `${resolvedDir}/${uuidv4()}-${sanitizeFileName(fileName)}`;

        const command = new CreateMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            ContentType: fileType,
        });

        const response = await S3.send(command);

        return NextResponse.json({
            uploadId: response.UploadId,
            key,
        });
    } catch (error) {
        console.error("Multipart initiate error:", error);
        return NextResponse.json(
            { error: "Failed to initiate multipart upload" },
            { status: 500 }
        );
    }
}
