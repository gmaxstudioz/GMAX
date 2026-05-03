import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getClientTasks } from "@/lib/actions/task";
import { CallIcon, Mail01Icon, Book01Icon, Note01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { BackButton } from "@/components/web/back-button";
import { ClientBookingsList } from "./_components/client-bookings";
import { EditClientDialog } from "./_components/edit-client-dialog";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/formatters";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface ClientPageProps {
    params: Promise<{ clientId: string; slug: string }>
}

export default async function ClientPage({ params }: ClientPageProps) {
    const { clientId, slug } = await params;

    // Resolve the studio by slug to authorize access
    const studio = await prisma.studio.findUnique({
        where: { slug },
        select: { id: true },
    });

    if (!studio) return notFound();

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return notFound();

    const currentMember = await prisma.member.findFirst({
        where: { userId: session.user.id, studioId: studio.id },
    });

    if (!currentMember) return notFound();

    // Ensure the client belongs to this studio
    const clientData = await prisma.client.findFirst({
        where: { id: clientId, studioId: studio.id },
        include: {
            bookings: {
                include: {
                    payments: true
                }
            }
        }
    });

    if (!clientData) return notFound();

    const totalSpent = clientData.bookings.reduce((sum, booking) => {
        const paidAmount = booking.payments
            .filter(p => p.status === "PAID")
            .reduce((acc, curr) => acc + Number(curr.amount), 0);
        return sum + paidAmount;
    }, 0);

    const completedBookings = clientData.bookings.filter(b => b.bookingStatus === "COMPLETED").length;
    const totalBookings = clientData.bookings.length;

    const initialTasks = await getClientTasks(clientId, 0, "", "All");

    return (
        <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <div className="flex items-center justify-between w-full pb-4">
                <div className="flex items-center gap-4">
                    <BackButton />
                    <h1 className="text-2xl font-bold">Client Profile</h1>
                </div>
                <EditClientDialog 
                    clientId={clientData.id} 
                    initialData={{
                        name: clientData.name,
                        email: clientData.email,
                        phone: clientData.phone,
                        address: clientData.address,
                        notes: clientData.notes,
                        clientType: clientData.type as any
                    }} 
                />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-4">
                    <Card className="@container/card h-full">
                        <CardHeader>
                            <div className="flex flex-row gap-4">
                                <Image src={clientData.image || "/images/placeholder.jpg"} alt="Profile" width={120} height={120} className="rounded-lg object-cover shrink-0" />
                                <div className="flex flex-col gap-1">
                                    <h1 className="text-2xl font-bold">{clientData.name}</h1>
                                    <Badge className="w-fit">
                                        {clientData.type.toUpperCase()}
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 py-6">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <HugeiconsIcon icon={CallIcon} size={16} strokeWidth={2} />
                                    <p className="text-sm">Phone Numbers</p>
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                    {clientData.phone.length > 0 ? clientData.phone.map((p, i) => (
                                        <p key={i} className="text-sm font-medium p-2 bg-primary/10 rounded-lg">{p}</p>
                                    )) : (
                                        <p className="text-sm italic text-muted-foreground">No phone number</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 mt-2">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <HugeiconsIcon icon={Mail01Icon} size={16} strokeWidth={2} />
                                    <p className="text-sm">Email</p>
                                </div>
                                <p className="text-sm font-medium p-2 bg-primary/10 rounded-lg truncate">{clientData.email || "No email added"}</p>
                            </div>
                            {clientData.address && (
                                <div className="flex flex-col gap-1 mt-2">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <HugeiconsIcon icon={Book01Icon} size={16} strokeWidth={2} />
                                        <p className="text-sm">Address</p>
                                    </div>
                                    <p className="text-sm font-medium p-2 bg-primary/10 rounded-lg">{clientData.address}</p>
                                </div>
                            )}
                            {clientData.notes && (
                                <div className="flex flex-col gap-1 mt-2">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <HugeiconsIcon icon={Note01Icon} size={16} strokeWidth={2} />
                                        <p className="text-sm">Notes</p>
                                    </div>
                                    <p className="text-sm font-medium p-2 bg-primary/10 rounded-lg">{clientData.notes}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-3 flex flex-col gap-4 w-full">
                    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
                        <Card>
                            <CardContent>
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
                                <p className="text-primary font-bold text-3xl mt-2">{totalBookings}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <CardTitle className="text-sm font-medium text-muted-foreground">Completed Bookings</CardTitle>
                                <p className="text-primary font-bold text-3xl mt-2">{completedBookings}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
                                <p className="text-green-500 font-bold text-3xl mt-2">{formatPrice(totalSpent)}</p>
                            </CardContent>
                        </Card>
                    </div>
                    <ClientBookingsList 
                        initialTasks={initialTasks} 
                        clientId={clientId} 
                        slug={slug} 
                    />
                </div>
            </div>
        </div>
    );
}
