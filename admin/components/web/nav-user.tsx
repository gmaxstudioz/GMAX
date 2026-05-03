"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"
import { EllipsisVerticalIcon, CircleUserRoundIcon, BellIcon, LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ThemeToggle } from "./theme-toggle"
import Link from "next/link"
import { buttonVariants } from "../ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { LogIn } from "@hugeicons/core-free-icons"

export function NavUser({
  user,
}: {
  user?: {
    name: string
    email: string
    image?: string | null
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter();

  async function SignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Logged out successfully");
          router.push("/auth/login");
        },
        onError: () => {
          toast.error("Failed to log out");
        }
      },
    });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg grayscale">
                  <AvatarImage src={user.image ?? `https://avatar.vercel.sh/${user.name.split(" ")[0]}.svg?text=${user.name.split(" ")[0][0] + user.name.split(" ")[1][0]}`} alt={user.name} className="rounded-full" />
                  <AvatarFallback className="rounded-lg">{user.name.split(" ")[0][0] + user.name.split(" ")[1][0]}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
                
                <EllipsisVerticalIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.image ?? `https://avatar.vercel.sh/${user.name.split(" ")[0]}.svg?text=${user.name.split(" ")[0][0] + user.name.split(" ")[1][0]}`} alt={user.name} className="rounded-full" />
                    <AvatarFallback className="rounded-lg">{user.name.split(" ")[0][0] + user.name.split(" ")[1][0]}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <ThemeToggle />
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <CircleUserRoundIcon />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <BellIcon
                  />
                  Notifications
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={SignOut} className="focus:bg-destructive/10 cursor-pointer text-destructive">
                <LogOutIcon className="text-destructive" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <SidebarMenuButton
            asChild
            className="data-[slot=sidebar-menu-button]:p-1.5!"
          >
            <Link href="/auth/login" className={buttonVariants()}>
              <HugeiconsIcon icon={LogIn} size={30} />
              <span className="text-base font-semibold">Login</span>
            </Link>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
