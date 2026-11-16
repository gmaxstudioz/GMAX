"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FinanceTabs({
    defaultTab,
    overview,
    transactions,
    cashouts,
}: {
    defaultTab: "overview" | "transactions" | "cashouts";
    overview: ReactNode;
    transactions: ReactNode;
    cashouts: ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const activeTab = searchParams.get("tab") || defaultTab || "overview";

    const handleTabChange = (newTab: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (newTab === "overview") {
            params.delete("tab");
        } else {
            params.set("tab", newTab);
        }
        const qs = params.toString();
        startTransition(() => {
            router.push(qs ? `${pathname}?${qs}` : pathname);
        });
    };

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
            <TabsList className="w-full sm:w-fit items-center">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="cashouts">Cashouts</TabsTrigger>
                {isPending && (
                    <span className="flex items-center gap-1.5 px-2 text-xs text-primary font-medium animate-pulse">
                        <Loader2 className="size-3 animate-spin" />
                        <span className="hidden sm:inline">Loading...</span>
                    </span>
                )}
            </TabsList>
            <TabsContent value="overview" className={cn("space-y-6 transition-opacity", isPending && "opacity-60")}>
                {overview}
            </TabsContent>
            <TabsContent value="transactions" className={cn("transition-opacity", isPending && "opacity-60")}>
                {transactions}
            </TabsContent>
            <TabsContent value="cashouts" className={cn("transition-opacity", isPending && "opacity-60")}>
                {cashouts}
            </TabsContent>
        </Tabs>
    );
}
