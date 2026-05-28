import { prisma } from "./prisma";
import { sendSMS } from "./termii";

export async function notifyAdminsOfPayment(studioId: string, bookingId: string, amount: number, clientName: string, serviceName: string) {
    const studio = await prisma.studio.findUnique({
        where: { id: studioId },
        include: { members: { include: { user: true } } }
    });
    if (!studio) return;

    const admins = studio.members.filter((m: any) => ["owner", "admin", "manager"].includes(m.role));
    
    for (const admin of admins) {
        const message = `Payment Received: ₦${Math.round(amount).toLocaleString()} from ${clientName} for ${serviceName}.`;
        
        await prisma.userNotification.create({
            data: {
                userId: admin.userId,
                title: "Payment Received",
                message,
                type: "SYSTEM",
                bookingId
            }
        }).catch(console.error);

        if (admin.user?.phoneNumber) {
            await sendSMS(admin.user.phoneNumber, message).catch(console.error);
        }
    }
}
