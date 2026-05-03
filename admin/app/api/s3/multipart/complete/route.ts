import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { S3 } from "@/lib/S3Client";
import z from "zod";

const schema = z.object({
    key: z.string().min(1),
    uploadId: z.string().min(1),
    parts: z.array(
        z.object({
            ETag: z.string(),
            PartNumber: z.number().int().min(1),
        })
    ),
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

        const { key, uploadId, parts } = validation.data;

        const command = new CompleteMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
            },
        });

        await S3.send(command);

        return NextResponse.json({
            message: "Upload completed",
            key,
        });
    } catch (error) {
        console.error("Multipart complete error:", error);
        return NextResponse.json(
            { error: "Failed to complete multipart upload" },
            { status: 500 }
        );
    }
}
