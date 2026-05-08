"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const UpdateProfileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    image: z.string().optional(),
    phoneNumber: z.string().optional(),
});

export async function updateUserProfile(data: z.infer<typeof UpdateProfileSchema>) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        throw new Error("Unauthorized");
    }

    const validatedData = UpdateProfileSchema.parse(data);

    const user = await prisma.user.update({
        where: { id: session.user.id },
        data: {
            name: validatedData.name,
            image: validatedData.image || null,
            phoneNumber: validatedData.phoneNumber || null,
        },
    });

    revalidatePath("/profile");
    revalidatePath("/", "layout");
    
    return { success: true, user };
}
