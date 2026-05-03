import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ProfileForm } from "./_components/ProfileForm";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
    title: "Profile Settings",
    description: "Manage your account information and preferences.",
};

export default async function ProfilePage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    const fullUser = await prisma.user.findUnique({
        where: { id: session.user.id }
    });

    if (!fullUser) redirect("/login");

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6 max-w-4xl mx-auto w-full">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">Profile Settings</h1>
                <p className="text-muted-foreground">Manage your personal information, avatar, and account settings.</p>
            </div>
            
            <ProfileForm user={fullUser} />
        </div>
    );
}
