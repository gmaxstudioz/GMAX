"use server";

import { db } from "@/lib/db";
import { user as userSchema } from "@/lib/schema";
import { eq } from "drizzle-orm";
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

    const [updatedUser] = await db.update(userSchema)
        .set({
            name: validatedData.name,
            image: validatedData.image || null,
            phoneNumber: validatedData.phoneNumber || null,
        })
        .where(eq(userSchema.id, session.user.id))
        .returning();

    revalidatePath("/profile");
    revalidatePath("/", "layout");
    
    return { success: true, user: updatedUser };
}
