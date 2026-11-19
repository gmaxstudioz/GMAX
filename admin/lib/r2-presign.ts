import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3 } from "@/lib/S3Client";

export async function getAdminPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!key) return "";
    if (key.startsWith("http://") || key.startsWith("https://")) {
        return key;
    }
    const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
    });
    return getSignedUrl(S3, command, { expiresIn });
}
