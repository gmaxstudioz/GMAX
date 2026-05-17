import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/web/app-sidebar";
import { SiteHeader } from "@/components/web/site-header";
import { CSSProperties, ReactNode } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: ReactNode}) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
    });

    const isAdmin = user?.role === "admin";

    if (!isAdmin) {
        const membership = await prisma.member.findFirst({
            where: { userId: session.user.id }
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