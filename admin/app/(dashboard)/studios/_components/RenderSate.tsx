import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GenericEmptyState } from "@/components/web/generic-empty-state";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { Building02Icon, Folder, Location09Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CirclePlusIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { StudioStatsCards } from "./StatsCards";
import { ViewToggle } from "@/components/web/ViewToggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

function parseMetadata(metadata: unknown): Record<string, unknown> {
    if (!metadata) return {};
    if (typeof metadata === "string") {
        try {
            return JSON.parse(metadata);
        } catch {
            return {};
        }
    }
    return metadata as Record<string, unknown>;
}

export interface StudioData {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    metadata?: unknown;
    [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function RenderStudios({ studioData, hasAdminRole, isListView }: { studioData: any[], hasAdminRole: boolean, isListView?: boolean }) {
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
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-1">
                            <HugeiconsIcon icon={Building02Icon} className="size-5" />
                            All Studios
                        </CardTitle>
                        <CardDescription>Manage your studios</CardDescription>
                    </div>
                    <ViewToggle defaultView="grid" />
                </CardHeader>
                {isListView ? (
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Logo</TableHead>
                                    <TableHead>Studio Name</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {studioData.map((studio) => {
                                    const meta = parseMetadata(studio.metadata);
                                    return (
                                        <TableRow key={studio.id}>
                                            <TableCell>
                                                <div className="w-12 h-12 rounded-md bg-muted overflow-hidden relative border flex items-center justify-center">
                                                    {studio.logo ? (
                                                        <Image src={logoUrl(studio.logo)} alt={studio.name} width={48} height={48} className="object-cover" />
                                                    ) : (
                                                        <HugeiconsIcon icon={Building02Icon} className="size-6 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-base">{studio.name}</div>
                                                <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{meta?.description as string}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm flex items-center gap-1">
                                                    <HugeiconsIcon icon={Location09Icon} className="size-3 text-muted-foreground" />
                                                    {meta?.address as string || "N/A"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{meta?.phone as string || "N/A"}</div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/studios/${studio.slug}`}>
                                                    Manage Studio
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                ) : (
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {studioData.map((studio) => {
                            const meta = parseMetadata(studio.metadata);
                            return (
                                <Card className="@container/card grid grid-cols-1 gap-4" key={studio.id}>
                                    <CardHeader className="flex flex-col items-center justify-center">
                                        {studio.logo ? (
                                            <Image src={logoUrl(studio.logo)} alt={studio.name} width={100} height={100} className="rounded-md object-cover" />
                                        ) : (
                                            <div className="w-[100px] h-[100px] rounded-md bg-muted flex items-center justify-center">
                                                <HugeiconsIcon icon={Building02Icon} className="size-10 text-muted-foreground" />
                                            </div>
                                        )}
                                    </CardHeader>
                                    <CardContent className="flex flex-col items-center justify-center text-center">
                                        <CardTitle className="text-2xl font-bold">{studio.name}</CardTitle>
                                        <p className="text-muted-foreground">{meta?.phone as string}</p>
                                        <div className="text-muted-foreground text-xs flex gap-1 mt-4 mb-2">
                                            <HugeiconsIcon icon={Location09Icon} className="size-4" /> {meta?.address as string}
                                        </div>
                                        <p className="text-muted-foreground line-clamp-2">{meta?.description as string}</p>
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
                )}
            </Card>
        </>
    )
}