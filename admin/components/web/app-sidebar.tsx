import { APP_NAME } from "@/lib/constants";
import * as React from "react"
import { NavMain } from "@/components/web/nav-main"
import { NavUser } from "@/components/web/nav-user"
import Logo from "@/public/Logo.png"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboardIcon, ChartBarIcon, FolderIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NavManagement } from "./nav-management"
import { HugeiconsIcon } from "@hugeicons/react"
import { School01Icon, ToolsIcon, WarehouseIcon, ShoppingCart01Icon, CreditCardIcon } from "@hugeicons/core-free-icons"
import { prisma } from "@/lib/prisma"
import { BriefcaseIcon } from "lucide-react"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Overview",
      url: "/",
      icon: (
        <LayoutDashboardIcon
        />
      ),
    },
    {
      title: "Bookings",
      url: "/bookings",
      icon: (
        <ChartBarIcon
        />
      ),
    },
    {
      title: "My Tasks",
      url: "/my-tasks",
      icon: <BriefcaseIcon />,
    },
    {
      title: "Clients",
      url: "/clients",
      icon: (
        <FolderIcon
        />
      ),
    },
  ],
  navManagement: [
    {
      title: "Studios",
      url: "/studios",
      icon: (
        <HugeiconsIcon icon={WarehouseIcon} />
      ),
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: (
        <HugeiconsIcon icon={CreditCardIcon} />
      ),
    },
    {
      title: "Services",
      url: "/services",
      icon: (
        <HugeiconsIcon icon={ToolsIcon} />
      ),
    },
    {
      title: "Academy",
      url: "/academy",
      icon: (
        <HugeiconsIcon icon={School01Icon} />
      ),
    },
    {
      title: "Store",
      url: "/store",
      icon: (
        <HugeiconsIcon icon={ShoppingCart01Icon} />
      ),
    },
    {
      title: "Portfolio",
      url: "/portfolio",
      icon: (
        <FolderIcon />
      ),
    },
  ],
}

export async function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  
  let isOnlyMinorRole = false;
  let isPhotoVideoRole = false;

  if (session?.user) {
    const userData = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    const isAdmin = userData?.role === "admin";

    if (!isAdmin) {
      const members = await prisma.member.findMany({
        where: { userId: session.user.id },
        select: { role: true }
      });
      
      const adminRoles = ["owner", "developer", "admin"];
      const hasAdminRole = members.some(m => adminRoles.includes(m.role));
      isOnlyMinorRole = members.length > 0 && !hasAdminRole;

      const photoVideoRoles = ["photographer", "videographer"];
      isPhotoVideoRole = members.length > 0 && members.every(m => photoVideoRoles.includes(m.role));
    }
  }

  let minorNavMain = [
    {
      title: "Overview",
      url: "/",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "My Tasks",
      url: "/my-tasks",
      icon: <BriefcaseIcon />,
    },
    {
      title: "Studios",
      url: "/studios",
      icon: <HugeiconsIcon icon={WarehouseIcon} />,
    },
  ];

  if (isPhotoVideoRole) {
    minorNavMain = minorNavMain.filter(item => item.url !== "/studios");
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/">
                <Image src={Logo} alt="Logo" className="size-5!" />
                <span className="text-base font-semibold"> {APP_NAME} </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={isOnlyMinorRole ? minorNavMain : data.navMain} />
        {!isOnlyMinorRole && <NavManagement items={data.navManagement} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={session?.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
