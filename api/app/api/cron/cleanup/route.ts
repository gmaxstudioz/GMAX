import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { bookingIntent } from "@/lib/schema";
import { eq, and, lt } from "drizzle-orm";

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
        const deleted = await db.delete(bookingIntent)
            .where(and(eq(bookingIntent.status, "PENDING"), lt(bookingIntent.expiresAt, new Date().toISOString())))
            .returning();

        const deletedCount = deleted.length;

        console.log(`[Cron] Cleaned up ${deletedCount} abandoned booking intents.`);
        return NextResponse.json({ success: true, deletedCount: deletedCount });
    } catch (error) {
        console.error("[Cron] Failed to clean up intents:", error);
        getPostHogLogger()?.emit({
            body: "abandoned booking intent cleanup failed",
            severityNumber: SeverityNumber.ERROR,
        });
        after(flushPostHogLogs);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
