"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GridIcon, ListIcon } from "lucide-react";
import { useCallback } from "react";

export function ViewToggle({ defaultView = "grid" }: { defaultView?: "grid" | "list" }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentView = searchParams.get("view") || defaultView;

    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set(name, value);
            return params.toString();
        },
        [searchParams]
    );

    return (
        <ToggleGroup 
            type="single" 
            value={currentView} 
            onValueChange={(v) => {
                if (v) router.push(pathname + "?" + createQueryString("view", v));
            }}
            className="border rounded-md"
        >
            <ToggleGroupItem value="grid" aria-label="Toggle grid view" className="px-3 h-9 data-[state=on]:bg-muted">
                <GridIcon className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Toggle list view" className="px-3 h-9 data-[state=on]:bg-muted">
                <ListIcon className="h-4 w-4" />
            </ToggleGroupItem>
        </ToggleGroup>
    );
}
