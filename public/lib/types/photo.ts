// portal/lib/types/photo.ts

export interface ClientPhotoAccessOutput {
    bookingId: string;
    clientName: string;
    serviceName: string;
    bookingDate: string;
    deliveredAt: string | null;
    birthDate?: string | null;
    weddingDate?: string | null;
    photos: {
        id: string;
        fileName: string;
        thumbnailUrl: string;
        approvalStatus: string;
        uploadedAt: string;
        downloadCount: number;
    }[];
    totalPhotos: number;
}

export interface ClientDownloadOutput {
    downloadUrl: string;
    fileName: string;
    expiresAt: string;
}