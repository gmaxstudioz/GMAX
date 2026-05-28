"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getUserNotifications() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { data: null, error: "Unauthorized" };
        
        const notifications = await prisma.userNotification.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            include: {
                booking: {
                    select: {
                        studio: {
                            select: {
                                slug: true
                            }
                        }
                    }
                }
            },
            take: 20
        });

        return { data: notifications, error: null };
    } catch {
        return { data: null, error: "Failed to fetch notifications" };
    }
}

export async function markNotificationAsRead(id: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { success: false, error: "Unauthorized" };
        
        await prisma.userNotification.updateMany({
            where: { id, userId: session.user.id },
            data: { isRead: true }
        });

        revalidatePath("/");
        
        return { success: true, error: null };
    } catch {
        return { success: false, error: "Failed to mark as read" };
    }
}

export async function markAllNotificationsAsRead() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { success: false, error: "Unauthorized" };
        
        await prisma.userNotification.updateMany({
            where: { userId: session.user.id, isRead: false },
            data: { isRead: true }
        });

        revalidatePath("/");
        
        return { success: true, error: null };
    } catch {
        return { success: false, error: "Failed to mark all as read" };
    }
}
