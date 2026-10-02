"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getUserNotifications() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { data: null, error: "Unauthorized" };
        
        const notifications = await db.query.userNotification.findMany({
            where: eq(schema.userNotification.userId, session.user.id),
            orderBy: [desc(schema.userNotification.createdAt)],
            with: {
                booking: {
                    columns: {}, // we just want studio
                    with: {
                        studio: {
                            columns: {
                                slug: true
                            }
                        }
                    }
                }
            },
            limit: 20
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
        
        await db.update(schema.userNotification)
            .set({ isRead: true })
            .where(and(eq(schema.userNotification.id, id), eq(schema.userNotification.userId, session.user.id)));

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
        
        await db.update(schema.userNotification)
            .set({ isRead: true })
            .where(and(eq(schema.userNotification.userId, session.user.id), eq(schema.userNotification.isRead, false)));

        revalidatePath("/");
        
        return { success: true, error: null };
    } catch {
        return { success: false, error: "Failed to mark all as read" };
    }
}
