"use server";

import { prisma } from "@/lib/prisma";
import z from "zod";
import { v4 as uuidv4 } from "uuid";
import { tryCatch } from "@/hooks/try-catch";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const CreateSessionSchema = z.object({
  name: z.string().min(1, "Session name is required"),
  duration: z.number().int().positive("Duration must be a positive number in minutes"),
  studioId: z.string().min(1, "Studio ID is required"),
});

export async function createStudioSession(data: { name: string; duration: number; studioId: string }) {
  const parsed = CreateSessionSchema.safeParse(data);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const { name, duration, studioId } = parsed.data;

  try {
    const userSession = await auth.api.getSession({ headers: await headers() });
    if (!userSession?.user) return { status: "error", message: "Unauthorized" };
    const member = await prisma.member.findFirst({ where: { userId: userSession.user.id, studioId } });
    if (!member) return { status: "error", message: "Unauthorized access to studio" };

    // Generate an ID manually since StudioSession lacks @default()
    const id = uuidv4();

    const newSession = await prisma.studioSession.create({
      data: {
        id,
        name,
        duration,
        studioId,
      },
    });

    revalidatePath(`/studios/[slug]`, "page");

    return { status: "success", message: "Studio session created successfully", data: newSession };
  } catch (error: any) {
    console.error("Failed to create studio session:", error);
    return { status: "error", message: error.message || "Something went wrong" };
  }
}

export async function deleteStudioSession(sessionId: string) {
  try {
    const existing = await prisma.studioSession.findUnique({ where: { id: sessionId } });
    if (!existing) return { status: "error", message: "Session not found" };
    const userSession = await auth.api.getSession({ headers: await headers() });
    if (!userSession?.user) return { status: "error", message: "Unauthorized" };
    const member = await prisma.member.findFirst({ where: { userId: userSession.user.id, studioId: existing.studioId } });
    if (!member) return { status: "error", message: "Unauthorized access to studio" };

    // Note: If services are bound via ON DELETE CASCADE to this, they'll also drop! 
    // Usually that's what Prisma does, check if they want to warn users.
    await prisma.studioSession.delete({
      where: {
        id: sessionId,
      },
    });

    revalidatePath(`/studios/[slug]`, "page");
    return { status: "success", message: "Studio session deleted successfully" };
  } catch (error: any) {
    console.error("Failed to delete studio session:", error);
    return { status: "error", message: "Could not delete session, it might be heavily used." };
  }
}
