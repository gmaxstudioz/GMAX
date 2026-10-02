"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "../auth";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";

async function requireAdmin() {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    const dbUser = await db.query.user.findFirst({
        where: eq(schema.user.id, session.user.id),
        columns: { role: true }
    });
    if (dbUser?.role !== "admin") {
        throw new Error("Unauthorized");
    }
}

export async function createCourse(data: {
    title: string;
    description: string;
    price: number;
    duration?: string | null;
    location?: string | null;
    thumbnail?: string | null;
    isPublished?: boolean;
}) {
    await requireAdmin();

    const [course] = await db.insert(schema.academyCourse).values({
        id: uuidv4(),
        title: data.title,
        description: data.description,
        price: data.price.toString(),
        duration: data.duration,
        location: data.location,
        thumbnail: data.thumbnail,
        isPublished: data.isPublished ?? false,
    }).returning();

    revalidatePath("/academy");
    return course;
}

export async function updateCourse(id: string, data: {
    title?: string;
    description?: string;
    price?: number;
    duration?: string | null;
    location?: string | null;
    thumbnail?: string | null;
    isPublished?: boolean;
}) {
    await requireAdmin();

    const updateData: any = { ...data };
    if (data.price !== undefined) {
        updateData.price = data.price.toString();
    }

    const [course] = await db.update(schema.academyCourse)
        .set(updateData)
        .where(eq(schema.academyCourse.id, id))
        .returning();

    revalidatePath("/academy");
    return course;
}

// ── Batches ──────────────────────────────────────────────────────────

export async function createBatch(data: {
    courseId: string;
    name: string;
    startDate: string;
    endDate: string;
}) {
    await requireAdmin();
    const [batch] = await db.insert(schema.academyBatch).values({
        id: uuidv4(),
        courseId: data.courseId,
        name: data.name,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
    }).returning();
    
    revalidatePath("/academy");
    return batch;
}

export async function updateBatch(id: string, data: {
    name?: string;
    startDate?: string;
    endDate?: string;
}) {
    await requireAdmin();
    
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate).toISOString();
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate).toISOString();

    const [batch] = await db.update(schema.academyBatch)
        .set(updateData)
        .where(eq(schema.academyBatch.id, id))
        .returning();
        
    revalidatePath("/academy");
    return batch;
}

export async function deleteBatch(id: string) {
    await requireAdmin();
    await db.delete(schema.academyBatch).where(eq(schema.academyBatch.id, id));
    revalidatePath("/academy");
}

export async function deleteCourse(id: string) {
    await requireAdmin();
    await db.delete(schema.academyCourse).where(eq(schema.academyCourse.id, id));
    revalidatePath("/academy");
}

export async function createModule(data: {
    courseId: string;
    title: string;
    description?: string | null;
    sortOrder?: number;
}) {
    await requireAdmin();

    const [newModule] = await db.insert(schema.academyModule).values({
        id: uuidv4(),
        courseId: data.courseId,
        title: data.title,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
    }).returning();

    revalidatePath("/academy");
    return newModule;
}

export async function updateModule(id: string, data: {
    title?: string;
    description?: string | null;
    sortOrder?: number;
}) {
    await requireAdmin();

    const [updated] = await db.update(schema.academyModule)
        .set(data)
        .where(eq(schema.academyModule.id, id))
        .returning();

    revalidatePath("/academy");
    return updated;
}

export async function deleteModule(id: string) {
    await requireAdmin();
    await db.delete(schema.academyModule).where(eq(schema.academyModule.id, id));
    revalidatePath("/academy");
}
