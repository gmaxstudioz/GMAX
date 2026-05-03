import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getMemberTasks } from "@/lib/actions/task";
import { CallIcon, House01Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { AssignedTasksList } from "./_components/assigned-tasks";
import { BackButton } from "@/components/web/back-button";
import { EditStaffDialog } from "./_components/edit-staff-dialog";

interface MemberPageProps {
    params: Promise<{ memberId: string; slug: string }>
}

export default async function MemberPage({ params }: MemberPageProps) {
    const { memberId, slug } = await params;

    const memberData = await prisma.member.findUnique({
        where: {
            id: memberId,
        },
        include: {
            user: true,
            studio: true,
            bookings: true,
        }
    });

    const initialTasks = await getMemberTasks(memberId, 0, "", "All");

    return (
        <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                    <BackButton />
                    <h1 className="text-2xl font-bold">Staff Profile</h1>
                </div>
                {memberData?.user && memberData?.studio && (
                    <EditStaffDialog 
                        memberId={memberData.id} 
                        userId={memberData.user.id} 
                        studioId={memberData.studio.id} 
                        initialData={{
                            name: memberData.user.name,
                            email: memberData.user.email,
                            phoneNumber: memberData.user.phoneNumber,
                            role: memberData.role
                        }} 
                    />
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-4">
                    <Card className="@container/card h-[220px]">
                        <CardHeader>
                            <div className="flex flex-row gap-4">
                                <Image src={memberData?.user.image || "/images/placeholder.jpg"} alt="Profile" width={120} height={120} className="rounded-lg" />
                                <div className="flex flex-col gap-1">
                                    <h1 className="text-2xl font-bold">{memberData?.user.name}</h1>
                                    <Badge>
                                        {memberData?.role.toUpperCase()}
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>
                    <Card className="h-full">
                        <CardContent className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <HugeiconsIcon icon={CallIcon} size={16} strokeWidth={2} />
                                    <p className="text-sm">Phone Number</p>
                                </div>
                                <p className="text-lg p-1 px-2 bg-primary/10 rounded-lg">{memberData?.user.phoneNumber || "No phone number added"}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-1 text-muted-foreground">
                                    <HugeiconsIcon icon={Mail01Icon} size={16} strokeWidth={2} />
                                    <p className="text-sm">Email</p>
                                </div>
                                <p className="text-lg p-1 px-2 bg-primary/10 rounded-lg">{memberData?.user.email}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <HugeiconsIcon icon={House01Icon} size={16} strokeWidth={2} />
                                    <p className="text-sm">Studio</p>
                                </div>
                                <p className="text-lg p-1 px-2 bg-primary/10 rounded-lg">{memberData?.studio.name}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-3 flex flex-col gap-4 w-full">
                    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
                        <Card>
                            <CardContent>
                                <CardTitle>Asign Tasks</CardTitle>
                                <p className="text-primary font-bold text-2xl">{memberData?.bookings.length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <CardTitle>Completed Tasks</CardTitle>
                                <p className="text-primary font-bold text-2xl">{memberData?.bookings.filter((booking) => booking.bookingStatus === "COMPLETED").length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <CardTitle>Pending Tasks</CardTitle>
                                <p className="text-primary font-bold text-2xl">{memberData?.bookings.filter((booking) => booking.bookingStatus === "PENDING").length}</p>
                            </CardContent>
                        </Card>
                    </div>
                    <AssignedTasksList 
                        initialTasks={initialTasks} 
                        memberId={memberId} 
                        slug={slug} 
                    />
                </div>
            </div>
        </div>
    )
}