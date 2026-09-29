"use server";

import { db } from "@/lib/db";
import { studioSession, member } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import z from "zod";
import { v4 as uuidv4 } from "uuid";

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
    
    const memberRecord = await db.query.member.findFirst({ 
      where: and(eq(member.userId, userSession.user.id), eq(member.studioId, studioId)) 
    });
    
    if (!memberRecord) return { status: "error", message: "Unauthorized access to studio" };

    // Generate an ID manually since StudioSession lacks @default()
    const id = uuidv4();

    const [newSession] = await db.insert(studioSession).values({
        id,
        name,
        duration,
        studioId,
    }).returning();

    revalidatePath(`/studios/[slug]`, "page");

    return { status: "success", message: "Studio session created successfully", data: newSession };
  } catch (error) {
    console.error("Failed to create studio session:", error);
    return { status: "error", message: error instanceof Error ? error.message : "Something went wrong" };
  }
}

export async function deleteStudioSession(sessionId: string) {
  try {
    const existing = await db.query.studioSession.findFirst({ where: eq(studioSession.id, sessionId) });
    if (!existing) return { status: "error", message: "Session not found" };
    
    const userSession = await auth.api.getSession({ headers: await headers() });
    if (!userSession?.user) return { status: "error", message: "Unauthorized" };
    
    const memberRecord = await db.query.member.findFirst({ 
      where: and(eq(member.userId, userSession.user.id), eq(member.studioId, existing.studioId)) 
    });
    
    if (!memberRecord) return { status: "error", message: "Unauthorized access to studio" };

    // Note: If services are bound via ON DELETE CASCADE to this, they'll also drop! 
    // Usually that's what Prisma does, check if they want to warn users.
    await db.delete(studioSession).where(eq(studioSession.id, sessionId));

    revalidatePath(`/studios/[slug]`, "page");
    return { status: "success", message: "Studio session deleted successfully" };
  } catch (error) {
    console.error("Failed to delete studio session:", error);
    return { status: "error", message: "Could not delete session, it might be heavily used." };
  }
}
