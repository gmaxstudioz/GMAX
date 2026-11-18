"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GridIcon, ListIcon, Loader2 } from "lucide-react";
import { useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";

export function ViewToggle({ defaultView = "grid" }: { defaultView?: "grid" | "list" }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const currentView = searchParams.get("view") || defaultView;

    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set(name, value);
            return params.toString();
        },
        [searchParams]
    );

    const handleViewChange = (v: string) => {
        if (!v) return;
        startTransition(() => {
            router.push(pathname + "?" + createQueryString("view", v));
        });
    };

    return (
        <div className="flex items-center gap-2">
            <ToggleGroup 
                type="single" 
                value={currentView} 
                disabled={isPending}
                onValueChange={handleViewChange}
                className={cn("border rounded-md", isPending && "opacity-70")}
            >
                <ToggleGroupItem value="grid" aria-label="Toggle grid view" className="px-3 h-9 data-[state=on]:bg-muted">
                    <GridIcon className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Toggle list view" className="px-3 h-9 data-[state=on]:bg-muted">
                    <ListIcon className="h-4 w-4" />
                </ToggleGroupItem>
            </ToggleGroup>
            {isPending && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            )}
        </div>
    );
}
