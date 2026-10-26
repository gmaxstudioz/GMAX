import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUsersForManagement } from "@/lib/actions/user";
import { UserManagementView } from "./_components/UserManagementView";

export const metadata: Metadata = {
    title: "User Management | GMAX Studioz",
    description: "Manage registered users, review access requests, and assign team members to studios.",
};

export default async function UsersPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const result = await getUsersForManagement();

    if (result.status === "error" || !result.data) {
        redirect("/");
    }

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <UserManagementView
                initialUsers={result.data.users}
                managedStudios={result.data.managedStudios}
                initialPendingInvitations={result.data.pendingInvitations}
                isPlatformAdmin={result.data.isPlatformAdmin}
            />
        </div>
    );
}
