"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
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
    
    const member = await db.query.member.findFirst({ 
      where: and(eq(schema.member.userId, userSession.user.id), eq(schema.member.studioId, studioId)) 
    });
    
    if (!member) return { status: "error", message: "Unauthorized access to studio" };

    const id = uuidv4();

    await db.insert(schema.studioSession).values({
      id,
      name,
      duration,
      studioId,
    });
    
    const newSession = await db.query.studioSession.findFirst({
        where: eq(schema.studioSession.id, id)
    });

    revalidatePath(`/studios/[slug]`, "page");

    return { status: "success", message: "Studio session created successfully", data: newSession };
  } catch (error) {
    console.error("Failed to create studio session:", error);
    return { status: "error", message: error instanceof Error ? error.message : "Something went wrong" };
  }
}

export async function deleteStudioSession(sessionId: string) {
  try {
    const existing = await db.query.studioSession.findFirst({ where: eq(schema.studioSession.id, sessionId) });
    if (!existing) return { status: "error", message: "Session not found" };
    
    const userSession = await auth.api.getSession({ headers: await headers() });
    if (!userSession?.user) return { status: "error", message: "Unauthorized" };
    
    const member = await db.query.member.findFirst({ 
      where: and(eq(schema.member.userId, userSession.user.id), eq(schema.member.studioId, existing.studioId)) 
    });
    
    if (!member) return { status: "error", message: "Unauthorized access to studio" };

    await db.delete(schema.studioSession).where(eq(schema.studioSession.id, sessionId));

    revalidatePath(`/studios/[slug]`, "page");
    return { status: "success", message: "Studio session deleted successfully" };
  } catch (error) {
    console.error("Failed to delete studio session:", error);
    return { status: "error", message: "Could not delete session, it might be heavily used." };
  }
}
