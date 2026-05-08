import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { BackButton } from "../../../staff/[memberId]/_components/back-button";
import {
    CalendarIcon,
    ClockIcon,
    UserIcon,
    PackageIcon,
    FileTextIcon,
} from "lucide-react";
import { UpdateBookingDialog } from "./_components/UpdateBookingDialog";
import { MediaUploader } from "./_components/MediaUploader";
import { MediaGallery } from "./_components/MediaGallery";
import { PaymentLinkCard } from "./_components/PaymentLinkCard";
import { DeleteBookingButton } from "./_components/DeleteBookingButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera, Download, Upload } from "@hugeicons/core-free-icons";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { bookingId } = await params;
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { client: true, service: true },
    });

    return {
        title: booking ? `Booking – ${booking.client?.name}` : "Booking Details",
        description: booking
            ? `Booking details for ${booking.client?.name} – ${booking.service?.name}`
            : "View booking details",
    };
}

interface Props {
    params: Promise<{
        slug: string;
        bookingId: string;
    }>;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    PENDING: "secondary",
    CONFIRMED: "default",
    COMPLETED: "default",
    CANCELLED: "destructive",
    PAID: "default",
    PARTIALLY_PAID: "secondary",
    DELIVERED: "default",
};

function StatusBadge({ status }: { status: string }) {
    return (
        <Badge variant={statusVariants[status] || "outline"} className="capitalize p-3">
            {status.replace(/_/g, " ").toLowerCase()}
        </Badge>
    );
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2">
            <div className="mt-0.5 rounded-md bg-muted p-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
                <div className="text-sm font-medium">{children}</div>
            </div>
        </div>
    );
}

export default async function BookingDetailPage({ params }: Props) {
    const { slug, bookingId } = await params;

    // Get current user session for role check
    const session = await auth.api.getSession({ headers: await headers() });

    // Verify studio exists
    const studio = await prisma.studio.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true },
    });
    if (!studio) return notFound();

    // Get current user's role in this studio
    const currentMember = session?.user
        ? await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: studio.id },
        })
        : null;
        
    if (!currentMember) return notFound();

    const isManager = ["owner", "manager", "developer"].includes(currentMember.role);

    const booking = await prisma.booking.findFirst({
        where: { id: bookingId, studioId: studio.id },
        include: {
            client: true,
            service: {
                include: {
                    studioSession: true,
                    category: true,
                },
            },
            member: {
                include: { user: true },
            },
            creator: true,
            payments: {
                orderBy: { paymentDate: "desc" },
            },
            photos: {
                orderBy: { uploadedAt: "desc" },
            },
            addons: true,
        },
    });

    if (!booking) return notFound();

    const sessionDuration = booking.service?.studioSession?.duration || 45;
    const totalDuration = sessionDuration * booking.sessionCount;

    const totalPaid = booking.payments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + Number(p.amount), 0);

    const servicePrice = booking.service?.price || 0;
    const salePrice = booking.service?.salePrice;
    const effectivePrice = salePrice ?? servicePrice;
    const addonsTotal = booking.addons.reduce((sum, a) => sum + (a.salePrice ?? a.price), 0);
    const grandTotal = effectivePrice + addonsTotal;
    const balanceDue = Math.max(0, grandTotal - totalPaid);

    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

    // Serialize photos for client components
    const serializedPhotos = booking.photos.map(p => ({
        id: p.id,
        r2Key: p.r2Key,
        fileName: p.fileName,
        fileSize: p.fileSize,
        mimeType: p.mimeType,
        approvalStatus: p.approvalStatus,
        rejectionReason: p.rejectionReason,
        uploadedAt: p.uploadedAt.toISOString(),
    }));

    // Serialize payments for client component
    const serializedPayments = booking.payments.map(p => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        paymentDate: p.paymentDate.toISOString(),
        paystackReference: p.paystackReference,
    }));

    const studioClients = await prisma.client.findMany({
        where: { studioId: studio.id },
        select: { id: true, name: true, phone: true, email: true, image: true, type: true }
    });

    const studioServices = await prisma.service.findMany({
        where: { category: { studioId: studio.id } },
        select: { id: true, name: true, type: true, price: true, salePrice: true }
    });

    const studioMembers = await prisma.member.findMany({
        where: { studioId: studio.id },
        include: { user: { select: { name: true } } }
    });

    const mappedMembers = studioMembers.map(m => ({
        id: m.id,
        userName: m.user.name,
        role: m.role
    }));

    return (
        <div className="flex flex-col gap-6 py-4 px-4 md:py-6 md:px-6 max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <BackButton />
                <div className="flex-1">
                    <h1 className="text-xl sm:text-2xl font-bold">Booking Details</h1>
                    <p className="text-muted-foreground text-sm">{studio.name}</p>
                </div>
                <div className="flex items-center gap-2">
                    <UpdateBookingDialog
                        bookingId={booking.id}
                        clients={studioClients}
                        services={studioServices}
                        members={mappedMembers}
                        currentData={{
                            notes: booking.notes,
                            sessionCount: booking.sessionCount,
                            bookingStatus: booking.bookingStatus,
                            paymentStatus: booking.paymentStatus,
                            deliveryStatus: booking.deliveryStatus,
                            clientId: booking.clientId,
                            serviceId: booking.serviceId,
                            memberId: booking.memberId || "",
                            bookingDate: booking.bookingDate.toISOString(),
                            addonIds: booking.addons.map(addon => addon.id)
                        }}
                    />
                    {isManager && <DeleteBookingButton bookingId={booking.id} slug={studio.slug} />}
                </div>
            </div>

            {/* Status Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent>
                        <p className="text-muted-foreground font-bold text-lg mb-2">Booking</p>
                        <StatusBadge status={booking.bookingStatus} />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <p className="text-muted-foreground font-bold text-lg mb-2">Payment</p>
                        <StatusBadge status={booking.paymentStatus} />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <p className="text-muted-foreground font-bold text-lg mb-2">Delivery</p>
                        <StatusBadge status={booking.deliveryStatus} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column — Main Info */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Booking Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Booking Information</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-1">
                            <InfoRow icon={CalendarIcon} label="Date">
                                {format(new Date(booking.bookingDate), "EEEE, MMMM do, yyyy")}
                            </InfoRow>
                            <InfoRow icon={ClockIcon} label="Time">
                                <span className="break-words">
                                    {format(new Date(booking.bookingDate), "hh:mm a")} · {totalDuration}min ({booking.sessionCount} {booking.sessionCount > 1 ? "sessions" : "session"} × {sessionDuration}m)
                                </span>
                            </InfoRow>
                            <InfoRow icon={PackageIcon} label="Service">
                                <div className="flex flex-col gap-1">
                                    <span>{booking.service?.name}</span>
                                    {booking.service?.category && (
                                        <span className="text-xs text-muted-foreground">{booking.service.category.name}</span>
                                    )}
                                </div>
                            </InfoRow>
                            {booking.addons.length > 0 && (
                                <InfoRow icon={PackageIcon} label="Add-ons">
                                    <div className="flex flex-col gap-1">
                                        {booking.addons.map((addon) => (
                                            <span key={addon.id}>{addon.name}</span>
                                        ))}
                                    </div>
                                </InfoRow>
                            )}
                            <InfoRow icon={UserIcon} label="Client">
                                <div className="flex flex-col gap-1">
                                    <span>{booking.client?.name}</span>
                                    {booking.client?.phone?.length > 0 && (
                                        <span className="text-xs text-muted-foreground">{booking.client.phone.join(", ")}</span>
                                    )}
                                </div>
                            </InfoRow>
                            <InfoRow icon={UserIcon} label="Assigned To">
                                {booking.member?.user?.name || "Unassigned"}
                            </InfoRow>
                            {booking.notes && (
                                <InfoRow icon={FileTextIcon} label="Notes">
                                    <p className="whitespace-pre-wrap text-muted-foreground">{booking.notes}</p>
                                </InfoRow>
                            )}
                        </CardContent>
                    </Card>

                    {/* Photos & Media */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col md:flex-row justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2 font-heading">
                                        <HugeiconsIcon icon={Camera} />
                                        Photos & Media
                                    </CardTitle>
                                    <CardDescription>
                                        {booking.photos.length} file{booking.photos.length !== 1 ? "s" : ""} uploaded
                                    </CardDescription>
                                </div>
                                <div>
                                    {booking.photos.length > 0 && (
                                        <div className="flex flex-row gap-1">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline">
                                                        <HugeiconsIcon icon={Upload} />
                                                        <span className="hidden md:block">Upload</span>
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle className="font-heading">Upload Photos & Media</DialogTitle>
                                                    </DialogHeader>
                                                    <MediaUploader bookingId={booking.id} />
                                                </DialogContent>
                                            </Dialog>
                                            <Button>
                                                <HugeiconsIcon icon={Download} />
                                                <span className="hidden md:block">Download All</span>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {booking.photos.length === 0 && (
                                <MediaUploader bookingId={booking.id} />
                            )}
                            {booking.photos.length > 0 && (
                                <MediaGallery
                                    photos={serializedPhotos}
                                    isManager={isManager}
                                    r2PublicUrl={r2PublicUrl}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column — Payment & Meta */}
                <div className="flex flex-col gap-6">
                    {/* Combined Payment Card */}
                    <PaymentLinkCard
                        bookingId={booking.id}
                        balanceDue={balanceDue}
                        grandTotal={grandTotal}
                        totalPaid={totalPaid}
                        paymentStatus={booking.paymentStatus}
                        payments={serializedPayments}
                        addonsTotal={addonsTotal}
                        servicePrice={servicePrice}
                        salePrice={salePrice ?? null}
                        addonsCount={booking.addons.length}
                    />

                    {/* Meta / Timestamps */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground shrink-0">Created</span>
                                <span className="text-right">{format(new Date(booking.createdAt), "MMM d, yyyy · h:mm a")}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground shrink-0">Last Updated</span>
                                <span className="text-right">{format(new Date(booking.updatedAt), "MMM d, yyyy · h:mm a")}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground shrink-0">Created By</span>
                                <span className="text-right">{booking.creator?.name || "Unknown"}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground shrink-0">Booking ID</span>
                                <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px] sm:max-w-[160px]">{booking.id}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
