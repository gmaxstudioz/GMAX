import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { studio, userNotification } from "./schema";
import { sendSMS } from "./termii";
import { v4 as uuidv4 } from "uuid";

export async function notifyAdminsOfPayment(studioId: string, bookingId: string, amount: number, clientName: string, serviceName: string) {
    const foundStudio = await db.query.studio.findFirst({
        where: eq(studio.id, studioId),
        with: { members: { with: { user: true } } }
    });
    if (!foundStudio) return;

    const admins = foundStudio.members.filter((m: any) => ["owner", "admin", "manager"].includes(m.role));
    
    for (const admin of admins) {
        const message = `Payment Received: ₦${Math.round(amount).toLocaleString()} from ${clientName} for ${serviceName}.`;
        
        await db.insert(userNotification).values({
            id: uuidv4(),
            userId: admin.userId,
            title: "Payment Received",
            message,
            type: "SYSTEM",
            bookingId
        }).catch(console.error);

        if (admin.user?.phoneNumber) {
            await sendSMS(admin.user.phoneNumber, message).catch(console.error);
        }
    }
}
