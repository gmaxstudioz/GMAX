import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

const termiiWebhookSchema = z.object({
    message_id: z.string().min(1).max(200),
    status: z.string().min(1).max(64),
});

function timingSafeEqualStr(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function isAuthorizedTermiiWebhook(req: Request, rawBody: string): boolean {
    const termiiSecret = process.env.TERMII_SECRETE_KEY || process.env.TERMII_SECRET_KEY;
    const signature = req.headers.get("x-termii-signature");
    if (termiiSecret && signature) {
        const expected = crypto
            .createHmac("sha512", termiiSecret)
            .update(rawBody)
            .digest("hex");
        if (timingSafeEqualStr(signature, expected)) {
            return true;
        }
    }

    const webhookToken = process.env.TERMII_WEBHOOK_TOKEN;
    if (webhookToken) {
        const url = new URL(req.url);
        const queryToken = url.searchParams.get("token");
        const headerToken = req.headers.get("x-webhook-token");
        if (queryToken && timingSafeEqualStr(queryToken, webhookToken)) {
            return true;
        }
        if (headerToken && timingSafeEqualStr(headerToken, webhookToken)) {
            return true;
        }
    }

    return false;
}

export async function POST(req: Request) {
    try {
        const rawBody = await req.text();
        if (!isAuthorizedTermiiWebhook(req, rawBody)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const validation = termiiWebhookSchema.safeParse(parsedJson);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const { message_id, status } = validation.data;

        // Map Termii status to our NotificationStatus enum
        let notificationStatus: "SENT" | "DELIVERED" | "FAILED" = "SENT";
        
        const termiiStatus = status.toLowerCase();
        if (termiiStatus === "delivered") {
            notificationStatus = "DELIVERED";
        } else if (termiiStatus === "failed" || termiiStatus === "rejected" || termiiStatus === "undelivered") {
            notificationStatus = "FAILED";
        }

        const [updated] = await db.update(schema.notification)
            .set({ status: notificationStatus })
            .where(eq(schema.notification.providerId, message_id))
            .returning({ id: schema.notification.id });

        console.log(`[Termii Webhook] Updated notification ${message_id} to ${notificationStatus}`);

        return NextResponse.json({ received: true, updated: Boolean(updated) });
    } catch (error) {
        console.error("[Termii Webhook] Error processing webhook:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
