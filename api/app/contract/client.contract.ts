import { baseContract } from "./errors";
import {
    CreateClientSchema,
    UpdateClientSchema,
} from "@/schema/client.schema";
import {
    ClientOutputSchema,
    ClientListOutputSchema,
} from "@/schema/output/booking.output";
import { DeleteOutputSchema } from "@/schema/output/common.output";
import { IdParamSchema, SearchQuerySchema } from "@/schema/common.schema";

// ─── Client Contracts ─────────────────────────────────────────────────────────

export const createClientContract = baseContract
    .input(CreateClientSchema)
    .output(ClientOutputSchema);

export const updateClientContract = baseContract
    .input(UpdateClientSchema.extend({ id: IdParamSchema.shape.id }))
    .output(ClientOutputSchema);

export const deleteClientContract = baseContract
    .input(IdParamSchema)
    .output(DeleteOutputSchema);

export const getClientContract = baseContract
    .input(IdParamSchema)
    .output(ClientOutputSchema);

export const getAllClientsContract = baseContract
    .input(SearchQuerySchema)
    .output(ClientListOutputSchema);
