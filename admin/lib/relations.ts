import { relations } from "drizzle-orm/relations";
import { booking, userNotification, user, client, member, service, serviceVariant, studio, account, organizationRole, invitation, studioSession, course, courseModule, enrollment, bookingIntent, payment, photo, notification, serviceDeliverable, buyer, productAccess, product, revisionRequest, academyCourse, academyBatch, academyModule, academyStudent, productCategory, session, buyerAccessToken, bookingAddons } from "./schema";

export const userNotificationRelations = relations(userNotification, ({one}) => ({
	booking: one(booking, {
		fields: [userNotification.bookingId],
		references: [booking.id]
	}),
	user: one(user, {
		fields: [userNotification.userId],
		references: [user.id]
	}),
}));

export const bookingRelations = relations(booking, ({one, many}) => ({
	userNotifications: many(userNotification),
	client: one(client, {
		fields: [booking.clientId],
		references: [client.id]
	}),
	user: one(user, {
		fields: [booking.createdBy],
		references: [user.id]
	}),
	member: one(member, {
		fields: [booking.memberId],
		references: [member.id]
	}),
	service: one(service, {
		fields: [booking.serviceId],
		references: [service.id]
	}),
	serviceVariant: one(serviceVariant, {
		fields: [booking.serviceVariantId],
		references: [serviceVariant.id]
	}),
	studio: one(studio, {
		fields: [booking.studioId],
		references: [studio.id]
	}),
	payments: many(payment),
	photos: many(photo),
	notifications: many(notification),
	revisionRequests: many(revisionRequest),
	bookingAddons: many(bookingAddons),
}));

export const userRelations = relations(user, ({many}) => ({
	userNotifications: many(userNotification),
	bookings: many(booking),
	accounts: many(account),
	members: many(member),
	invitations: many(invitation),
	payments: many(payment),
	photos_approvedById: many(photo, {
		relationName: "photo_approvedById_user_id"
	}),
	photos_uploadedById: many(photo, {
		relationName: "photo_uploadedById_user_id"
	}),
	sessions: many(session),
}));

export const clientRelations = relations(client, ({one, many}) => ({
	bookings: many(booking),
	enrollments: many(enrollment),
	studio: one(studio, {
		fields: [client.studioId],
		references: [studio.id]
	}),
}));

export const memberRelations = relations(member, ({one, many}) => ({
	bookings: many(booking),
	studio: one(studio, {
		fields: [member.studioId],
		references: [studio.id]
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id]
	}),
}));

export const serviceRelations = relations(service, ({one, many}) => ({
	bookings: many(booking),
	serviceVariants: many(serviceVariant),
	studio: one(studio, {
		fields: [service.studioId],
		references: [studio.id]
	}),
	studioSession: one(studioSession, {
		fields: [service.studioSessionId],
		references: [studioSession.id]
	}),
	bookingAddons: many(bookingAddons),
}));

export const serviceVariantRelations = relations(serviceVariant, ({one, many}) => ({
	bookings: many(booking),
	service: one(service, {
		fields: [serviceVariant.serviceId],
		references: [service.id]
	}),
	serviceDeliverables: many(serviceDeliverable),
}));

export const studioRelations = relations(studio, ({many}) => ({
	bookings: many(booking),
	organizationRoles: many(organizationRole),
	members: many(member),
	invitations: many(invitation),
	services: many(service),
	courses: many(course),
	enrollments: many(enrollment),
	clients: many(client),
	bookingIntents: many(bookingIntent),
	studioSessions: many(studioSession),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const organizationRoleRelations = relations(organizationRole, ({one}) => ({
	studio: one(studio, {
		fields: [organizationRole.organizationId],
		references: [studio.id]
	}),
}));

export const invitationRelations = relations(invitation, ({one}) => ({
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id]
	}),
	studio: one(studio, {
		fields: [invitation.studioId],
		references: [studio.id]
	}),
}));

export const studioSessionRelations = relations(studioSession, ({one, many}) => ({
	services: many(service),
	studio: one(studio, {
		fields: [studioSession.studioId],
		references: [studio.id]
	}),
}));

export const courseRelations = relations(course, ({one, many}) => ({
	studio: one(studio, {
		fields: [course.studioId],
		references: [studio.id]
	}),
	courseModules: many(courseModule),
	enrollments: many(enrollment),
}));

export const courseModuleRelations = relations(courseModule, ({one}) => ({
	course: one(course, {
		fields: [courseModule.courseId],
		references: [course.id]
	}),
}));

export const enrollmentRelations = relations(enrollment, ({one}) => ({
	client: one(client, {
		fields: [enrollment.clientId],
		references: [client.id]
	}),
	course: one(course, {
		fields: [enrollment.courseId],
		references: [course.id]
	}),
	studio: one(studio, {
		fields: [enrollment.studioId],
		references: [studio.id]
	}),
}));

export const bookingIntentRelations = relations(bookingIntent, ({one}) => ({
	studio: one(studio, {
		fields: [bookingIntent.studioId],
		references: [studio.id]
	}),
}));

export const paymentRelations = relations(payment, ({one, many}) => ({
	booking: one(booking, {
		fields: [payment.bookingId],
		references: [booking.id]
	}),
	user: one(user, {
		fields: [payment.recordedById],
		references: [user.id]
	}),
	productAccesses: many(productAccess),
}));

export const photoRelations = relations(photo, ({one}) => ({
	user_approvedById: one(user, {
		fields: [photo.approvedById],
		references: [user.id],
		relationName: "photo_approvedById_user_id"
	}),
	booking: one(booking, {
		fields: [photo.bookingId],
		references: [booking.id]
	}),
	user_uploadedById: one(user, {
		fields: [photo.uploadedById],
		references: [user.id],
		relationName: "photo_uploadedById_user_id"
	}),
}));

export const notificationRelations = relations(notification, ({one}) => ({
	booking: one(booking, {
		fields: [notification.bookingId],
		references: [booking.id]
	}),
}));

export const serviceDeliverableRelations = relations(serviceDeliverable, ({one}) => ({
	serviceVariant: one(serviceVariant, {
		fields: [serviceDeliverable.variantId],
		references: [serviceVariant.id]
	}),
}));

export const productAccessRelations = relations(productAccess, ({one}) => ({
	buyer: one(buyer, {
		fields: [productAccess.buyerId],
		references: [buyer.id]
	}),
	payment: one(payment, {
		fields: [productAccess.paymentId],
		references: [payment.id]
	}),
	product: one(product, {
		fields: [productAccess.productId],
		references: [product.id]
	}),
}));

export const buyerRelations = relations(buyer, ({many}) => ({
	productAccesses: many(productAccess),
	buyerAccessTokens: many(buyerAccessToken),
}));

export const productRelations = relations(product, ({one, many}) => ({
	productAccesses: many(productAccess),
	productCategory: one(productCategory, {
		fields: [product.categoryId],
		references: [productCategory.id]
	}),
}));

export const revisionRequestRelations = relations(revisionRequest, ({one}) => ({
	booking: one(booking, {
		fields: [revisionRequest.bookingId],
		references: [booking.id]
	}),
}));

export const academyBatchRelations = relations(academyBatch, ({one, many}) => ({
	academyCourse: one(academyCourse, {
		fields: [academyBatch.courseId],
		references: [academyCourse.id]
	}),
	academyStudents: many(academyStudent),
}));

export const academyCourseRelations = relations(academyCourse, ({many}) => ({
	academyBatches: many(academyBatch),
	academyModules: many(academyModule),
	academyStudents: many(academyStudent),
}));

export const academyModuleRelations = relations(academyModule, ({one}) => ({
	academyCourse: one(academyCourse, {
		fields: [academyModule.courseId],
		references: [academyCourse.id]
	}),
}));

export const academyStudentRelations = relations(academyStudent, ({one}) => ({
	academyBatch: one(academyBatch, {
		fields: [academyStudent.batchId],
		references: [academyBatch.id]
	}),
	academyCourse: one(academyCourse, {
		fields: [academyStudent.courseId],
		references: [academyCourse.id]
	}),
}));

export const productCategoryRelations = relations(productCategory, ({many}) => ({
	products: many(product),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const buyerAccessTokenRelations = relations(buyerAccessToken, ({one}) => ({
	buyer: one(buyer, {
		fields: [buyerAccessToken.buyerId],
		references: [buyer.id]
	}),
}));

export const bookingAddonsRelations = relations(bookingAddons, ({one}) => ({
	booking: one(booking, {
		fields: [bookingAddons.a],
		references: [booking.id]
	}),
	service: one(service, {
		fields: [bookingAddons.b],
		references: [service.id]
	}),
}));