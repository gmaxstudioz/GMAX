import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/S3Client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import z from "zod";

const schema = z.object({
    fileName: z.string().min(1),
    fileType: z.string().min(1),
    directory: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        // ── 1. Authentication ──────────────────────────────────────────
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validation = schema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid data", details: validation.error.issues },
                { status: 400 }
            );
        }

        const { fileName, fileType, directory } = validation.data;
        const dir = directory || "studio/media";
        const key = `${dir}/${uuidv4()}-${fileName}`;

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
