"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    approvePhoto,
    rejectPhoto,
    deletePhoto,
    getBookingPhotoPresignedUrl,
    getBookingPhotosPresignedUrls,
} from "@/lib/actions/booking";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { CheckIcon, XIcon, ImageIcon, VideoIcon, DownloadIcon, EyeIcon, Loader2, ShieldAlertIcon, UploadCloudIcon } from "lucide-react";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import { Info, Delete02Icon } from "@hugeicons/core-free-icons";
import { MediaUploader } from "./MediaUploader";

interface PhotoItem {
    id: string;
    r2Key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    approvalStatus: string;
    rejectionReason: string | null;
    uploadedAt: string | Date;
}

interface MediaGalleryProps {
    photos: PhotoItem[];
    isManager: boolean;
    r2PublicUrl: string;
    bookingId: string;
}

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    PENDING_REVIEW: "secondary",
    APPROVED: "default",
    REJECTED: "destructive",
};

const REFRESH_INTERVAL_MS = 45 * 60 * 1000;
// Presigned URLs are issued for 1 hour; renew at 45 min, stop serving at 55 min.
const URL_EXPIRY_MS = 55 * 60 * 1000;

export function MediaGallery({ photos, isManager, r2PublicUrl, bookingId }: MediaGalleryProps) {
    const [isPending, startTransition] = useTransition();
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
    const [photoToReplace, setPhotoToReplace] = useState<string | null>(null);
    const [freshUrls, setFreshUrls] = useState<
        Record<string, { url: string; sourceKey: string; issuedAt: number }>
    >({});
    const [nowMs, setNowMs] = useState<number>(0);
    const lastRefreshedAtRef = useRef<number>(0);
    const photosRef = useRef(photos);

    useEffect(() => {
        photosRef.current = photos;
    }, [photos]);

    const renewalInFlightRef = useRef(false);

    const refreshAllUrls = useCallback(async () => {
        if (renewalInFlightRef.current) return;
        renewalInFlightRef.current = true;
        try {
            const { data: res, error } = await tryCatch(getBookingPhotosPresignedUrls(bookingId));
            if (!error && res?.status === "success" && res.urls) {
                const issuedAt = Date.now();
                const keyById = new Map(photosRef.current.map((p) => [p.id, p.r2Key]));
                const nextUrls: Record<string, { url: string; sourceKey: string; issuedAt: number }> = {};
                for (const [id, url] of Object.entries(res.urls)) {
                    const sourceKey = keyById.get(id);
                    if (sourceKey) {
                        nextUrls[id] = { url, sourceKey, issuedAt };
                    }
                }
                setNowMs(issuedAt);
                setFreshUrls(nextUrls);
                lastRefreshedAtRef.current = issuedAt;
            }
        } finally {
            renewalInFlightRef.current = false;
        }
    }, [bookingId]);

    useEffect(() => {
        lastRefreshedAtRef.current = Date.now();
        const interval = setInterval(() => {
            setNowMs(Date.now());
            void refreshAllUrls();
        }, REFRESH_INTERVAL_MS);
        const expiryTick = setInterval(() => {
            setNowMs(Date.now());
        }, 60 * 1000);

        const handleFocus = () => {
            const now = Date.now();
            setNowMs(now);
            if (now - lastRefreshedAtRef.current >= REFRESH_INTERVAL_MS) {
                void refreshAllUrls();
            }
        };
        window.addEventListener("focus", handleFocus);

        return () => {
            clearInterval(interval);
            clearInterval(expiryTick);
            window.removeEventListener("focus", handleFocus);
        };
    }, [refreshAllUrls]);

    useEffect(() => {
        if (renewalInFlightRef.current) return;
        const now = Date.now();
        const hasDueCachedUrl = photosRef.current.some((photo) => {
            const cached = freshUrls[photo.id];
            return (
                cached &&
                cached.sourceKey === photo.r2Key &&
                now - cached.issuedAt >= REFRESH_INTERVAL_MS
            );
        });
        if (hasDueCachedUrl) {
            void refreshAllUrls();
        }
    });

    const getMediaUrl = useCallback(
        (key: string) =>
            key.startsWith("http://") || key.startsWith("https://") ? key : `${r2PublicUrl}/${key}`,
        [r2PublicUrl],
    );

    const getActivePhotoUrl = useCallback(
        (photo: PhotoItem): string => {
            const cached = freshUrls[photo.id];
            if (
                cached &&
                cached.sourceKey === photo.r2Key &&
                (nowMs === 0 || nowMs - cached.issuedAt < URL_EXPIRY_MS)
            ) {
                return cached.url;
            }
            return getMediaUrl(photo.r2Key);
        },
        [freshUrls, nowMs, getMediaUrl],
    );

    const resolveFreshPhotoUrl = useCallback(
        async (photo: PhotoItem): Promise<string> => {
            const { data: res, error } = await tryCatch(getBookingPhotoPresignedUrl(photo.id));
            if (!error && res?.status === "success" && res.url) {
                const issuedAt = Date.now();
                setNowMs(issuedAt);
                setFreshUrls((prev) => ({
                    ...prev,
                    [photo.id]: { url: res.url, sourceKey: photo.r2Key, issuedAt },
                }));
                return res.url;
            }
            return getActivePhotoUrl(photo);
        },
        [getActivePhotoUrl],
    );

    const handleApprove = (photoId: string) => {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(approvePhoto(photoId));
            if (error) {
                toast.error("Failed to approve");
                return;
            }
            if (result?.status === "success") {
                toast.success("Photo approved! Client has been notified.");
            } else {
                toast.error(result?.message || "Failed to approve");
            }
        });
    };

    const handleReject = () => {
        if (!selectedPhotoId) return;
        startTransition(async () => {
            const { data: result, error } = await tryCatch(rejectPhoto(selectedPhotoId, rejectReason));
            if (error) {
                toast.error("Failed to reject");
                return;
            }
            if (result?.status === "success") {
                toast.success("Photo rejected");
                setRejectDialogOpen(false);
                setRejectReason("");
                setSelectedPhotoId(null);
            } else {
                toast.error(result?.message || "Failed to reject");
            }
        });
    };

    const handleDelete = () => {
        if (!photoToDelete) return;
        startTransition(async () => {
            const { data: result, error } = await tryCatch(deletePhoto(photoToDelete));
            if (error) {
                toast.error("Failed to delete photo");
                return;
            }
            if (result?.status === "success") {
                toast.success("Photo deleted");
                setDeleteDialogOpen(false);
                setPhotoToDelete(null);
            } else {
                toast.error(result?.message || "Failed to delete photo");
            }
        });
    };

    const isVideo = (mime: string) => mime.startsWith("video/");

    const formatSize = (bytes: number) => {
        if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
        if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024).toFixed(0)} KB`;
    };

    if (photos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <ImageIcon className="h-10 w-10 opacity-50" />
                <p className="text-sm">No photos or videos uploaded yet</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map(photo => (
                    <div key={photo.id} className="group relative rounded-xl border bg-card overflow-hidden">
                        {/* Thumbnail / Preview */}
                        <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                            {isVideo(photo.mimeType) ? (
                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                    <VideoIcon className="h-8 w-8" />
                                    <span className="text-[10px]">Video</span>
                                </div>
                            ) : (
                                <Image
                                    src={getActivePhotoUrl(photo)}
                                    alt={photo.fileName}
                                    className="object-cover w-full h-full"
                                    width={500}
                                    height={500}
                                    loading="lazy"
                                    unoptimized
                                />
                            )}
                            <div className="absolute top-2 right-2 flex items-center gap-2">
                                <Badge
                                    variant={statusBadgeVariant[photo.approvalStatus] || "outline"}
                                    className="text-[10px] py-0 px-1.5"
                                >
                                    {photo.approvalStatus === "PENDING_REVIEW" ? "Review" : photo.approvalStatus.toLowerCase()}
                                </Badge>
                            </div>
                            {/* Overlay actions */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="icon" className="h-8 w-8" variant="secondary">
                                            <HugeiconsIcon icon={Info} size={10} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="flex flex-col">
                                        <p className="text-xs font-medium truncate">{photo.fileName}</p>
                                        <span className="text-[10px] text-muted-foreground">{formatSize(photo.fileSize)}</span>
                                    </TooltipContent>
                                </Tooltip>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={async () => {
                                        const url = await resolveFreshPhotoUrl(photo);
                                        setPreviewUrl(url);
                                    }}
                                >
                                    <EyeIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={async () => {
                                        const url = await resolveFreshPhotoUrl(photo);
                                        const link = document.createElement("a");
                                        link.href = url;
                                        link.download = photo.fileName;
                                        link.target = "_blank";
                                        link.rel = "noopener noreferrer";
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                    }}
                                >
                                    <DownloadIcon className="h-4 w-4" />
                                </Button>
                                {isManager && (
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-8 w-8 ml-auto"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPhotoToDelete(photo.id);
                                            setDeleteDialogOpen(true);
                                        }}
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} size={14} />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Info bar */}
                        <div className="p-2 py-0 space-y-1.5">
                            {/* Manager actions */}
                            {isManager && photo.approvalStatus === "PENDING_REVIEW" && (
                                <div className="flex gap-1.5 pt-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50"
                                        disabled={isPending}
                                        onClick={() => handleApprove(photo.id)}
                                    >
                                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckIcon className="h-3 w-3" />}
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                                        disabled={isPending}
                                        onClick={() => {
                                            setSelectedPhotoId(photo.id);
                                            setRejectDialogOpen(true);
                                        }}
                                    >
                                        <XIcon className="h-3 w-3" />
                                        Reject
                                    </Button>
                                </div>
                            )}

                            {photo.approvalStatus === "REJECTED" && (
                                <div className="flex flex-col gap-1.5 mt-1">
                                    {photo.rejectionReason && (
                                        <p className="text-[10px] text-destructive flex items-center gap-1">
                                            <ShieldAlertIcon className="h-3 w-3 shrink-0" />
                                            <span className="truncate" title={photo.rejectionReason}>
                                                {photo.rejectionReason}
                                            </span>
                                        </p>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-[10px] gap-1"
                                        onClick={() => setPhotoToReplace(photo.id)}
                                    >
                                        <UploadCloudIcon className="h-3 w-3" />
                                        Replace Photo
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Photo</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this photo? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HugeiconsIcon icon={Delete02Icon} size={16} className="mr-2" />}
                            Delete Photo
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reject reason dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent className="sm:max-w-[360px]">
                    <DialogHeader>
                        <DialogTitle>Reject Photo</DialogTitle>
                        <DialogDescription>Provide an optional reason for the rejection.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-2">
                        <Input
                            placeholder="Reason (optional)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <Button onClick={handleReject} disabled={isPending} variant="destructive" className="w-full">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirm Rejection
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Replace photo dialog */}
            <Dialog open={!!photoToReplace} onOpenChange={(open) => !open && setPhotoToReplace(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Replace Photo</DialogTitle>
                        <DialogDescription>Upload a new file to replace the rejected photo.</DialogDescription>
                    </DialogHeader>
                    {photoToReplace && (
                        <MediaUploader 
                            bookingId={bookingId} 
                            replacePhotoId={photoToReplace} 
                            onSuccess={() => setPhotoToReplace(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Image preview modal */}
            {previewUrl && (
                <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
                    <DialogContent className="sm:max-w-[90vw] md:max-w-[800px] p-2">
                        <DialogHeader className="sr-only">
                            <DialogTitle>Preview</DialogTitle>
                            <DialogDescription>Media preview</DialogDescription>
                        </DialogHeader>
                        {previewUrl.split("?")[0].match(/\.(mp4|mov|webm|avi)/i) ? (
                            <video src={previewUrl} controls className="w-full max-h-[80vh] rounded-lg" />
                        ) : (
                            <div className="relative w-full h-[80vh]">
                                <Image src={previewUrl} alt="Preview" fill className="object-contain rounded-lg" unoptimized />
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
