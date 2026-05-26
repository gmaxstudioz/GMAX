import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Termii delivery webhook payload typically contains message_id and status
        const { message_id, status } = body;

        if (!message_id || !status) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Map Termii status to our NotificationStatus enum
        let notificationStatus: "SENT" | "DELIVERED" | "FAILED" = "SENT";
        
        const termiiStatus = status.toLowerCase();
        if (termiiStatus === "delivered") {
            notificationStatus = "DELIVERED";
        } else if (termiiStatus === "failed" || termiiStatus === "rejected" || termiiStatus === "undelivered") {
            notificationStatus = "FAILED";
        }

        const notification = await prisma.notification.update({
            where: { providerId: message_id },
            data: { status: notificationStatus },
        });

        console.log(`[Termii Webhook] Updated notification ${message_id} to ${notificationStatus}`);

        return NextResponse.json({ success: true, notificationId: notification.id });
    } catch (error) {
        console.error("[Termii Webhook] Error processing webhook:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
