import { S3 } from "@/lib/S3Client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        
        const key = body.key;

        if (!key) {
            return NextResponse.json(
                {error: "Missing or invalid object key"},
                { status: 400 }
            );
        }

        const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        });

        await S3.send(command);

        return NextResponse.json(
            { message: "File deleted successfully" },
            { status: 200 }
        )
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to delete file, missing or invalid object key" },
            { status: 500 }
        )
    }
}
