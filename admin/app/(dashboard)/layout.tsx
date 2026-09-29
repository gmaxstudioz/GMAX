import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/web/app-sidebar";
import { SiteHeader } from "@/components/web/site-header";
import { CSSProperties, ReactNode } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: ReactNode}) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const user = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, session.user.id),
        columns: { role: true }
    });

    const isAdmin = user?.role === "admin";

    if (!isAdmin) {
        const membership = await db.query.member.findFirst({
            where: (member, { eq }) => eq(member.userId, session.user.id)
        });

        if (!membership) {
            redirect("/auth/waiting");
        }
    }
    return (
        <SidebarProvider
            style={
            {
                "--sidebar-width": "calc(var(--spacing) * 72)",
                "--header-height": "calc(var(--spacing) * 12)",
            } as CSSProperties
            }
        >
            <AppSidebar variant="inset" />
            <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <TooltipProvider>{children}</TooltipProvider>
                </div>
            </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
