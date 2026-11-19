import { S3 } from "@/lib/S3Client";
import { requireS3KeyAccess } from "@/lib/s3-auth";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        
        const key = typeof body?.key === "string" ? body.key : "";

        if (!key) {
            return NextResponse.json(
                {error: "Missing or invalid object key"},
                { status: 400 }
            );
        }

        const authResult = await requireS3KeyAccess(req.headers, key, "delete");
        if (!authResult.ok) return authResult.response;

        const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        });

        await S3.send(command);

        return NextResponse.json(
            { message: "File deleted successfully" },
            { status: 200 }
        )
    } catch {
        return NextResponse.json(
            { error: "Failed to delete file, missing or invalid object key" },
            { status: 500 }
        )
    }
}
