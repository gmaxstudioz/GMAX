import type { Metadata } from "next";
import CreateStudios from "../_components/CreateStudios";
import { BackButton } from "@/components/web/back-button";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Create Studio",
  description:
    "Set up a new studio with custom details, categories, and session configurations.",
};


export default async function CreateStudio() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect("/auth/login");
    }

    const dbUser = await db.query.user.findFirst({
        where: eq(schema.user.id, session.user.id),
        columns: { role: true },
    });

    if (dbUser?.role !== "admin") {
        const ownerMembership = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, session.user.id),
                eq(schema.member.role, "owner")
            ),
            columns: { id: true },
        });
        if (!ownerMembership) {
            redirect("/");
        }
    }

    return (
        <div className="flex flex-col gap-4 items-start py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <BackButton href="/studios" />
            <div className="flex flex-col items-center gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6 w-full">
                <CreateStudios className="max-w-4xl w-full" />
            </div>
        </div>
    )
}