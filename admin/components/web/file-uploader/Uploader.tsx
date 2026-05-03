"use client"

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import React, { useEffect, useState } from 'react'
import { FileRejection, useDropzone } from 'react-dropzone'
import { RenderEmptyState, RenderErrorState, RenderSuccessState, RenderUploadingState } from './RenderState'
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface UploaderState {
    id: string | null;
    file: File | null;
    progress: number;
    error: boolean;
    isUploading: boolean;
    key?: string;
    isDeleting: boolean;
    objectUrl?: string;
    fileType: "image" | "video";
}

interface UploaderProps {
    onUploadComplete?: (key: string) => void;
    onDelete?: () => void;
    initialPreview?: string;
    directory?: string;
}

export default function Uploader({ onUploadComplete, onDelete, initialPreview, directory }: UploaderProps) {
    const [fileState, setFileState] = useState<UploaderState>({
        id: null,
        file: null,
        progress: 0,
        error: false,
        isUploading: false,
        isDeleting: false,
        objectUrl: initialPreview,
        fileType: "image"
    });

    async function uploadFile(file: File) {
        setFileState((prev) => ({
            ...prev,
            isUploading: true,
            progress: 0,
        }));

        try {
            const presignedResponse = await fetch("/api/s3/upload", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    isImage: true,
                    directory: directory,
                }),
            });

            if (!presignedResponse.ok) {
                toast.error("Failed to get presigned url");
                setFileState((prev) => ({
                    ...prev,
                    isUploading: false,
                    progress: 0,
                    error: true,
                }));
                return;
            }

            const { presignedUrl, key } = await presignedResponse.json();

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener("progress", (event) => {
                    if (event.lengthComputable) {
                        const percentage = (event.loaded / event.total) * 100;
                        setFileState((prev) => ({
                            ...prev,
                            progress: Math.round(percentage),
                        }));
                    }
                });

                xhr.addEventListener("load", () => {
                    if (xhr.status === 200 || xhr.status === 204) {
                        setFileState((prev) => ({
                            ...prev,
                            isUploading: false,
                            progress: 100,
                            key: key,
                        }));
                        onUploadComplete?.(key);
                        toast.success("File uploaded successfully");
                        resolve();
                    } else {
                        reject(new Error(`Upload failed: ${xhr.statusText}`));
                    }
                });

                xhr.addEventListener("error", () => {
                    reject(new Error("Network error"));
                });

                xhr.open("PUT", presignedUrl);
                xhr.setRequestHeader("Content-Type", file.type);
                xhr.send(file);
            });
        } catch {
            setFileState((prev) => ({
                ...prev,
                isUploading: false,
                progress: 0,
                error: true,
            }));
            toast.error("Failed to upload file");
        }
    }

    const onDrop = (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];

            if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
                URL.revokeObjectURL(fileState.objectUrl);
            }

            setFileState({
                file: file,
                isUploading: false,
                progress: 0,
                objectUrl: URL.createObjectURL(file),
                error: false,
                id: uuidv4(),
                isDeleting: false,
                fileType: "image",
            });

            uploadFile(file);
        }
    }

    async function handleDeleteFile() {
        if (fileState.isDeleting || !fileState.objectUrl) return;
        try {
            setFileState((prev) => ({
                ...prev,
                isDeleting: true,
            }));

            if (fileState.key) {
                const response = await fetch("/api/s3/delete", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        key: fileState.key,
                    }),
                });

                if (!response.ok) {
                    toast.error("Failed to delete file");
                    setFileState((prev) => ({
                        ...prev,
                        error: true,
                        isDeleting: false,
                    }));
                    return;
                }
            }

            if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
                URL.revokeObjectURL(fileState.objectUrl);
            }

            setFileState({
                file: null,
                isUploading: false,
                progress: 0,
                objectUrl: undefined,
                error: false,
                id: null,
                isDeleting: false,
                fileType: "image",
                key: undefined,
            });
            toast.success("File removed completely");
            onDelete?.();
        } catch {
            setFileState((prev) => ({
                ...prev,
                isDeleting: false,
            }));
            toast.error("Failed to delete file");
        }
    }

    function rejectedFiles(file: FileRejection[]) {
        if (file.length) {
            const tooManyFiles = file.find((rejection) => rejection.errors[0].code === "too_many_files");
            const tooLargeFiles = file.find((rejection) => rejection.errors[0].code === "file_too_large");

            if (tooManyFiles) {
                toast.error("Too many files, please select just 1 file");
            }
            if (tooLargeFiles) {
                toast.error("File too large, please select a file smaller than 5MB");
            }
        }
    }

    function renderContent() {
        if (fileState.isUploading) {
            return (
                <RenderUploadingState progress={fileState.progress} file={fileState.file as File} />
            )
        }

        if (fileState.error) {
            return <RenderErrorState />
        }

        if (fileState.file || fileState.objectUrl) {
            return (
                <RenderSuccessState previewUrl={fileState.objectUrl as string} handleDeleteFile={handleDeleteFile} isDeleting={fileState.isDeleting} />
            )
        }

        return <RenderEmptyState isDragActive={isDragActive} />
    }

    useEffect(() => {
        return () => {
            if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
                URL.revokeObjectURL(fileState.objectUrl);
            }
        }
    }, [fileState.objectUrl])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        maxFiles: 1,
        multiple: false,
        maxSize: 1024 * 1024 * 5,
        onDropRejected: rejectedFiles,
        disabled: fileState.isUploading || !!fileState.objectUrl
    });

    return (
        <Card {...getRootProps()} className={cn(
            "relative border-2 border-dashed transition-colors duration-200 ease-in-out w-full h-64",
            isDragActive
                ? "border-primary bg-primary/10 border-solid"
                : "border-border hover:border-primary"
        )}>
            <CardContent className='flex items-center justify-center h-full w-full p-4'>
                <input {...getInputProps()} />
                {renderContent()}
            </CardContent>
        </Card>
    )
}