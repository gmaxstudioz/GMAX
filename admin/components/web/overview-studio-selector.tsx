"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Loader2, WarehouseIcon } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export interface StudioOption {
  id: string;
  name: string;
  slug: string;
}

export function OverviewStudioSelector({
  studios,
  selectedStudioSlug,
  showAllOption = true,
}: {
  studios: StudioOption[];
  selectedStudioSlug?: string | null;
  showAllOption?: boolean;
  isManager?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  if (studios.length <= 1) {
    if (studios.length === 1) {
      return (
        <Badge variant="outline" className="px-2.5 py-1 text-xs font-medium gap-1.5 bg-muted/30">
          <WarehouseIcon className="size-3 text-muted-foreground" />
          <span>{studios[0].name}</span>
        </Badge>
      );
    }
    return null;
  }

  const currentValue = selectedStudioSlug ?? (showAllOption ? "all" : studios[0].slug);

  const handleSelect = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!val) {
      params.delete("studio");
    } else {
      params.set("studio", val);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  return (
    <Select value={currentValue} disabled={isPending} onValueChange={handleSelect}>
      <SelectTrigger className="h-8 w-44 text-xs font-medium bg-card">
        {isPending ? (
          <Loader2 className="size-3 animate-spin text-primary mr-1.5" />
        ) : (
          <WarehouseIcon className="size-3 text-muted-foreground mr-1.5" />
        )}
        <SelectValue placeholder={showAllOption ? "All Studios" : "Select studio"} />
      </SelectTrigger>
      <SelectContent>
        {showAllOption && (
          <SelectItem value="all" className="text-xs">
            All Studios
          </SelectItem>
        )}
        {studios.map((s) => (
          <SelectItem key={s.id} value={s.slug} className="text-xs">
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
