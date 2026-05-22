import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    // Optional: Protect this route with a secret key so only your cron job can trigger it
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ success: false }, { status: 500 });
    }
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        // Delete all intents that are still PENDING and have passed their expiration time
        const deleted = await prisma.bookingIntent.deleteMany({
            where: {
                status: "PENDING",
                expiresAt: { lt: new Date() },
            },
        });

        console.log(`[Cron] Cleaned up ${deleted.count} abandoned booking intents.`);
        return NextResponse.json({ success: true, deletedCount: deleted.count });
    } catch (error) {
        console.error("[Cron] Failed to clean up intents:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}