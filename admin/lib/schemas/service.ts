import { z } from "zod";

export const LocationTypeEnum = z.enum([
    "STUDIO",
    "OUTDOOR",
    "BOTH",
    "MULTIPLE",
], { message: "Invalid location type" });

export const ServiceCategoryTypeEnum = z.enum([
    "PHOTOGRAPHY",
    "VIDEOGRAPHY",
    "OTHERS",
], { message: "Invalid category type" });

export const ServiceDeliverableSchema = z.object({
    label:      z.string().min(1, "Label is required"),
    quantity:   z.number().int().positive().optional(),
    detail:     z.string().optional(),
    isFree:     z.boolean(), 
});

export const ServiceVariantSchema = z.object({
    id:                     z.string().optional(),
    locationType:           LocationTypeEnum,
    basePrice:              z.number().min(0, "Base price cannot be negative"),
    maxPrice:               z.number().min(0, "Max price cannot be negative").optional(),
    sessionDurationMins:    z.number().int().min(1, "Session duration must be at least 1 minute"),
    logisticsIncluded:      z.boolean(),
    deliverables:           z.array(ServiceDeliverableSchema).optional(),
});

export const ServiceVariantOutput = ServiceVariantSchema.extend({
    id:         z.string(),
    serviceId:  z.string(),
});

export const ServiceSchema = z.object({
    name:               z.string().min(1, "Service name is required"),
    description:        z.string().min(1, "Description is required"),
    features:           z.array(z.string()).optional(),
    isAddon:            z.boolean(),
    isActive:           z.boolean(),
    studioSessionId:    z.string().min(1, "Studio Session is required"),
    category:           ServiceCategoryTypeEnum.default("OTHERS"),
    studioId:           z.string().optional(),
    variants:           z.array(ServiceVariantSchema).min(1, "At least one pricing variant is required"),
});

export const ServiceOutput = z.object({
    id:                 z.string(),
    name:               z.string(),
    description:        z.string(),
    features:           z.array(z.string()).optional(),
    isAddon:            z.boolean(),
    isActive:           z.boolean(),
    studioSessionId:    z.string(),
    category:           ServiceCategoryTypeEnum,
    studioId:           z.string(),
    variants:           z.array(ServiceVariantOutput).optional(),
});

export type LocationType            = z.infer<typeof LocationTypeEnum>;
export type ServiceVariantInput     = z.infer<typeof ServiceVariantSchema>;
export type ServiceDeliverableInput = z.infer<typeof ServiceDeliverableSchema>;
export type ServiceCategoryType     = z.infer<typeof ServiceCategoryTypeEnum>;
export type ServicePayload = z.output<typeof ServiceSchema>;
export type ServiceOutput = z.infer<typeof ServiceOutput>;