export interface ProductOutput {
    id: string;
    title: string;
    description: string;
    price: number;
    salePrice: number | null;
    categoryId: string | null;
    category: {
        id: string;
        name: string;
        slug: string;
    } | null;
    fileName: string | null;
    fileSize: number | null;
    mimeType: string | null;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
    signedUrl: string | null;
    thumbnailSignedUrl: string | null;
}

export interface PurchaseProductOutput {
    paymentUrl: string | null;
    reference: string;
    amount: number;
    buyerId: string;
    warning?: string;
}

export interface DownloadOutput {
    downloadUrl: string;
    fileName: string;
    expiresAt: string;
}

export interface VerifyAccessTokenOutput {
    buyerId: string;
    sessionToken: string;
    purchases: {
        productId: string;
        productTitle: string;
        downloadCount: number;
        expiresAt: string | null;
        grantedAt: string;
    }[];
}