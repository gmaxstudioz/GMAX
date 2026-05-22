import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import z from "zod";
import { v4 as uuidv4 } from 'uuid';
import { S3 } from "@/lib/S3Client";


export const fileUploadSchema = z.object({
    fileName: z.string().min(1, "File name is required"),
    fileType: z.string().min(1, "File type is required"),
    fileSize: z.number().min(1, "File size is required"),
    isImage: z.boolean(),
    directory: z.string().optional(), // e.g. "studio/bookings/{bookingId}/"
})

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const validation = fileUploadSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({
                error: "Invalid file data",
                details: validation.error.issues,
            }, { status: 400 })
        }

        const { fileName, fileType, fileSize, directory } = validation.data;

        const dir = directory || "studio/logo";
        const fileKey = `${dir}/${uuidv4()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileKey,
            ContentType: fileType,
            ContentLength: fileSize,
        })

        const presignedUrl = await getSignedUrl(
            S3,
            command,
            { expiresIn: 360 },
        )

        const response = {
            presignedUrl,
            key: fileKey,
        };

        return NextResponse.json(response);       
    } catch {
        return NextResponse.json(
            {error: "Failed to generate presigned URL"},
            {status: 500}
        )
    }
}