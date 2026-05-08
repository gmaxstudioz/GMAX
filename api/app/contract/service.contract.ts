import { baseContract } from "./errors";
import {
    CreateServiceSchema,
    DeleteServiceSchema,
    UpdateServiceSchema,
    CreateCategorySchema,
    UpdateCategorySchema,
} from "@/schema/service.schema";
import {
    ServiceOutputSchema,
    ServiceListOutputSchema,
    CategoryOutputSchema,
    CategoryListOutputSchema,
    StudioSessionOutputSchema,
    StudioSessionListOutputSchema,
} from "@/schema/output/service.output";
import { DeleteOutputSchema } from "@/schema/output/common.output";
import { IdParamSchema, StudioScopedQuerySchema, SearchQuerySchema } from "@/schema/common.schema";
import {
    CreateStudioSessionSchema,
    UpdateStudioSessionSchema,
} from "@/schema/studio.schema";

// ─── Service Contracts ────────────────────────────────────────────────────────

export const createServiceContract = baseContract
    .input(CreateServiceSchema)
    .output(ServiceOutputSchema);

export const updateServiceContract = baseContract
    .input(UpdateServiceSchema.extend({ serviceId: DeleteServiceSchema.shape.serviceId }))
    .output(ServiceOutputSchema);

export const deleteServiceContract = baseContract
    .input(DeleteServiceSchema)
    .output(DeleteOutputSchema);

export const getServiceContract = baseContract
    .input(IdParamSchema)
    .output(ServiceOutputSchema);

export const getAllServicesContract = baseContract
    .input(SearchQuerySchema)
    .output(ServiceListOutputSchema);

/** Lightweight list for dropdowns / selects */
export const getServiceOptionsContract = baseContract
    .input(StudioScopedQuerySchema)
    .output(ServiceListOutputSchema);

// ─── Category Contracts ───────────────────────────────────────────────────────

export const createCategoryContract = baseContract
    .input(CreateCategorySchema)
    .output(CategoryOutputSchema);

export const updateCategoryContract = baseContract
    .input(UpdateCategorySchema.extend({ id: IdParamSchema.shape.id }))
    .output(CategoryOutputSchema);

export const deleteCategoryContract = baseContract
    .input(IdParamSchema)
    .output(DeleteOutputSchema);

export const getAllCategoriesContract = baseContract
    .input(StudioScopedQuerySchema)
    .output(CategoryListOutputSchema);

// ─── Studio Session Contracts ─────────────────────────────────────────────────

export const createStudioSessionContract = baseContract
    .input(CreateStudioSessionSchema)
    .output(StudioSessionOutputSchema);

export const updateStudioSessionContract = baseContract
    .input(UpdateStudioSessionSchema.extend({ id: IdParamSchema.shape.id }))
    .output(StudioSessionOutputSchema);

export const deleteStudioSessionContract = baseContract
    .input(IdParamSchema)
    .output(DeleteOutputSchema);

export const getAllStudioSessionsContract = baseContract
    .input(StudioScopedQuerySchema)
    .output(StudioSessionListOutputSchema);