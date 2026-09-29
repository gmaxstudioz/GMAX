import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { SeverityNumber } from "@opentelemetry/api-logs";
import z from "zod";
import { v4 as uuidv4 } from 'uuid';
import { S3 } from "@/lib/S3Client";
import { posthogLog, posthogLogProvider } from "@/instrumentation";

export const runtime = "nodejs";

export const fileUploadSchema = z.object({
    fileName: z.string().min(1, "File name is required"),
    fileType: z.string().min(1, "File type is required"),
    fileSize: z.number().min(1, "File size is required"),
    isImage: z.boolean(),
    directory: z.string().optional(), // e.g. "studio/bookings/{bookingId}/"
})

function flushPosthogLogs() {
    after(async () => {
        await posthogLogProvider?.forceFlush();
    });
}

export async function POST(req: Request) {
    const startedAt = Date.now();

    try {
        const body = await req.json();

        const validation = fileUploadSchema.safeParse(body);

        if (!validation.success) {
            posthogLog?.emit({
                body: "s3 presigned upload request completed",
                severityNumber: SeverityNumber.WARN,
                attributes: {
                    endpoint: "/api/s3/upload",
                    outcome: "invalid_request",
                    duration_ms: Date.now() - startedAt,
                },
            });
            flushPosthogLogs();

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

        posthogLog?.emit({
            body: "s3 presigned upload request completed",
            severityNumber: SeverityNumber.INFO,
            attributes: {
                endpoint: "/api/s3/upload",
                outcome: "presigned_url_created",
                file_size_bytes: fileSize,
                is_image: validation.data.isImage,
                duration_ms: Date.now() - startedAt,
            },
        });
        flushPosthogLogs();

        return NextResponse.json(response);       
    } catch {
        posthogLog?.emit({
            body: "s3 presigned upload request completed",
            severityNumber: SeverityNumber.ERROR,
            attributes: {
                endpoint: "/api/s3/upload",
                outcome: "failed",
                duration_ms: Date.now() - startedAt,
            },
        });
        flushPosthogLogs();

        return NextResponse.json(
            {error: "Failed to generate presigned URL"},
            {status: 500}
        )
    }
}
