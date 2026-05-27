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
import { DeliverAssetsButton } from "./_components/DeliverAssetsButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
                    variants: true,
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
            addons: {
                include: { variants: true },
            },
        },
    });

    if (!booking) return notFound();

    const sessionDuration = booking.service?.studioSession?.duration || 45;
    const totalDuration = sessionDuration * booking.sessionCount;

    const totalPaid = booking.payments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + Number(p.amount), 0);
    const grandTotal = Number(booking.totalAmount);
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
        amount: p.amount.toString(),
        method: p.method,
        status: p.status,
        paymentDate: p.paymentDate.toISOString(),
        paystackReference: p.paystackReference,
    }));

    const studioClients = await prisma.client.findMany({
        where: { studioId: studio.id },
        select: { id: true, name: true, phone: true, email: true, image: true, type: true }
    });

    const studioServicesRaw = await prisma.service.findMany({
        where: { studioId: studio.id },
        include: { variants: { include: { deliverables: true } } }
    });

    const studioServices = studioServicesRaw.map(s => ({
        id: s.id,
        name: s.name,
        isAddon: s.isAddon,
        variants: s.variants.map(v => ({
            id: v.id,
            basePrice: v.basePrice.toString(),
            maxPrice: v.maxPrice?.toString() ?? null,
            locationType: v.locationType,
            serviceId: v.serviceId,
            sessionDurationMins: v.sessionDurationMins,
            logisticsIncluded: v.logisticsIncluded,
            deliverables: v.deliverables.map(d => ({
                id: d.id,
                label: d.label,
                quantity: d.quantity ?? undefined,
                detail: d.detail ?? undefined,
                isFree: d.isFree,
            }))
        }))
    }));

    const studioMembers = await prisma.member.findMany({
        where: { studioId: studio.id },
        include: { user: { select: { name: true } } }
    });

    const mappedMembers = studioMembers.map(m => ({
        id: m.id,
        name: m.user.name,
        role: m.role
    }));

    // Serialize Prisma Decimal objects to plain numbers for Client Components
    const serializedBooking = JSON.parse(JSON.stringify(booking, (_key, value) =>
        value !== null && typeof value === "object" && typeof value.toNumber === "function"
            ? value.toNumber()
            : value
    ));

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
                    {serializedBooking.photos.length > 0 && (
                        <DeliverAssetsButton 
                            bookingId={serializedBooking.id} 
                            isDelivered={serializedBooking.deliveryStatus === "DELIVERED"} 
                            hasOutstandingBalance={balanceDue > 0}
                            balanceDue={balanceDue}
                        />
                    )}
                    <UpdateBookingDialog
                        bookingId={serializedBooking.id}
                        clients={studioClients}
                        services={studioServices}
                        members={mappedMembers}
                        currentData={{
                            notes: serializedBooking.notes,
                            sessionCount: serializedBooking.sessionCount,
                            bookingStatus: serializedBooking.bookingStatus,
                            paymentStatus: serializedBooking.paymentStatus,
                            deliveryStatus: serializedBooking.deliveryStatus,
                            clientId: serializedBooking.clientId,
                            serviceId: serializedBooking.serviceId,
                            serviceVariantId: serializedBooking.serviceVariantId ?? undefined,
                            memberId: serializedBooking.memberId || "",
                            bookingDate: serializedBooking.bookingDate,
                            addonIds: serializedBooking.addons.map((addon: { id: string; variants?: { id: string }[] }) => `${addon.id}:${addon.variants?.[0]?.id}`),
                            totalAmount: Number(serializedBooking.totalAmount),
                            paymentPlan: serializedBooking.paymentPlan,
                            extraPicturesCount: serializedBooking.extraPicturesCount,
                        }}
                    />
                    {isManager && <DeleteBookingButton bookingId={serializedBooking.id} slug={studio.slug} />}
                </div>
            </div>

            {/* Status Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent>
                        <p className="text-muted-foreground font-bold text-lg mb-2">Booking</p>
                        <StatusBadge status={serializedBooking.bookingStatus} />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <p className="text-muted-foreground font-bold text-lg mb-2">Payment</p>
                        <StatusBadge status={serializedBooking.paymentStatus} />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <p className="text-muted-foreground font-bold text-lg mb-2">Delivery</p>
                        <StatusBadge status={serializedBooking.deliveryStatus} />
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
                                {format(new Date(serializedBooking.bookingDate), "EEEE, MMMM do, yyyy")}
                            </InfoRow>
                            <InfoRow icon={ClockIcon} label="Time">
                                <span className="break-words">
                                    {format(new Date(serializedBooking.bookingDate), "hh:mm a")} · {totalDuration}min
                                </span>
                            </InfoRow>
                            <InfoRow icon={PackageIcon} label="Outfits">
                                <span>{serializedBooking.sessionCount} {serializedBooking.sessionCount > 1 ? "outfits" : "outfit"}</span>
                            </InfoRow>
                            <InfoRow icon={PackageIcon} label="Service">
                                <div className="flex flex-col gap-1">
                                    <span>{serializedBooking.service?.name}</span>
                                    {serializedBooking.service?.category && (
                                        <span className="text-xs text-muted-foreground">{serializedBooking.service.category.name}</span>
                                    )}
                                </div>
                            </InfoRow>
                            {serializedBooking.addons.length > 0 && (
                                <InfoRow icon={PackageIcon} label="Add-ons">
                                    <div className="flex flex-col gap-1">
                                        {serializedBooking.addons.map((addon: { id: string; name: string }) => (
                                            <span key={addon.id}>{addon.name}</span>
                                        ))}
                                    </div>
                                </InfoRow>
                            )}
                            {serializedBooking.extraPicturesCount > 0 && (
                                <InfoRow icon={PackageIcon} label="Extra Pictures">
                                    <span>{serializedBooking.extraPicturesCount}</span>
                                </InfoRow>
                            )}
                            <InfoRow icon={UserIcon} label="Client">
                                <div className="flex flex-col gap-1">
                                    <span>{serializedBooking.client?.name}</span>
                                    {serializedBooking.client?.phone && (
                                        <span className="text-xs text-muted-foreground">{serializedBooking.client.phone}</span>
                                    )}
                                </div>
                            </InfoRow>
                            <InfoRow icon={UserIcon} label="Assigned To">
                                {serializedBooking.member?.user?.name || "Unassigned"}
                            </InfoRow>
                            {serializedBooking.notes && (
                                <InfoRow icon={FileTextIcon} label="Notes">
                                    <p className="whitespace-pre-wrap text-muted-foreground">{serializedBooking.notes}</p>
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
                                        {serializedBooking.photos.length} file{serializedBooking.photos.length !== 1 ? "s" : ""} uploaded
                                    </CardDescription>
                                </div>
                                <div>
                                    {serializedBooking.photos.length > 0 && (
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
                                                        <DialogDescription>Upload files for this booking.</DialogDescription>
                                                    </DialogHeader>
                                                    <MediaUploader bookingId={serializedBooking.id} />
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
                            {serializedBooking.photos.length === 0 && (
                                <MediaUploader bookingId={serializedBooking.id} />
                            )}
                            {serializedBooking.photos.length > 0 && (
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
                        bookingId={serializedBooking.id}
                        balanceDue={balanceDue}
                        grandTotal={grandTotal}
                        totalPaid={totalPaid}
                        paymentStatus={serializedBooking.paymentStatus}
                        payments={serializedPayments}
                        addonsTotal={0}
                        servicePrice={grandTotal}
                        salePrice={null}
                        addonsCount={0}
                    />

                    {/* Meta / Timestamps */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground shrink-0">Created</span>
                                <span className="text-right">{format(new Date(serializedBooking.createdAt), "MMM d, yyyy · h:mm a")}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground shrink-0">Last Updated</span>
                                <span className="text-right">{format(new Date(serializedBooking.updatedAt), "MMM d, yyyy · h:mm a")}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground shrink-0">Created By</span>
                                <span className="text-right">{serializedBooking.creator?.name || "Unknown"}</span>
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
