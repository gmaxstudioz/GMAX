import * as React from "react"
import { NavMain } from "@/components/web/nav-main"
import { NavSecondary } from "@/components/web/nav-secondary"
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
import { LayoutDashboardIcon, ChartBarIcon, FolderIcon, Settings2Icon, SearchIcon } from "lucide-react"
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
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: (
        <Settings2Icon />
      ),
    },
    {
      title: "Search",
      url: "#",
      icon: (
        <SearchIcon
        />
      ),
    },
  ],
}

export async function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  
  let isOnlyMinorRole = false;
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
      
      // Check if user has NO administrative roles across all studios
      const adminRoles = ["owner", "developer", "manager"];
      const hasAdminRole = members.some(m => adminRoles.includes(m.role));
      isOnlyMinorRole = members.length > 0 && !hasAdminRole;
    }
  }

  // Create restricted nav for minor roles
  const minorNavMain = [
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
                <span className="text-base font-semibold">GMAX Studioz</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={isOnlyMinorRole ? minorNavMain : data.navMain} />
        {!isOnlyMinorRole && <NavManagement items={data.navManagement} />}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={session?.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
