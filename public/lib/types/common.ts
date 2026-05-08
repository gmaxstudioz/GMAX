// portal/lib/types/common.ts
export interface PaginationMeta {
    total: number;
    page: number;
    perPage: number;
    pageCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
    items: T[];
    meta: PaginationMeta;
}