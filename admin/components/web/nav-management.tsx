"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"

import { Collapsible } from "radix-ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRightIcon } from "lucide-react"

export type NavManagementItem = {
  title: string
  url: string
  icon: React.ReactNode
  subItems?: {
    title: string
    url: string
  }[]
}

export function NavManagement({
    items,
    ...props
  }: {
    items: NavManagementItem[]
  } & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden" {...props}>
      <SidebarGroupLabel>Management</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) =>
          item.subItems && item.subItems.length > 0 ? (
            <Collapsible.Root
              key={item.title}
              asChild
              defaultOpen={pathname.startsWith(item.url)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <Collapsible.Trigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                    <ChevronRightIcon className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <SidebarMenuSub>
                    {item.subItems.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.url}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === subItem.url || pathname.startsWith(subItem.url + "/")}
                        >
                          <Link href={subItem.url}>
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <Link href={item.url} className="text-muted-foreground">
                          <span>View all</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </Collapsible.Content>
              </SidebarMenuItem>
            </Collapsible.Root>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={pathname === item.url}>
                <Link href={item.url}>
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
