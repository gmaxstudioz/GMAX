"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarIcon,
  CircleUserIcon,
  CreditCardIcon,
  FolderOpenIcon,
  SettingsIcon,
  StoreIcon,
  UsersIcon,
  WrenchIcon,
  Building2Icon,
  ListTodoIcon,
  PackageOpenIcon
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { getGlobalSearchData } from "@/lib/actions/search";

type SearchData = Awaited<ReturnType<typeof getGlobalSearchData>>;

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<SearchData | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (open && !data) {
      getGlobalSearchData()
        .then(setData)
        .catch((error) => {
          console.error("Failed to load global search data:", error);
          toast.error("Failed to load search data. Please try again.");
        });
    }
  }, [open, data]);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-8 w-full justify-start rounded-[0.5rem] bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <span className="hidden lg:inline-flex">Search dashboard...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          <CommandGroup heading="Quick Links">
            <CommandItem onSelect={() => runCommand(() => router.push("/my-tasks"))}>
              <ListTodoIcon className="mr-2 h-4 w-4" />
              <span>My Tasks</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/bookings"))}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span>Bookings</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/clients"))}>
              <UsersIcon className="mr-2 h-4 w-4" />
              <span>Clients</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/store"))}>
              <StoreIcon className="mr-2 h-4 w-4" />
              <span>Store & Products</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/portfolio"))}>
              <FolderOpenIcon className="mr-2 h-4 w-4" />
              <span>Portfolio</span>
            </CommandItem>
          </CommandGroup>
          
          <CommandSeparator />
          
          {data?.clients && data.clients.length > 0 && (
            <CommandGroup heading="Clients">
              {data.clients.map((client) => (
                <CommandItem
                  key={`client-${client.id}`}
                  onSelect={() => runCommand(() => router.push(`/clients?search=${encodeURIComponent(client.name)}`))}
                >
                  <UsersIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{client.name}</span>
                    {client.email && <span className="text-xs text-muted-foreground">{client.email}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {data?.products && data.products.length > 0 && (
            <CommandGroup heading="Store Products">
              {data.products.map((product) => (
                <CommandItem
                  key={`product-${product.id}`}
                  onSelect={() => runCommand(() => router.push(`/store/${product.id}`))}
                >
                  <PackageOpenIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{product.title}</span>
                    <span className="text-xs text-muted-foreground">{product.isPublished ? 'Published' : 'Draft'}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {data?.services && data.services.length > 0 && (
            <CommandGroup heading="Services">
              {data.services.map((service) => (
                <CommandItem
                  key={`service-${service.id}`}
                  onSelect={() => runCommand(() => router.push(`/services?search=${encodeURIComponent(service.name)}`))}
                >
                  <WrenchIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{service.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {data?.studios && data.studios.length > 0 && (
            <CommandGroup heading="Studios">
              {data.studios.map((studio) => (
                <CommandItem
                  key={`studio-${studio.id}`}
                  onSelect={() => runCommand(() => router.push(`/studios/${studio.slug}`))}
                >
                  <Building2Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{studio.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />
          
          <CommandGroup heading="Management">
            <CommandItem onSelect={() => runCommand(() => router.push("/transactions"))}>
              <CreditCardIcon className="mr-2 h-4 w-4" />
              <span>Transactions</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/services"))}>
              <WrenchIcon className="mr-2 h-4 w-4" />
              <span>Services</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/studios"))}>
              <Building2Icon className="mr-2 h-4 w-4" />
              <span>Studios & Staff</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/academy"))}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              <span>Academy</span>
            </CommandItem>
          </CommandGroup>
          
          <CommandSeparator />
          
          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => runCommand(() => router.push("/profile"))}>
              <CircleUserIcon className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </CommandItem>
          </CommandGroup>

        </CommandList>
      </CommandDialog>
    </>
  );
}
