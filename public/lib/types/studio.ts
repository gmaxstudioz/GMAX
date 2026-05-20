// portal/lib/types/studio.ts

export interface ServiceVariantOutput {
    id: string;
    locationType: "STUDIO" | "OUTDOOR" | "BOTH" | "MULTIPLE";
    basePrice: string; // Comes from backend as a string
    maxPrice: string | null;
    sessionDurationMins: number;
}

export interface PublicServiceOutput {
    id: string;
    name: string;
    isAddon: boolean;
    description: string;
    features: string[];
    variants: ServiceVariantOutput[];
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