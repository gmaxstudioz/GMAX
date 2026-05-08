"use client"

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Trash } from "lucide-react";
import { useDropzone, FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { useState } from "react";

const CHUNK_SIZE = 10 * 1024 * 1024;
const MULTIPART_THRESHOLD = 50 * 1024 * 1024;
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

const ROUTES = {
    upload: "/api/s3/upload",
    initiate: "/api/s3/multipart/initiate",
    part: "/api/s3/multipart/presign-part",
    complete: "/api/s3/multipart/complete",
} as const;

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface MultipartUploaderState {
    file: File | null;
    displayName: string | null;
    displaySize: number | null;
    status: UploadStatus;
    progress: number;
    key: string | null;
    isDeleting: boolean;
}

export interface MultipartUploadResult {
    key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}

export interface InitialFile {
    key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}

interface MultipartUploaderProps {
    onUploadComplete?: (result: MultipartUploadResult) => void;
    onDelete?: () => void;
    directory?: string;
    accept?: Record<string, string[]>;
    maxSize?: number;
    disabled?: boolean;
    initialFile?: InitialFile;
}

export function MultipartUploader({
    onUploadComplete,
    onDelete,
    directory = "studio/media",
    accept,
    maxSize = DEFAULT_MAX_SIZE,
    disabled = false,
    initialFile,
}: MultipartUploaderProps) {
    const [state, setState] = useState<MultipartUploaderState>(() =>
        initialFile
            ? {
                  file: null,
                  displayName: initialFile.fileName,
                  displaySize: initialFile.fileSize,
                  status: "success",
                  progress: 100,
                  key: initialFile.key,
                  isDeleting: false,
              }
            : {
                  file: null,
                  displayName: null,
                  displaySize: null,
                  status: "idle",
                  progress: 0,
                  key: null,
                  isDeleting: false,
              }
    );

    async function uploadFile(file: File) {
        setState((prev) => ({ ...prev, status: "uploading", progress: 0 }));
        try {
            file.size <= MULTIPART_THRESHOLD
                ? await uploadSingle(file)
                : await uploadMultipart(file);
        } catch (err) {
            console.error("[MultipartUploader]", err);
            setState((prev) => ({ ...prev, status: "error", progress: 0 }));
            toast.error("Upload failed. Please try again.");
        }
    }

    async function uploadSingle(file: File) {
        const res = await fetch(ROUTES.upload, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size, isImage: false, directory }),
        });
        if (!res.ok) throw new Error("Failed to get presigned URL");
        const { presignedUrl, key } = await res.json();

        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable)
                    setState((prev) => ({ ...prev, progress: Math.round((e.loaded / e.total) * 100) }));
            });
            xhr.addEventListener("load", () => {
                if (xhr.status === 200 || xhr.status === 204) {
                    setState((prev) => ({ ...prev, status: "success", progress: 100, key, displayName: file.name, displaySize: file.size }));
                    onUploadComplete?.({ key, fileName: file.name, fileSize: file.size, mimeType: file.type });
                    toast.success("File uploaded successfully");
                    resolve();
                } else reject(new Error(`Upload failed: ${xhr.statusText}`));
            });
            xhr.addEventListener("error", () => reject(new Error("Network error")));
            xhr.open("PUT", presignedUrl);
            xhr.setRequestHeader("Content-Type", file.type);
            xhr.send(file);
        });
    }

    async function uploadMultipart(file: File) {
        const initiateRes = await fetch(ROUTES.initiate, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: file.name, fileType: file.type, directory }),
        });
        if (!initiateRes.ok) throw new Error("Failed to initiate multipart upload");
        const { uploadId, key } = await initiateRes.json();

        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const parts: { ETag: string; PartNumber: number }[] = [];

        for (let i = 0; i < totalChunks; i++) {
            const partNumber = i + 1;
            const chunk = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));

            const partRes = await fetch(ROUTES.part, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, uploadId, partNumber }),
            });
            if (!partRes.ok) throw new Error(`Failed to get presigned URL for part ${partNumber}`);
            const { presignedUrl } = await partRes.json();

            const putRes = await fetch(presignedUrl, { method: "PUT", body: chunk, headers: { "Content-Type": file.type } });
            if (!putRes.ok) throw new Error(`Part ${partNumber} upload failed`);

            const etag = putRes.headers.get("ETag");
            if (!etag) throw new Error(`ETag missing for part ${partNumber} — check R2 CORS ExposeHeaders config`);
            parts.push({ ETag: etag, PartNumber: partNumber });

            setState((prev) => ({ ...prev, progress: Math.round((partNumber / totalChunks) * 100) }));
        }

        const completeRes = await fetch(ROUTES.complete, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, uploadId, parts }),
        });
        if (!completeRes.ok) throw new Error("Failed to complete multipart upload");

        setState((prev) => ({ ...prev, status: "success", progress: 100, key, displayName: file.name, displaySize: file.size }));
        onUploadComplete?.({ key, fileName: file.name, fileSize: file.size, mimeType: file.type });
        toast.success("File uploaded successfully");
    }

    const onDrop = (acceptedFiles: File[]) => {
        if (!acceptedFiles.length) return;
        const file = acceptedFiles[0];
        setState({ file, displayName: file.name, displaySize: file.size, status: "idle", progress: 0, key: null, isDeleting: false });
        uploadFile(file);
    };

    function onDropRejected(rejections: FileRejection[]) {
        const code = rejections[0]?.errors[0]?.code;
        if (code === "file-too-large") toast.error("File exceeds the size limit");
        else if (code === "too-many-files") toast.error("Only one file allowed");
        else if (code === "file-invalid-type") toast.error("File type not supported");
        else toast.error(rejections[0]?.errors[0]?.message ?? "File rejected");
    }

    function handleDelete() {
        setState({ file: null, displayName: null, displaySize: null, status: "idle", progress: 0, key: null, isDeleting: false });
        onDelete?.();
        toast.success("File removed");
    }

    const isLocked = state.status === "uploading" || state.status === "success" || disabled;
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, onDropRejected, accept, maxFiles: 1, multiple: false, maxSize, disabled: isLocked });

    const displayName = state.file?.name ?? state.displayName;
    const displaySize = state.file?.size ?? state.displaySize;

    function renderContent() {
        if (state.status === "uploading") {
            return (
                <div className="flex flex-col items-center gap-3 w-full">
                    <Loader2 className="size-8 text-primary animate-spin" />
                    <p className="text-sm font-medium truncate max-w-xs">{displayName}</p>
                    <div className="w-full max-w-xs bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${state.progress}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">{state.progress}%</p>
                </div>
            );
        }

        if (state.status === "success") {
            return (
                <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="size-8 text-emerald-500" />
                    <p className="text-sm font-medium truncate max-w-xs">{displayName}</p>
                    {displaySize !== null && (
                        <p className="text-xs text-muted-foreground">{formatBytes(displaySize)}</p>
                    )}
                    <Button variant="outline" size="sm" type="button" onClick={handleDelete} className="mt-1 gap-1.5 text-destructive hover:text-destructive">
                        <Trash className="size-3.5" />
                        Replace file
                    </Button>
                </div>
            );
        }

        if (state.status === "error") {
            return (
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center justify-center size-12 rounded-full bg-destructive/20 mb-1">
                        <AlertCircle className="size-6 text-destructive" />
                    </div>
                    <p className="text-sm font-semibold">Upload Failed</p>
                    <p className="text-xs text-muted-foreground">Drop a file to try again</p>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center gap-2 text-center">
                <div className={cn("flex items-center justify-center size-12 rounded-full bg-muted mb-1", isDragActive && "bg-primary/10")}>
                    <FileUp className={cn("size-6 text-muted-foreground", isDragActive && "text-primary")} />
                </div>
                <p className="text-sm font-semibold text-foreground">
                    Drop your file here or <span className="text-primary font-bold cursor-pointer">click to upload</span>
                </p>
                <p className="text-xs text-muted-foreground">Max {formatBytes(maxSize)} · Files over 50 MB upload in parts</p>
            </div>
        );
    }

    return (
        <Card {...getRootProps()} className={cn(
            "relative border-2 border-dashed transition-colors duration-200 ease-in-out w-full h-48",
            isDragActive ? "border-primary bg-primary/10 border-solid" : "border-border hover:border-primary",
            isLocked && "cursor-default pointer-events-none"
        )}>
            <CardContent className="flex items-center justify-center h-full w-full p-6">
                <input {...getInputProps()} />
                {renderContent()}
            </CardContent>
        </Card>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}