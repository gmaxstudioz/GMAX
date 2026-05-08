"use client";

import { useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileUp, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// S3 minimum part size is 5MB. 10MB gives comfortable headroom.
const CHUNK_SIZE = 10 * 1024 * 1024;

// Adjust these paths to match your actual API route structure:
const ROUTES = {
    initiate:    "/api/s3/multipart",
    presignPart: "/api/s3/multipart/presign-part",
    complete:    "/api/s3/multipart/complete",
    delete:      "/api/s3/delete",
} as const;

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface MultipartUploaderState {
    file: File | null;
    status: UploadStatus;
    progress: number;
    key: string | null;
    isDeleting: boolean;
}

export interface UploadCompletePayload {
    key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}

interface MultipartUploaderProps {
    directory?: string;
    onUploadComplete?: (payload: UploadCompletePayload) => void;
    onDelete?: () => void;
}

export function MultipartUploader({
    directory,
    onUploadComplete,
    onDelete,
}: MultipartUploaderProps) {
    const [state, setState] = useState<MultipartUploaderState>({
        file: null,
        status: "idle",
        progress: 0,
        key: null,
        isDeleting: false,
    });

    // Uploads a single chunk to its presigned URL and resolves with the ETag
    function uploadPart(presignedUrl: string, chunk: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", presignedUrl);
            xhr.setRequestHeader("Content-Type", "application/octet-stream");

            xhr.addEventListener("load", () => {
                if (xhr.status === 200) {
                    // S3/R2 returns ETag in response headers — required for completion
                    const etag = xhr.getResponseHeader("ETag") ?? "";
                    resolve(etag);
                } else {
                    reject(new Error(`Part upload failed: HTTP ${xhr.status}`));
                }
            });

            xhr.addEventListener("error", () =>
                reject(new Error("Network error during part upload"))
            );

            xhr.send(chunk);
        });
    }

    async function uploadFile(file: File) {
        setState(prev => ({ ...prev, status: "uploading", progress: 0 }));

        try {
            // ── Step 1: Initiate multipart upload ──────────────────────────
            const initRes = await fetch(ROUTES.initiate, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type || "application/octet-stream",
                    directory,
                }),
            });

            if (!initRes.ok) throw new Error("Failed to initiate multipart upload");
            const { uploadId, key } = await initRes.json();

            // ── Step 2: Upload parts sequentially ─────────────────────────
            const totalParts = Math.ceil(file.size / CHUNK_SIZE);
            const parts: { ETag: string; PartNumber: number }[] = [];

            for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
                const start = (partNumber - 1) * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const presignRes = await fetch(ROUTES.presignPart, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key, uploadId, partNumber }),
                });

                if (!presignRes.ok)
                    throw new Error(`Failed to presign part ${partNumber}`);

                const { presignedUrl } = await presignRes.json();
                const etag = await uploadPart(presignedUrl, chunk);

                parts.push({ ETag: etag, PartNumber: partNumber });

                setState(prev => ({
                    ...prev,
                    progress: Math.round((partNumber / totalParts) * 100),
                }));
            }

            // ── Step 3: Complete multipart upload ──────────────────────────
            const completeRes = await fetch(ROUTES.complete, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, uploadId, parts }),
            });

            if (!completeRes.ok) throw new Error("Failed to complete multipart upload");

            setState(prev => ({ ...prev, status: "success", progress: 100, key }));

            onUploadComplete?.({
                key,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || "application/octet-stream",
            });

            toast.success("File uploaded successfully");
        } catch (error) {
            console.error("Multipart upload error:", error);
            setState(prev => ({ ...prev, status: "error", progress: 0 }));
            toast.error("Upload failed. Drop the file again to retry.");
        }
    }

    async function handleDelete() {
        if (state.isDeleting) return;

        try {
            setState(prev => ({ ...prev, isDeleting: true }));

            if (state.key) {
                const res = await fetch(ROUTES.delete, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: state.key }),
                });

                if (!res.ok) throw new Error("Delete request failed");
            }

            setState({ file: null, status: "idle", progress: 0, key: null, isDeleting: false });
            onDelete?.();
            toast.success("File removed");
        } catch {
            setState(prev => ({ ...prev, isDeleting: false }));
            toast.error("Failed to remove file");
        }
    }

    const onDrop = (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            // Reset fully before starting new upload (handles retry from error state too)
            setState({ file, status: "idle", progress: 0, key: null, isDeleting: false });
            uploadFile(file);
        }
    };

    const onDropRejected = (rejections: FileRejection[]) => {
        const tooLarge = rejections.find(r =>
            r.errors.some(e => e.code === "file-too-large")
        );
        if (tooLarge) toast.error("File exceeds the 2 GB limit.");
    };

    const isDropDisabled =
        state.status === "uploading" || state.status === "success";

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected,
        maxFiles: 1,
        multiple: false,
        maxSize: 2 * 1024 * 1024 * 1024, // 2 GB
        disabled: isDropDisabled,
    });

    // Only attach dropzone root props when user can still interact
    const rootProps = isDropDisabled ? {} : getRootProps();

    return (
        <Card
            {...rootProps}
            className={cn(
                "relative border-2 border-dashed transition-colors duration-200 ease-in-out w-full",
                !isDropDisabled && "cursor-pointer",
                isDragActive
                    ? "border-primary bg-primary/5 border-solid"
                    : "border-border hover:border-primary",
                state.status === "error" &&
                    "border-destructive/50 hover:border-destructive",
                state.status === "success" &&
                    "border-solid border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/40"
            )}
        >
            <CardContent className="flex items-center justify-center min-h-36 p-6">
                {!isDropDisabled && <input {...getInputProps()} />}

                {/* ── IDLE ──────────────────────────────────────────── */}
                {state.status === "idle" && (
                    <div className="text-center space-y-2">
                        <div className="flex items-center justify-center mx-auto size-12 rounded-full bg-muted mb-3">
                            <FileUp
                                className={cn(
                                    "size-5 text-muted-foreground",
                                    isDragActive && "text-primary"
                                )}
                            />
                        </div>
                        <p className="text-sm font-semibold">
                            Drop your file here or{" "}
                            <span className="text-primary cursor-pointer">click to browse</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Any file type · Max 2 GB · Uploaded in chunks
                        </p>
                    </div>
                )}

                {/* ── UPLOADING ─────────────────────────────────────── */}
                {state.status === "uploading" && (
                    <div className="w-full max-w-sm space-y-4 text-center">
                        <Loader2 className="size-8 text-primary animate-spin mx-auto" />
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                                {state.file?.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Uploading in chunks…
                            </p>
                        </div>
                        <Progress value={state.progress} className="h-2" />
                        <p className="text-xs tabular-nums text-muted-foreground">
                            {state.progress}%
                            {state.file && (
                                <span className="ml-2">
                                    · {formatFileSize(
                                        (state.progress / 100) * state.file.size
                                    )}{" "}
                                    / {formatFileSize(state.file.size)}
                                </span>
                            )}
                        </p>
                    </div>
                )}

                {/* ── SUCCESS ───────────────────────────────────────── */}
                {state.status === "success" && state.file && (
                    <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-500/10 shrink-0">
                                <CheckCircle2 className="size-5 text-emerald-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">
                                    {state.file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatFileSize(state.file.size)} · Uploaded
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleDelete}
                            disabled={state.isDeleting}
                            className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            {state.isDeleting ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Trash2 className="size-4" />
                            )}
                        </Button>
                    </div>
                )}

                {/* ── ERROR ─────────────────────────────────────────── */}
                {state.status === "error" && (
                    <div className="text-center space-y-2">
                        <div className="flex items-center justify-center mx-auto size-12 rounded-full bg-destructive/10 mb-3">
                            <AlertCircle className="size-5 text-destructive" />
                        </div>
                        <p className="text-sm font-semibold">Upload failed</p>
                        <p className="text-xs text-muted-foreground">
                            Drop the file again to retry
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}