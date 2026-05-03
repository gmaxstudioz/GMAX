import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { S3 } from "@/lib/S3Client";
import z from "zod";

const schema = z.object({
    key: z.string().min(1),
    uploadId: z.string().min(1),
    partNumber: z.number().int().min(1),
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

        const { key, uploadId, partNumber } = validation.data;

        const command = new UploadPartCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
        });

        const presignedUrl = await getSignedUrl(S3, command, {
            expiresIn: 600, // 10 minutes per part
        });

        return NextResponse.json({ presignedUrl });
    } catch (error) {
        console.error("Presign part error:", error);
        return NextResponse.json(
            { error: "Failed to generate presigned URL for part" },
            { status: 500 }
        );
    }
}
