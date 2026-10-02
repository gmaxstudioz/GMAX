"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
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

    await db.update(schema.user)
        .set({
            name: validatedData.name,
            image: validatedData.image || null,
            phoneNumber: validatedData.phoneNumber || null,
        })
        .where(eq(schema.user.id, session.user.id));

    const user = await db.query.user.findFirst({
        where: eq(schema.user.id, session.user.id)
    });

    revalidatePath("/profile");
    revalidatePath("/", "layout");
    
    return { success: true, user };
}
