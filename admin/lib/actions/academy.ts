"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../auth";
import { headers } from "next/headers";

async function requireAdmin() {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
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

    const course = await prisma.academyCourse.create({
        data: {
            title: data.title,
            description: data.description,
            price: data.price,
            duration: data.duration,
            location: data.location,
            thumbnail: data.thumbnail,
            isPublished: data.isPublished ?? false,
        },
    });

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

    const course = await prisma.academyCourse.update({
        where: { id },
        data,
    });

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
    const batch = await prisma.academyBatch.create({
        data: {
            courseId: data.courseId,
            name: data.name,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
        },
    });
    revalidatePath("/academy");
    return batch;
}

export async function updateBatch(id: string, data: {
    name?: string;
    startDate?: string;
    endDate?: string;
}) {
    await requireAdmin();
    const batch = await prisma.academyBatch.update({
        where: { id },
        data: {
            name: data.name,
            ...(data.startDate && { startDate: new Date(data.startDate) }),
            ...(data.endDate && { endDate: new Date(data.endDate) }),
        },
    });
    revalidatePath("/academy");
    return batch;
}

export async function deleteBatch(id: string) {
    await requireAdmin();
    await prisma.academyBatch.delete({ where: { id } });
    revalidatePath("/academy");
}

export async function deleteCourse(id: string) {
    await requireAdmin();
    await prisma.academyCourse.delete({ where: { id } });
    revalidatePath("/academy");
}

export async function createModule(data: {
    courseId: string;
    title: string;
    description?: string | null;
    sortOrder?: number;
}) {
    await requireAdmin();

    const newModule = await prisma.academyModule.create({
        data: {
            courseId: data.courseId,
            title: data.title,
            description: data.description,
            sortOrder: data.sortOrder ?? 0,
        },
    });

    revalidatePath("/academy");
    return newModule;
}

export async function updateModule(id: string, data: {
    title?: string;
    description?: string | null;
    sortOrder?: number;
}) {
    await requireAdmin();

    const updated = await prisma.academyModule.update({
        where: { id },
        data,
    });

    revalidatePath("/academy");
    return updated;
}

export async function deleteModule(id: string) {
    await requireAdmin();
    await prisma.academyModule.delete({ where: { id } });
    revalidatePath("/academy");
}
