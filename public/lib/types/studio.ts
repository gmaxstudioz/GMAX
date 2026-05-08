// portal/lib/types/studio.ts

export interface PublicServiceOutput {
    id: string;
    name: string;
    type: string;
    description: string;
    features: string[];
    price: number;
    salePrice: number | null;
}

export interface PublicCategoryOutput {
    id: string;
    name: string;
    type: string;
    services: PublicServiceOutput[];
}

export interface PublicStudioSessionOutput {
    id: string;
    name: string;
    duration: number;
}

export interface PublicStudioOutput {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    categories: PublicCategoryOutput[];
    studioSessions: PublicStudioSessionOutput[];
    addons: PublicServiceOutput[];
}