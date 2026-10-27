"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    return (
        <Tabs defaultValue={defaultTab} className="gap-4">
            <TabsList className="w-full sm:w-fit">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="cashouts">Cashouts</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">{overview}</TabsContent>
            <TabsContent value="transactions">{transactions}</TabsContent>
            <TabsContent value="cashouts">{cashouts}</TabsContent>
        </Tabs>
    );
}
