import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { S3 } from "@/lib/S3Client";
import z from "zod";

const schema = z.object({
    key: z.string().min(1),
    uploadId: z.string().min(1),
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

        const { key, uploadId } = validation.data;

        const command = new AbortMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
        });

        await S3.send(command);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Multipart abort error:", error);
        return NextResponse.json(
            { error: "Failed to abort multipart upload" },
            { status: 500 }
        );
    }
}
