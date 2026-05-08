"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadBookingPhoto } from "@/lib/actions/booking";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import {
    UploadCloudIcon,
    XIcon,
    FileIcon,
    ImageIcon,
    VideoIcon,
    CheckCircle2Icon,
} from "lucide-react";

const CHUNK_SIZE = 10 * 1024 * 1024;

interface UploadItem {
    id: string;
    file: File;
    progress: number;
    status: "pending" | "uploading" | "done" | "error";
    key?: string;
}

interface MediaUploaderProps {
    bookingId: string;
}

// ---------------------------------------------------------------------------
// Helpers moved OUTSIDE the component so they are never recreated and never
// need to be listed in dependency arrays.
// ---------------------------------------------------------------------------

async function uploadSmallFile(
    item: UploadItem,
    bookingId: string,
    onProgress: (id: string, progress: number) => void
): Promise<string> {
    const presignRes = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fileName: item.file.name,
            fileType: item.file.type,
            fileSize: item.file.size,
            isImage: item.file.type.startsWith("image/"),
            directory: `studio/bookings/${bookingId}/photos`,
        }),
    });

    if (!presignRes.ok) throw new Error("Failed to get presigned URL");
    const { presignedUrl, key } = await presignRes.json();

    await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
                onProgress(item.id, Math.round((e.loaded / e.total) * 100));
            }
        });
        xhr.addEventListener("load", () => {
            if (xhr.status === 200 || xhr.status === 204) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", item.file.type);
        xhr.send(item.file);
    });

    return key;
}

async function uploadLargeFile(
    item: UploadItem,
    bookingId: string,
    abortRef: React.MutableRefObject<boolean>,
    onProgress: (id: string, progress: number) => void
): Promise<string> {
    const initRes = await fetch("/api/s3/multipart/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fileName: item.file.name,
            fileType: item.file.type,
            directory: `studio/bookings/${bookingId}/photos`,
        }),
    });

    if (!initRes.ok) throw new Error("Failed to initiate multipart upload");
    const { uploadId, key } = await initRes.json();

    const totalParts = Math.ceil(item.file.size / CHUNK_SIZE);
    const parts: { ETag: string; PartNumber: number }[] = [];
    let uploadedBytes = 0;

    for (let partNum = 1; partNum <= totalParts; partNum++) {
        if (abortRef.current) throw new Error("Upload cancelled");

        const start = (partNum - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, item.file.size);
        const chunk = item.file.slice(start, end);

        const partRes = await fetch("/api/s3/multipart/presign-part", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, uploadId, partNumber: partNum }),
        });

        if (!partRes.ok) throw new Error(`Failed to get presigned URL for part ${partNum}`);
        const { presignedUrl } = await partRes.json();

        const response = await fetch(presignedUrl, { method: "PUT", body: chunk });
        if (!response.ok) throw new Error(`Failed to upload part ${partNum}`);

        const etag = response.headers.get("ETag") || `"part-${partNum}"`;
        parts.push({ ETag: etag, PartNumber: partNum });

        uploadedBytes += end - start;
        onProgress(item.id, Math.round((uploadedBytes / item.file.size) * 100));
    }

    const completeRes = await fetch("/api/s3/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, uploadId, parts }),
    });

    if (!completeRes.ok) throw new Error("Failed to complete multipart upload");
    return key;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaUploader({ bookingId }: MediaUploaderProps) {
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const abortRef = useRef(false);

    const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
        setUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
        );
    }, []);

    const processUploads = useCallback(
        async (items: UploadItem[]) => {
            setIsUploading(true);
            abortRef.current = false;

            let successCount = 0;

            for (const item of items) {
                if (abortRef.current) break;

                updateUpload(item.id, { status: "uploading", progress: 0 });

                try {
                    const useMultipart = item.file.size > CHUNK_SIZE;

                    const key = useMultipart
                        ? await uploadLargeFile(
                              item,
                              bookingId,
                              abortRef,
                              (id, progress) => updateUpload(id, { progress })
                          )
                        : await uploadSmallFile(
                              item,
                              bookingId,
                              (id, progress) => updateUpload(id, { progress })
                          );

                    const { error } = await tryCatch(
                        uploadBookingPhoto({
                            bookingId,
                            r2Key: key,
                            fileName: item.file.name,
                            fileSize: item.file.size,
                            mimeType: item.file.type,
                        })
                    );

                    if (error) {
                        updateUpload(item.id, { status: "error", progress: 0 });
                        toast.error(`Failed to save "${item.file.name}"`);
                    } else {
                        updateUpload(item.id, { status: "done", progress: 100, key });
                        successCount++;
                    }
                } catch {
                    updateUpload(item.id, { status: "error", progress: 0 });
                    toast.error(`Failed to upload "${item.file.name}"`);
                }
            }

            setIsUploading(false);

            if (successCount > 0) {
                toast.success(
                    successCount === items.length
                        ? `All ${successCount} file${successCount > 1 ? "s" : ""} uploaded`
                        : `${successCount} of ${items.length} files uploaded`
                );
            }
        },
        [bookingId, updateUpload]
    );

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const newItems: UploadItem[] = acceptedFiles.map((file) => ({
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file,
                progress: 0,
                status: "pending" as const,
            }));

            setUploads((prev) => [...prev, ...newItems]);
            processUploads(newItems);
        },
        [processUploads]
    );

    const removeItem = useCallback((id: string) => {
        setUploads((prev) => prev.filter((u) => u.id !== id));
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [],
            "video/*": [],
        },
        disabled: isUploading,
    });

    const getIcon = (type: string) => {
        if (type.startsWith("image/")) return <ImageIcon className="size-5" />;
        if (type.startsWith("video/")) return <VideoIcon className="size-5" />;
        return <FileIcon className="size-5" />;
    };

    const formatSize = (bytes: number) => {
        if (bytes > 1024 * 1024 * 1024)
            return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
        if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024).toFixed(0)} KB`;
    };

    return (
        <div className="flex flex-col gap-3">
            <Card
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed transition-colors cursor-pointer",
                    isDragActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    isUploading && "opacity-60 cursor-not-allowed"
                )}
            >
                <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
                    <input {...getInputProps()} />
                    <UploadCloudIcon className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">
                        {isDragActive
                            ? "Drop files here..."
                            : "Drag & drop photos or videos, or click to browse"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Supports images and videos of any size
                    </p>
                </CardContent>
            </Card>

            {uploads.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                    {uploads.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 p-2.5 rounded-lg border bg-card"
                        >
                            <div className="flex gap-3">
                                <div className="text-muted-foreground shrink-0">
                                    {getIcon(item.file.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {item.file.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatSize(item.file.size)}
                                    </p>
                                    {item.status === "uploading" && (
                                        <Progress
                                            value={item.progress}
                                            className="h-1 mt-1.5"
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-center gap-1">
                                {item.status === "uploading" && (
                                    <span className="text-xs text-primary font-medium">
                                        {item.progress}%
                                    </span>
                                )}
                                {item.status === "done" && (
                                    <CheckCircle2Icon className="h-4 w-4 text-green-500" />
                                )}
                                {item.status === "error" && (
                                    <span className="text-xs text-destructive font-medium">
                                        Failed
                                    </span>
                                )}
                                {(item.status === "done" || item.status === "error") && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-1"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <XIcon className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}