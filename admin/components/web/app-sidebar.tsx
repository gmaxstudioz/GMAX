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
import { LayoutDashboardIcon, ChartBarIcon, FolderIcon, UsersIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NavManagement, type NavManagementItem } from "./nav-management"
import { HugeiconsIcon } from "@hugeicons/react"
import { School01Icon, ToolsIcon, WarehouseIcon, ShoppingCart01Icon } from "@hugeicons/core-free-icons"
import { db } from "@/lib/db"
import * as schema from "@/lib/schema"
import { and, eq, inArray, asc, gt } from "drizzle-orm"
import { BriefcaseIcon, Wallet } from "lucide-react"

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
}

export async function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  
  let isOnlyMinorRole = false;
  let isPhotoVideoRole = false;
  let canAccessBookingsAndClients = false;
  let canAccessServices = false;
  let canAccessFinances = false;
  let canAccessRestrictedSections = false;
  let canAccessBackfill = false;
  let sidebarStudios: { name: string; slug: string }[] = [];

  if (session?.user) {
    const userData = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.id, session.user.id),
      columns: { role: true }
    });
    const members = await db.query.member.findMany({
      where: (member, { eq }) => eq(member.userId, session.user.id),
      columns: { role: true, studioId: true }
    });
    const ownerStudioIds = members.filter((member) => member.role === "owner").map((member) => member.studioId);

    const isAdmin = userData?.role === "admin";

    if (!isAdmin) {
      const adminRoles = ["owner", "developer", "admin", "manager"];
      const hasAdminRole = members.some(m => adminRoles.includes(m.role));
      canAccessBookingsAndClients = members.some((m) =>
        ["owner", "developer", "admin", "manager", "receptionist"].includes(m.role),
      );
      canAccessServices = members.some((m) => ["owner", "developer"].includes(m.role));
      canAccessFinances = members.some(m => ["owner", "developer", "manager", "receptionist"].includes(m.role));
      canAccessRestrictedSections = members.some(m => ["owner", "developer"].includes(m.role));
      if (ownerStudioIds.length > 0) {
        canAccessBackfill = true;
      } else {
        const backfillGrants = await db.query.bookingBackfillAccess.findMany({
          where: and(
            eq(schema.bookingBackfillAccess.userId, session.user.id),
            gt(schema.bookingBackfillAccess.expiresAt, new Date().toISOString()),
          ),
          columns: { studioId: true },
        });
        canAccessBackfill = backfillGrants.some((grant) =>
          members.some((membership) => membership.studioId === grant.studioId),
        );
      }
      isOnlyMinorRole = members.length > 0 && !hasAdminRole;

      const photoVideoRoles = ["photographer", "videographer"];
      isPhotoVideoRole = members.length > 0 && members.every(m => photoVideoRoles.includes(m.role));

      const memberStudioIds = members.map((m) => m.studioId);
      if (memberStudioIds.length > 0) {
        sidebarStudios = await db.query.studio.findMany({
          where: inArray(schema.studio.id, memberStudioIds),
          columns: { name: true, slug: true },
          orderBy: [asc(schema.studio.createdAt)],
          limit: 5,
        });
      }
    } else {
      canAccessBookingsAndClients = true;
      canAccessServices = true;
      canAccessFinances = true;
      canAccessRestrictedSections = true;
      canAccessBackfill = ownerStudioIds.length > 0;
      sidebarStudios = await db.query.studio.findMany({
        columns: { name: true, slug: true },
        orderBy: [asc(schema.studio.createdAt)],
        limit: 5,
      });
    }
  }

  const navManagement: NavManagementItem[] = [
    {
      title: "Studios",
      url: "/studios",
      icon: <HugeiconsIcon icon={WarehouseIcon} />,
      subItems: sidebarStudios.map((s) => ({
        title: s.name,
        url: `/studios/${s.slug}`,
      })),
    },
    {
      title: "Users",
      url: "/users",
      icon: <UsersIcon className="size-4" />,
    },
    ...(canAccessFinances ? [{
      title: "Finances",
      url: "/finances",
      icon: <Wallet className="size-4" />,
    }] : []),
    ...(canAccessServices ? [{
      title: "Services",
      url: "/services",
      icon: <HugeiconsIcon icon={ToolsIcon} />,
    }] : []),
    ...(canAccessRestrictedSections ? [{
      title: "Academy",
      url: "/academy",
      icon: <HugeiconsIcon icon={School01Icon} />,
    }] : []),
    ...(canAccessRestrictedSections ? [{
      title: "Store",
      url: "/store",
      icon: <HugeiconsIcon icon={ShoppingCart01Icon} />,
    }] : []),
    ...(canAccessRestrictedSections ? [{
      title: "Portfolio",
      url: "/portfolio",
      icon: <FolderIcon />,
    }] : []),
  ];

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
    ...(canAccessBookingsAndClients ? [
      {
        title: "Bookings",
        url: "/bookings",
        icon: <ChartBarIcon />,
      },
      {
        title: "Clients",
        url: "/clients",
        icon: <FolderIcon />,
      },
    ] : []),
    {
      title: "Studios",
      url: "/studios",
      icon: <HugeiconsIcon icon={WarehouseIcon} />,
    },
    ...(canAccessFinances ? [{
      title: "Finances",
      url: "/finances",
      icon: <Wallet className="size-4" />,
    }] : []),
    ...(canAccessBackfill ? [{
      title: "Bulk Bookings",
      url: "/bookings/backfill",
      icon: <ChartBarIcon />,
    }] : []),
  ];

  if (isPhotoVideoRole) {
    minorNavMain = minorNavMain.filter(item => item.url !== "/studios");
  }
  const navMain = [
    ...data.navMain.filter((item) =>
      (item.url !== "/bookings" && item.url !== "/clients") || canAccessBookingsAndClients,
    ),
    ...(canAccessBackfill ? [{
      title: "Bulk Bookings",
      url: "/bookings/backfill",
      icon: <ChartBarIcon />,
    }] : []),
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
                <span className="text-base font-semibold"> {APP_NAME} </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={isOnlyMinorRole ? minorNavMain : navMain} />
        {!isOnlyMinorRole && <NavManagement items={navManagement} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={session?.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
