import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GenericEmptyState } from "@/components/web/generic-empty-state";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { Studio } from "@/lib/generated/prisma/client";
import { Building02Icon, Folder, Location09Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CirclePlusIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { StudioStatsCards } from "./StatsCards";

export function RenderEmptyState({ hasAdminRole }: { hasAdminRole: boolean }) {
    if (!hasAdminRole) {
        return (
            <GenericEmptyState
                icon={<HugeiconsIcon icon={Folder} />}
                title="No Studios Available"
                description="You are not a member of any studio."
            />
        )
    }
    return (
        <GenericEmptyState
            icon={<HugeiconsIcon icon={Folder} />}
            title="No Studios Yet"
            description="You haven't created any studios yet. Get started by creating your first studio."
            actionLink="/studios/create"
            actionText="Create Studio"
            actionIcon={<CirclePlusIcon />}
        />
    )
}

function parseMetadata(metadata: any): Record<string, any> {
    if (!metadata) return {};
    if (typeof metadata === "string") {
        try {
            return JSON.parse(metadata);
        } catch (e) {
            return {};
        }
    }
    return metadata as Record<string, any>;
}

export async function RenderStudios({ studioData, hasAdminRole }: { studioData: any[], hasAdminRole: boolean }) {
    const logoUrl = useConstructUrl;


    return (
        <>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Studios</h1>
                    <p className="text-muted-foreground">Manage your studios</p>
                </div>
                {hasAdminRole && (
                    <Link className={buttonVariants()} href="/studios/create">
                        <CirclePlusIcon />
                        Add Studio
                    </Link>
                )}
            </div>
            <StudioStatsCards studioData={studioData} />
            <Card className="bg-card/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-1">
                        <HugeiconsIcon icon={Building02Icon} className="size-5" />
                        All Studios
                    </CardTitle>
                    <CardDescription>Manage your studios</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studioData.map((studio) => {
                        const meta = parseMetadata(studio.metadata);
                        return (
                            <Card className="@container/card grid grid-cols-1 gap-4" key={studio.id}>
                                <CardHeader className="flex flex-col items-center justify-center">
                                    <Image src={logoUrl(studio?.logo || "")} alt={studio.name} width={100} height={100} />
                                </CardHeader>
                                <CardContent className="flex flex-col items-center justify-center text-center">
                                    <CardTitle className="text-2xl font-bold">{studio.name}</CardTitle>
                                    <p className="text-muted-foreground">{meta?.phone}</p>
                                    <div className="text-muted-foreground text-xs flex gap-1 mt-4 mb-2">
                                        <HugeiconsIcon icon={Location09Icon} className="size-4" /> {meta?.address}
                                    </div>
                                    <p className="text-muted-foreground">{meta?.description}</p>
                                </CardContent>
                                <CardFooter>
                                    <Link className={buttonVariants({ className: "w-full", variant: "secondary" })} href={`/studios/${studio.slug}`}>
                                        View
                                    </Link>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </CardContent>
            </Card>
        </>
    )
}