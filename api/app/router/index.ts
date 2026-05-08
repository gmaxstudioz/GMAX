import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { BaseContext } from "./middleware";
import {
    checkClient,
    createBookings, createPublicBooking, deleteBooking,
    getAllBookings, getBookingById, reassignBooking,
    rescheduleBooking, updateBooking, updateBookingStatus,
} from "./bookings";
import { createProduct, deleteProduct, getAllProducts, getProductById, purchaseProduct, requestAccessLink, requestDownload, updateProduct, verifyAccessToken } from "./products";
import { clientDownloadPhoto, clientPhotoAccess } from "./photos";
import { verifyPurchase } from "./payments";
import { getStudioBySlug } from "./studio";

const os = implement(contract).$context<BaseContext>();

// ── Stub factory ─────────────────────────────────────────────────────────────
// Marks unimplemented procedures clearly. Replace group-by-group as you build.
const notImplemented = () => { throw new Error("Not implemented"); };

export const router = os.router({
    booking: {
        create: createBookings,
        createPublic: createPublicBooking,
        update: updateBooking,
        delete: deleteBooking,
        getById: getBookingById,
        getAll: getAllBookings,
        reassign: reassignBooking,
        reschedule: rescheduleBooking,
        updateStatus: updateBookingStatus,
        checkClient: checkClient,
    },

    product: {
        create: createProduct,
        update: updateProduct,
        delete: deleteProduct,
        getById: getProductById,
        getAll: getAllProducts,
        purchase: purchaseProduct,
        requestDownload: requestDownload,
        requestAccessLink: requestAccessLink,
        verifyAccessToken: verifyAccessToken,
    },

    service: {
        create: os.service.create.handler(notImplemented),
        update: os.service.update.handler(notImplemented),
        delete: os.service.delete.handler(notImplemented),
        getById: os.service.getById.handler(notImplemented),
        getAll: os.service.getAll.handler(notImplemented),
        options: os.service.options.handler(notImplemented),
    },

    category: {
        create: os.category.create.handler(notImplemented),
        update: os.category.update.handler(notImplemented),
        delete: os.category.delete.handler(notImplemented),
        getAll: os.category.getAll.handler(notImplemented),
    },

    studioSession: {
        create: os.studioSession.create.handler(notImplemented),
        update: os.studioSession.update.handler(notImplemented),
        delete: os.studioSession.delete.handler(notImplemented),
        getAll: os.studioSession.getAll.handler(notImplemented),
    },

    studio: {
        create: os.studio.create.handler(notImplemented),
        update: os.studio.update.handler(notImplemented),
        delete: os.studio.delete.handler(notImplemented),
        getBySlug: getStudioBySlug,
        getById: os.studio.getById.handler(notImplemented),
        getAll: os.studio.getAll.handler(notImplemented),
    },

    member: {
        add: os.member.add.handler(notImplemented),
        update: os.member.update.handler(notImplemented),
        remove: os.member.remove.handler(notImplemented),
        getById: os.member.getById.handler(notImplemented),
        getAll: os.member.getAll.handler(notImplemented),
        updateStaff: os.member.updateStaff.handler(notImplemented),
    },

    invitation: {
        invite: os.invitation.invite.handler(notImplemented),
        update: os.invitation.update.handler(notImplemented),
        cancel: os.invitation.cancel.handler(notImplemented),
        accept: os.invitation.accept.handler(notImplemented),
        getAll: os.invitation.getAll.handler(notImplemented),
    },

    client: {
        create: os.client.create.handler(notImplemented),
        update: os.client.update.handler(notImplemented),
        delete: os.client.delete.handler(notImplemented),
        getById: os.client.getById.handler(notImplemented),
        getAll: os.client.getAll.handler(notImplemented),
    },

    payment: {
        create: os.payment.create.handler(notImplemented),
        update: os.payment.update.handler(notImplemented),
        delete: os.payment.delete.handler(notImplemented),
        getById: os.payment.getById.handler(notImplemented),
        getAll: os.payment.getAll.handler(notImplemented),
        initPaystack: os.payment.initPaystack.handler(notImplemented),
        verifyPurchase: verifyPurchase,
    },

    photo: {
        upload: os.photo.upload.handler(notImplemented),
        approve: os.photo.approve.handler(notImplemented),
        reject: os.photo.reject.handler(notImplemented),
        delete: os.photo.delete.handler(notImplemented),
        getById: os.photo.getById.handler(notImplemented),
        getAll: os.photo.getAll.handler(notImplemented),
        download: os.photo.download.handler(notImplemented),
        bulkApprove: os.photo.bulkApprove.handler(notImplemented),
        clientAccess: clientPhotoAccess,
        clientDownload: clientDownloadPhoto,
    },
});