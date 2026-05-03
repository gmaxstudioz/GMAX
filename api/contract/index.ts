import {
    CreateBookingContract,
    UpdateBookingContract,
    DeleteBookingContract,
    GetBookingContract,
    GetAllBookingsContract,
    ReassignBookingContract,
    RescheduleBookingContract,
    UpdateBookingStatusContract,
} from "./bookings.contract";

import {
    createServiceContract,
    updateServiceContract,
    deleteServiceContract,
    getServiceContract,
    getAllServicesContract,
    getServiceOptionsContract,
    createCategoryContract,
    updateCategoryContract,
    deleteCategoryContract,
    getAllCategoriesContract,
    createStudioSessionContract,
    updateStudioSessionContract,
    deleteStudioSessionContract,
    getAllStudioSessionsContract,
} from "./service.contract";

import {
    createStudioContract,
    updateStudioContract,
    deleteStudioContract,
    getStudioContract,
    getStudioByIdContract,
    getAllStudiosContract,
    addMemberContract,
    updateMemberContract,
    removeMemberContract,
    getMemberContract,
    getAllMembersContract,
    updateStaffContract,
    inviteMemberContract,
    updateInvitationContract,
    cancelInvitationContract,
    acceptInvitationContract,
    getAllInvitationsContract,
} from "./studio.contract";

import {
    createClientContract,
    updateClientContract,
    deleteClientContract,
    getClientContract,
    getAllClientsContract,
} from "./client.contract";

import {
    createPaymentContract,
    updatePaymentContract,
    deletePaymentContract,
    getPaymentContract,
    getAllPaymentsContract,
    initPaystackPaymentContract,
    paystackWebhookContract,
} from "./payment.contract";

import {
    uploadPhotoContract,
    approvePhotoContract,
    rejectPhotoContract,
    deletePhotoContract,
    getPhotoContract,
    getAllPhotosContract,
    downloadPhotoContract,
    bulkApprovePhotosContract,
} from "./photo.contract";

// ─── Unified Contract Tree ────────────────────────────────────────────────────
//
// This is the single source of truth for the entire API surface.
// The server implements it; the client consumes it.
//
// Structure mirrors REST resource hierarchy:
//   contract.{domain}.{action}
//
// ──────────────────────────────────────────────────────────────────────────────

export const contract = {
    // ── Booking ───────────────────────────────────────────────────────────────
    booking: {
        create: CreateBookingContract,
        update: UpdateBookingContract,
        delete: DeleteBookingContract,
        getById: GetBookingContract,
        getAll: GetAllBookingsContract,
        reassign: ReassignBookingContract,
        reschedule: RescheduleBookingContract,
        updateStatus: UpdateBookingStatusContract,
    },

    // ── Service ───────────────────────────────────────────────────────────────
    service: {
        create: createServiceContract,
        update: updateServiceContract,
        delete: deleteServiceContract,
        getById: getServiceContract,
        getAll: getAllServicesContract,
        options: getServiceOptionsContract,
    },

    // ── Category ──────────────────────────────────────────────────────────────
    category: {
        create: createCategoryContract,
        update: updateCategoryContract,
        delete: deleteCategoryContract,
        getAll: getAllCategoriesContract,
    },

    // ── Studio Session ────────────────────────────────────────────────────────
    studioSession: {
        create: createStudioSessionContract,
        update: updateStudioSessionContract,
        delete: deleteStudioSessionContract,
        getAll: getAllStudioSessionsContract,
    },

    // ── Studio ────────────────────────────────────────────────────────────────
    studio: {
        create: createStudioContract,
        update: updateStudioContract,
        delete: deleteStudioContract,
        getBySlug: getStudioContract,
        getById: getStudioByIdContract,
        getAll: getAllStudiosContract,
    },

    // ── Member ────────────────────────────────────────────────────────────────
    member: {
        add: addMemberContract,
        update: updateMemberContract,
        remove: removeMemberContract,
        getById: getMemberContract,
        getAll: getAllMembersContract,
        updateStaff: updateStaffContract,
    },

    // ── Invitation ────────────────────────────────────────────────────────────
    invitation: {
        invite: inviteMemberContract,
        update: updateInvitationContract,
        cancel: cancelInvitationContract,
        accept: acceptInvitationContract,
        getAll: getAllInvitationsContract,
    },

    // ── Client ────────────────────────────────────────────────────────────────
    client: {
        create: createClientContract,
        update: updateClientContract,
        delete: deleteClientContract,
        getById: getClientContract,
        getAll: getAllClientsContract,
    },

    // ── Payment ───────────────────────────────────────────────────────────────
    payment: {
        create: createPaymentContract,
        update: updatePaymentContract,
        delete: deletePaymentContract,
        getById: getPaymentContract,
        getAll: getAllPaymentsContract,
        initPaystack: initPaystackPaymentContract,
        paystackWebhook: paystackWebhookContract,
    },

    // ── Photo ─────────────────────────────────────────────────────────────────
    photo: {
        upload: uploadPhotoContract,
        approve: approvePhotoContract,
        reject: rejectPhotoContract,
        delete: deletePhotoContract,
        getById: getPhotoContract,
        getAll: getAllPhotosContract,
        download: downloadPhotoContract,
        bulkApprove: bulkApprovePhotosContract,
    },
} as const;

export type AppContract = typeof contract;