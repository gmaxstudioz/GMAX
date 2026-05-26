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
        const deletedIntents = await prisma.bookingIntent.deleteMany({
            where: {
                status: "PENDING",
                expiresAt: { lt: new Date() },
            },
        });
        
        console.log(`[Cron] Cleaned up ${deletedIntents.count} abandoned booking intents.`);

        // Delete all expired photos (5 days after delivery)
        const expiredPhotos = await prisma.photo.findMany({
            where: {
                expiresAt: { lt: new Date() },
            }
        });

        const { deleteFromR2 } = await import("@/lib/r2");
        let deletedPhotosCount = 0;

        for (const photo of expiredPhotos) {
            try {
                // Delete from R2
                await deleteFromR2(photo.r2Key);
                if (photo.thumbnailKey) {
                    await deleteFromR2(photo.thumbnailKey);
                }
                
                // Delete from DB
                await prisma.photo.delete({
                    where: { id: photo.id }
                });
                
                deletedPhotosCount++;
            } catch (err) {
                console.error(`[Cron] Failed to delete photo ${photo.id}:`, err);
            }
        }
        
        if (deletedPhotosCount > 0) {
            console.log(`[Cron] Cleaned up ${deletedPhotosCount} expired photos.`);
        }

        return NextResponse.json({ 
            success: true, 
            deletedIntents: deletedIntents.count,
            deletedPhotos: deletedPhotosCount 
        });
    } catch (error) {
        console.error("[Cron] Failed to clean up intents:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}