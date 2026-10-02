import { pgTable, index, foreignKey, text, boolean, timestamp, uniqueIndex, integer, numeric, jsonb, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const bookingIntentStatus = pgEnum("BookingIntentStatus", ['PENDING', 'COMPLETED', 'EXPIRED', 'FAILED'])
export const bookingStatus = pgEnum("BookingStatus", ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])
export const courseLevel = pgEnum("CourseLevel", ['FOUNDATION', 'INTERMEDIATE', 'ADVANCED', 'MASTER_CLASS'])
export const deliveryStatus = pgEnum("DeliveryStatus", ['PENDING', 'DELIVERED', 'CANCELLED'])
export const enrollmentStatus = pgEnum("EnrollmentStatus", ['PENDING', 'ACTIVE', 'COMPLETED', 'DROPPED'])
export const locationType = pgEnum("LocationType", ['STUDIO', 'OUTDOOR', 'BOTH', 'MULTIPLE'])
export const notificationChannel = pgEnum("NotificationChannel", ['SMS', 'WHATSAPP', 'EMAIL'])
export const notificationStatus = pgEnum("NotificationStatus", ['PENDING', 'SENT', 'DELIVERED', 'FAILED'])
export const notificationType = pgEnum("NotificationType", ['BOOKING_CONFIRMATION', 'PAYMENT_REMINDER', 'PHOTOS_READY', 'PHOTOS_EXPIRING', 'STAFF_INVITATION'])
export const paymentInstallmentType = pgEnum("PaymentInstallmentType", ['DEPOSIT', 'INSTALLMENT', 'BALANCE', 'FULL'])
export const paymentMethod = pgEnum("PaymentMethod", ['CASH', 'TRANSFER', 'POS'])
export const paymentPlan = pgEnum("PaymentPlan", ['QUARTER', 'HALF', 'FULL'])
export const paymentStatus = pgEnum("PaymentStatus", ['PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED'])
export const photoApprovalStatus = pgEnum("PhotoApprovalStatus", ['PENDING_REVIEW', 'APPROVED', 'REJECTED'])
export const priceApprovalStatus = pgEnum("PriceApprovalStatus", ['APPROVED', 'PENDING_APPROVAL', 'REJECTED'])
export const revisionStatus = pgEnum("RevisionStatus", ['PENDING', 'RESOLVED'])
export const serviceCategoryType = pgEnum("ServiceCategoryType", ['PHOTOGRAPHY', 'VIDEOGRAPHY', 'OTHERS'])


export const userNotification = pgTable("user_notification", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	type: text().notNull(),
	bookingId: text(),
	isRead: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("user_notification_isRead_idx").using("btree", table.isRead.asc().nullsLast().op("bool_ops")),
	index("user_notification_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [booking.id],
			name: "user_notification_bookingId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "user_notification_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const booking = pgTable("booking", {
	id: text().primaryKey().notNull(),
	bookingDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	sessionCount: integer().default(1).notNull(),
	extraPicturesCount: integer().default(0).notNull(),
	notes: text(),
	totalAmount: numeric({ precision: 12, scale:  2 }).notNull(),
	paymentPlan: paymentPlan().default('FULL').notNull(),
	bookingStatus: bookingStatus().default('PENDING').notNull(),
	paymentStatus: paymentStatus().default('PENDING').notNull(),
	deliveryStatus: deliveryStatus().default('PENDING').notNull(),
	serviceId: text().notNull(),
	studioId: text().notNull(),
	clientId: text().notNull(),
	createdBy: text().notNull(),
	memberId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	serviceVariantId: text(),
	accessCode: text(),
	deliveredAt: timestamp({ precision: 3, mode: 'string' }),
	pendingTotalAmount: numeric({ precision: 12, scale:  2 }),
	priceApprovalStatus: priceApprovalStatus().default('APPROVED').notNull(),
	priceApprovedAt: timestamp({ precision: 3, mode: 'string' }),
	priceApprovedBy: text(),
	priceChangedBy: text(),
}, (table) => [
	index("booking_accessCode_idx").using("btree", table.accessCode.asc().nullsLast().op("text_ops")),
	uniqueIndex("booking_accessCode_key").using("btree", table.accessCode.asc().nullsLast().op("text_ops")),
	index("booking_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("booking_studioId_idx").using("btree", table.studioId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "booking_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "booking_createdBy_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [member.id],
			name: "booking_memberId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.serviceId],
			foreignColumns: [service.id],
			name: "booking_serviceId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.serviceVariantId],
			foreignColumns: [serviceVariant.id],
			name: "booking_serviceVariantId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.studioId],
			foreignColumns: [studio.id],
			name: "booking_studioId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text().notNull(),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ precision: 3, mode: 'string' }),
	refreshTokenExpiresAt: timestamp({ precision: 3, mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const serviceVariant = pgTable("service_variant", {
	id: text().primaryKey().notNull(),
	serviceId: text().notNull(),
	locationType: locationType().notNull(),
	basePrice: numeric({ precision: 12, scale:  2 }).notNull(),
	maxPrice: numeric({ precision: 12, scale:  2 }),
	sessionDurationMins: integer().notNull(),
	logisticsIncluded: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	title: text(),
}, (table) => [
	index("service_variant_serviceId_idx").using("btree", table.serviceId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.serviceId],
			foreignColumns: [service.id],
			name: "service_variant_serviceId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const studio = pgTable("studio", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	logo: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	metadata: jsonb(),
}, (table) => [
	uniqueIndex("studio_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const organizationRole = pgTable("organizationRole", {
	id: text().primaryKey().notNull(),
	organizationId: text().notNull(),
	role: text().notNull(),
	permission: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("organizationRole_organizationId_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	uniqueIndex("organizationRole_organizationId_role_key").using("btree", table.organizationId.asc().nullsLast().op("text_ops"), table.role.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [studio.id],
			name: "organizationRole_organizationId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
]);

export const member = pgTable("member", {
	id: text().primaryKey().notNull(),
	studioId: text().notNull(),
	userId: text().notNull(),
	role: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("member_studioId_idx").using("btree", table.studioId.asc().nullsLast().op("text_ops")),
	index("member_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.studioId],
			foreignColumns: [studio.id],
			name: "member_studioId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "member_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const invitation = pgTable("invitation", {
	id: text().primaryKey().notNull(),
	studioId: text().notNull(),
	email: text().notNull(),
	role: text(),
	status: text().default('pending').notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	inviterId: text().notNull(),
}, (table) => [
	index("invitation_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("invitation_studioId_idx").using("btree", table.studioId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.inviterId],
			foreignColumns: [user.id],
			name: "invitation_inviterId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.studioId],
			foreignColumns: [studio.id],
			name: "invitation_studioId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const service = pgTable("service", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	features: text().array(),
	isAddon: boolean().default(false).notNull(),
	isActive: boolean().default(true).notNull(),
	discountPercentage: integer().default(0).notNull(),
	category: serviceCategoryType().default('OTHERS').notNull(),
	studioId: text().notNull(),
	studioSessionId: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("service_studioId_idx").using("btree", table.studioId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.studioId],
			foreignColumns: [studio.id],
			name: "service_studioId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.studioSessionId],
			foreignColumns: [studioSession.id],
			name: "service_studioSessionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean().default(false).notNull(),
	image: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	role: text().default('user').notNull(),
	phoneNumber: text(),
	phoneNumberVerified: boolean(),
}, (table) => [
	uniqueIndex("user_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	uniqueIndex("user_phoneNumber_key").using("btree", table.phoneNumber.asc().nullsLast().op("text_ops")),
]);

export const course = pgTable("course", {
	id: text().primaryKey().notNull(),
	studioId: text().notNull(),
	name: text().notNull(),
	level: courseLevel().notNull(),
	price: numeric({ precision: 12, scale:  2 }).notNull(),
	durationWeeks: integer().notNull(),
	isNegotiable: boolean().default(false).notNull(),
	hasCertificate: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("course_studioId_idx").using("btree", table.studioId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.studioId],
			foreignColumns: [studio.id],
			name: "course_studioId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const courseModule = pgTable("course_module", {
	id: text().primaryKey().notNull(),
	courseId: text().notNull(),
	title: text().notNull(),
	order: integer().notNull(),
}, (table) => [
	index("course_module_courseId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "course_module_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const enrollment = pgTable("enrollment", {
	id: text().primaryKey().notNull(),
	studioId: text().notNull(),
	courseId: text().notNull(),
	clientId: text().notNull(),
	startDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	endDate: timestamp({ precision: 3, mode: 'string' }),
	status: enrollmentStatus().default('PENDING').notNull(),
	paymentStatus: paymentStatus().default('PENDING').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("enrollment_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("enrollment_courseId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
	index("enrollment_studioId_idx").using("btree", table.studioId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "enrollment_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "enrollment_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.studioId],
			foreignColumns: [studio.id],
			name: "enrollment_studioId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const client = pgTable("client", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	phone: text().notNull(),
	altPhone: text(),
	email: text(),
	address: text(),
	image: text(),
	notes: text(),
	type: text().notNull(),
	birthDate: timestamp({ precision: 3, mode: 'string' }),
	weddingDate: timestamp({ precision: 3, mode: 'string' }),
	studioId: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("client_studioId_email_key").using("btree", table.studioId.asc().nullsLast().op("text_ops"), table.email.asc().nullsLast().op("text_ops")),
	index("client_studioId_idx").using("btree", table.studioId.asc().nullsLast().op("text_ops")),
	uniqueIndex("client_studioId_phone_key").using("btree", table.studioId.asc().nullsLast().op("text_ops"), table.phone.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.studioId],
			foreignColumns: [studio.id],
			name: "client_studioId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const bookingIntent = pgTable("booking_intent", {
	id: text().primaryKey().notNull(),
	studioId: text().notNull(),
	clientName: text().notNull(),
	clientEmail: text(),
	clientPhone: text(),
	existingClientId: text(),
	serviceId: text().notNull(),
	serviceVariantId: text(),
	addonIds: text().array(),
	sessionCount: integer().notNull(),
	extraPicturesCount: integer().default(0).notNull(),
	bookingDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	notes: text(),
	paystackReference: text().notNull(),
	totalAmount: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	paymentPlan: paymentPlan().default('FULL').notNull(),
	status: bookingIntentStatus().default('PENDING').notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	resolvedBookingId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("booking_intent_paystackReference_idx").using("btree", table.paystackReference.asc().nullsLast().op("text_ops")),
	uniqueIndex("booking_intent_paystackReference_key").using("btree", table.paystackReference.asc().nullsLast().op("text_ops")),
	index("booking_intent_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.studioId],
			foreignColumns: [studio.id],
			name: "booking_intent_studioId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const payment = pgTable("Payment", {
	id: text().primaryKey().notNull(),
	bookingId: text(),
	installmentType: paymentInstallmentType(),
	sequence: integer(),
	expectedAmount: numeric({ precision: 12, scale:  2 }),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	method: paymentMethod().default('CASH').notNull(),
	status: paymentStatus().default('PENDING').notNull(),
	paystackReference: text(),
	paystackResponse: jsonb(),
	receiptNumber: text().notNull(),
	receiptUrl: text(),
	recordedById: text(),
	paymentDate: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("Payment_bookingId_idx").using("btree", table.bookingId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Payment_bookingId_sequence_key").using("btree", table.bookingId.asc().nullsLast().op("text_ops"), table.sequence.asc().nullsLast().op("text_ops")),
	index("Payment_paymentDate_idx").using("btree", table.paymentDate.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("Payment_paystackReference_key").using("btree", table.paystackReference.asc().nullsLast().op("text_ops")),
	uniqueIndex("Payment_receiptNumber_key").using("btree", table.receiptNumber.asc().nullsLast().op("text_ops")),
	index("Payment_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [booking.id],
			name: "Payment_bookingId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.recordedById],
			foreignColumns: [user.id],
			name: "Payment_recordedById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const photo = pgTable("Photo", {
	id: text().primaryKey().notNull(),
	bookingId: text().notNull(),
	r2Key: text().notNull(),
	fileName: text().notNull(),
	fileSize: integer().notNull(),
	mimeType: text().notNull(),
	thumbnailKey: text(),
	uploadedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	downloaded: boolean().default(false).notNull(),
	downloadedAt: timestamp({ precision: 3, mode: 'string' }),
	downloadCount: integer().default(0).notNull(),
	approvalStatus: photoApprovalStatus().default('PENDING_REVIEW').notNull(),
	rejectionReason: text(),
	approvedAt: timestamp({ precision: 3, mode: 'string' }),
	approvedById: text(),
	uploadedById: text().notNull(),
}, (table) => [
	index("Photo_approvalStatus_idx").using("btree", table.approvalStatus.asc().nullsLast().op("enum_ops")),
	index("Photo_bookingId_idx").using("btree", table.bookingId.asc().nullsLast().op("text_ops")),
	index("Photo_expiresAt_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [user.id],
			name: "Photo_approvedById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [booking.id],
			name: "Photo_bookingId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedById],
			foreignColumns: [user.id],
			name: "Photo_uploadedById_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const notification = pgTable("Notification", {
	id: text().primaryKey().notNull(),
	clientPhone: text().notNull(),
	clientEmail: text(),
	clientName: text().notNull(),
	type: notificationType().notNull(),
	message: text().notNull(),
	// TODO: failed to parse database type 'NotificationChannel"[]'
	channel: text("channel").array(),
	status: notificationStatus().default('PENDING').notNull(),
	sentAt: timestamp({ precision: 3, mode: 'string' }),
	deliveredAt: timestamp({ precision: 3, mode: 'string' }),
	errorMessage: text(),
	bookingId: text(),
	providerId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("Notification_bookingId_idx").using("btree", table.bookingId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Notification_providerId_key").using("btree", table.providerId.asc().nullsLast().op("text_ops")),
	index("Notification_sentAt_idx").using("btree", table.sentAt.asc().nullsLast().op("timestamp_ops")),
	index("Notification_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [booking.id],
			name: "Notification_bookingId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const productCategory = pgTable("product_category", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("product_category_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
	uniqueIndex("product_category_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const serviceDeliverable = pgTable("service_deliverable", {
	id: text().primaryKey().notNull(),
	variantId: text().notNull(),
	label: text().notNull(),
	quantity: integer(),
	detail: text(),
	isFree: boolean().default(false).notNull(),
}, (table) => [
	index("service_deliverable_variantId_idx").using("btree", table.variantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.variantId],
			foreignColumns: [serviceVariant.id],
			name: "service_deliverable_variantId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const productAccess = pgTable("product_access", {
	id: text().primaryKey().notNull(),
	productId: text().notNull(),
	buyerId: text().notNull(),
	paymentId: text(),
	downloadCount: integer().default(0).notNull(),
	lastDownloadAt: timestamp({ precision: 3, mode: 'string' }),
	expiresAt: timestamp({ precision: 3, mode: 'string' }),
	grantedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("product_access_buyerId_idx").using("btree", table.buyerId.asc().nullsLast().op("text_ops")),
	uniqueIndex("product_access_paymentId_key").using("btree", table.paymentId.asc().nullsLast().op("text_ops")),
	uniqueIndex("product_access_productId_buyerId_key").using("btree", table.productId.asc().nullsLast().op("text_ops"), table.buyerId.asc().nullsLast().op("text_ops")),
	index("product_access_productId_idx").using("btree", table.productId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.buyerId],
			foreignColumns: [buyer.id],
			name: "product_access_buyerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [payment.id],
			name: "product_access_paymentId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [product.id],
			name: "product_access_productId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const revisionRequest = pgTable("revision_request", {
	id: text().primaryKey().notNull(),
	bookingId: text().notNull(),
	description: text().notNull(),
	status: revisionStatus().default('PENDING').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("revision_request_bookingId_idx").using("btree", table.bookingId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [booking.id],
			name: "revision_request_bookingId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const academyCourse = pgTable("academy_course", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	price: numeric({ precision: 65, scale:  30 }).notNull(),
	duration: text(),
	location: text(),
	isPublished: boolean().default(false).notNull(),
	thumbnail: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const portfolioItem = pgTable("portfolio_item", {
	id: text().primaryKey().notNull(),
	title: text(),
	category: text().default('General').notNull(),
	r2Key: text().notNull(),
	fileName: text().notNull(),
	fileSize: integer().notNull(),
	mimeType: text().notNull(),
	thumbnailKey: text(),
	sortOrder: integer().default(0).notNull(),
	isPublished: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("portfolio_item_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("portfolio_item_sortOrder_idx").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
]);

export const academyBatch = pgTable("academy_batch", {
	id: text().primaryKey().notNull(),
	courseId: text().notNull(),
	name: text().notNull(),
	startDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	endDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("academy_batch_courseId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [academyCourse.id],
			name: "academy_batch_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const academyModule = pgTable("academy_module", {
	id: text().primaryKey().notNull(),
	courseId: text().notNull(),
	title: text().notNull(),
	description: text(),
	sortOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("academy_module_courseId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [academyCourse.id],
			name: "academy_module_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const academyStudent = pgTable("academy_student", {
	id: text().primaryKey().notNull(),
	courseId: text().notNull(),
	batchId: text().notNull(),
	firstName: text().notNull(),
	lastName: text().notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	amountPaid: numeric({ precision: 65, scale:  30 }).notNull(),
	paymentPlan: text().default('FULL').notNull(),
	howDidYouHear: text().default('').notNull(),
	paymentReference: text(),
	paymentStatus: text().default('PENDING').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("academy_student_batchId_idx").using("btree", table.batchId.asc().nullsLast().op("text_ops")),
	index("academy_student_courseId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
	uniqueIndex("academy_student_paymentReference_key").using("btree", table.paymentReference.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.batchId],
			foreignColumns: [academyBatch.id],
			name: "academy_student_batchId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [academyCourse.id],
			name: "academy_student_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const product = pgTable("product", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	price: numeric({ precision: 12, scale:  2 }).notNull(),
	salePrice: numeric({ precision: 12, scale:  2 }),
	categoryId: text(),
	r2Key: text(),
	fileName: text(),
	fileSize: integer(),
	mimeType: text(),
	thumbnailKey: text(),
	isPublished: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("product_categoryId_idx").using("btree", table.categoryId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [productCategory.id],
			name: "product_categoryId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const buyer = pgTable("buyer", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	phone: text().notNull(),
	email: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("buyer_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	uniqueIndex("buyer_phone_key").using("btree", table.phone.asc().nullsLast().op("text_ops")),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	ipAddress: text(),
	userAgent: text(),
	userId: text().notNull(),
	activeOrganizationId: text(),
}, (table) => [
	uniqueIndex("session_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const studioSession = pgTable("studioSession", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	duration: integer().default(45).notNull(),
	studioId: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("studioSession_studioId_idx").using("btree", table.studioId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.studioId],
			foreignColumns: [studio.id],
			name: "studioSession_studioId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const buyerAccessToken = pgTable("buyer_access_token", {
	id: text().primaryKey().notNull(),
	buyerId: text().notNull(),
	token: text().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	used: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("buyer_access_token_buyerId_idx").using("btree", table.buyerId.asc().nullsLast().op("text_ops")),
	index("buyer_access_token_token_idx").using("btree", table.token.asc().nullsLast().op("text_ops")),
	uniqueIndex("buyer_access_token_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.buyerId],
			foreignColumns: [buyer.id],
			name: "buyer_access_token_buyerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const bookingAddons = pgTable("_BookingAddons", {
	a: text("A").notNull(),
	b: text("B").notNull(),
}, (table) => [
	index().using("btree", table.b.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.a],
			foreignColumns: [booking.id],
			name: "_BookingAddons_A_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.b],
			foreignColumns: [service.id],
			name: "_BookingAddons_B_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.a, table.b], name: "_BookingAddons_AB_pkey"}),
]);
