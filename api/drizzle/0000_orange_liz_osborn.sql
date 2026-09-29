-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."BookingIntentStatus" AS ENUM('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."BookingStatus" AS ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."CourseLevel" AS ENUM('FOUNDATION', 'INTERMEDIATE', 'ADVANCED', 'MASTER_CLASS');--> statement-breakpoint
CREATE TYPE "public"."DeliveryStatus" AS ENUM('PENDING', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."EnrollmentStatus" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'DROPPED');--> statement-breakpoint
CREATE TYPE "public"."LocationType" AS ENUM('STUDIO', 'OUTDOOR', 'BOTH', 'MULTIPLE');--> statement-breakpoint
CREATE TYPE "public"."NotificationChannel" AS ENUM('SMS', 'WHATSAPP', 'EMAIL');--> statement-breakpoint
CREATE TYPE "public"."NotificationStatus" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."NotificationType" AS ENUM('BOOKING_CONFIRMATION', 'PAYMENT_REMINDER', 'PHOTOS_READY', 'PHOTOS_EXPIRING', 'STAFF_INVITATION');--> statement-breakpoint
CREATE TYPE "public"."PaymentInstallmentType" AS ENUM('DEPOSIT', 'INSTALLMENT', 'BALANCE', 'FULL');--> statement-breakpoint
CREATE TYPE "public"."PaymentMethod" AS ENUM('CASH', 'TRANSFER', 'POS');--> statement-breakpoint
CREATE TYPE "public"."PaymentPlan" AS ENUM('QUARTER', 'HALF', 'FULL');--> statement-breakpoint
CREATE TYPE "public"."PaymentStatus" AS ENUM('PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."PhotoApprovalStatus" AS ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."PriceApprovalStatus" AS ENUM('APPROVED', 'PENDING_APPROVAL', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."RevisionStatus" AS ENUM('PENDING', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."ServiceCategoryType" AS ENUM('PHOTOGRAPHY', 'VIDEOGRAPHY', 'OTHERS');--> statement-breakpoint
CREATE TABLE "user_notification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"bookingId" text,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingDate" timestamp(3) NOT NULL,
	"sessionCount" integer DEFAULT 1 NOT NULL,
	"extraPicturesCount" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"totalAmount" numeric(12, 2) NOT NULL,
	"paymentPlan" "PaymentPlan" DEFAULT 'FULL' NOT NULL,
	"bookingStatus" "BookingStatus" DEFAULT 'PENDING' NOT NULL,
	"paymentStatus" "PaymentStatus" DEFAULT 'PENDING' NOT NULL,
	"deliveryStatus" "DeliveryStatus" DEFAULT 'PENDING' NOT NULL,
	"serviceId" text NOT NULL,
	"studioId" text NOT NULL,
	"clientId" text NOT NULL,
	"createdBy" text NOT NULL,
	"memberId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"serviceVariantId" text,
	"accessCode" text,
	"deliveredAt" timestamp(3),
	"pendingTotalAmount" numeric(12, 2),
	"priceApprovalStatus" "PriceApprovalStatus" DEFAULT 'APPROVED' NOT NULL,
	"priceApprovedAt" timestamp(3),
	"priceApprovedBy" text,
	"priceChangedBy" text
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp(3),
	"refreshTokenExpiresAt" timestamp(3),
	"scope" text,
	"password" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_variant" (
	"id" text PRIMARY KEY NOT NULL,
	"serviceId" text NOT NULL,
	"locationType" "LocationType" NOT NULL,
	"basePrice" numeric(12, 2) NOT NULL,
	"maxPrice" numeric(12, 2),
	"sessionDurationMins" integer NOT NULL,
	"logisticsIncluded" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"title" text
);
--> statement-breakpoint
CREATE TABLE "studio" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "organizationRole" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"studioId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"studioId" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"inviterId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"features" text[],
	"isAddon" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"category" "ServiceCategoryType" DEFAULT 'OTHERS' NOT NULL,
	"studioId" text NOT NULL,
	"studioSessionId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"phoneNumber" text,
	"phoneNumberVerified" boolean
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" text PRIMARY KEY NOT NULL,
	"studioId" text NOT NULL,
	"name" text NOT NULL,
	"level" "CourseLevel" NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"durationWeeks" integer NOT NULL,
	"isNegotiable" boolean DEFAULT false NOT NULL,
	"hasCertificate" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_module" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"title" text NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment" (
	"id" text PRIMARY KEY NOT NULL,
	"studioId" text NOT NULL,
	"courseId" text NOT NULL,
	"clientId" text NOT NULL,
	"startDate" timestamp(3) NOT NULL,
	"endDate" timestamp(3),
	"status" "EnrollmentStatus" DEFAULT 'PENDING' NOT NULL,
	"paymentStatus" "PaymentStatus" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"altPhone" text,
	"email" text,
	"address" text,
	"image" text,
	"notes" text,
	"type" text NOT NULL,
	"birthDate" timestamp(3),
	"weddingDate" timestamp(3),
	"studioId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_intent" (
	"id" text PRIMARY KEY NOT NULL,
	"studioId" text NOT NULL,
	"clientName" text NOT NULL,
	"clientEmail" text,
	"clientPhone" text,
	"existingClientId" text,
	"serviceId" text NOT NULL,
	"serviceVariantId" text,
	"addonIds" text[],
	"sessionCount" integer NOT NULL,
	"extraPicturesCount" integer DEFAULT 0 NOT NULL,
	"bookingDate" timestamp(3) NOT NULL,
	"notes" text,
	"paystackReference" text NOT NULL,
	"totalAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paymentPlan" "PaymentPlan" DEFAULT 'FULL' NOT NULL,
	"status" "BookingIntentStatus" DEFAULT 'PENDING' NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"resolvedBookingId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Payment" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text,
	"installmentType" "PaymentInstallmentType",
	"sequence" integer,
	"expectedAmount" numeric(12, 2),
	"amount" numeric(12, 2) NOT NULL,
	"method" "PaymentMethod" DEFAULT 'CASH' NOT NULL,
	"status" "PaymentStatus" DEFAULT 'PENDING' NOT NULL,
	"paystackReference" text,
	"paystackResponse" jsonb,
	"receiptNumber" text NOT NULL,
	"receiptUrl" text,
	"recordedById" text,
	"paymentDate" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Photo" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"r2Key" text NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"mimeType" text NOT NULL,
	"thumbnailKey" text,
	"uploadedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"downloaded" boolean DEFAULT false NOT NULL,
	"downloadedAt" timestamp(3),
	"downloadCount" integer DEFAULT 0 NOT NULL,
	"approvalStatus" "PhotoApprovalStatus" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"rejectionReason" text,
	"approvedAt" timestamp(3),
	"approvedById" text,
	"uploadedById" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"clientPhone" text NOT NULL,
	"clientEmail" text,
	"clientName" text NOT NULL,
	"type" "NotificationType" NOT NULL,
	"message" text NOT NULL,
	"channel" "NotificationChannel""[],
	"status" "NotificationStatus" DEFAULT 'PENDING' NOT NULL,
	"sentAt" timestamp(3),
	"deliveredAt" timestamp(3),
	"errorMessage" text,
	"bookingId" text,
	"providerId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_deliverable" (
	"id" text PRIMARY KEY NOT NULL,
	"variantId" text NOT NULL,
	"label" text NOT NULL,
	"quantity" integer,
	"detail" text,
	"isFree" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_access" (
	"id" text PRIMARY KEY NOT NULL,
	"productId" text NOT NULL,
	"buyerId" text NOT NULL,
	"paymentId" text,
	"downloadCount" integer DEFAULT 0 NOT NULL,
	"lastDownloadAt" timestamp(3),
	"expiresAt" timestamp(3),
	"grantedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision_request" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"description" text NOT NULL,
	"status" "RevisionStatus" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_course" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price" numeric(65, 30) NOT NULL,
	"duration" text,
	"location" text,
	"isPublished" boolean DEFAULT false NOT NULL,
	"thumbnail" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_item" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"category" text DEFAULT 'General' NOT NULL,
	"r2Key" text NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"mimeType" text NOT NULL,
	"thumbnailKey" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isPublished" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"name" text NOT NULL,
	"startDate" timestamp(3) NOT NULL,
	"endDate" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_module" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_student" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"batchId" text NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"amountPaid" numeric(65, 30) NOT NULL,
	"paymentPlan" text DEFAULT 'FULL' NOT NULL,
	"howDidYouHear" text DEFAULT '' NOT NULL,
	"paymentReference" text,
	"paymentStatus" text DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"salePrice" numeric(12, 2),
	"categoryId" text,
	"r2Key" text,
	"fileName" text,
	"fileSize" integer,
	"mimeType" text,
	"thumbnailKey" text,
	"isPublished" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyer" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"activeOrganizationId" text
);
--> statement-breakpoint
CREATE TABLE "studioSession" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"duration" integer DEFAULT 45 NOT NULL,
	"studioId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyer_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"buyerId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_BookingAddons" (
	"A" text NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_BookingAddons_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_serviceVariantId_fkey" FOREIGN KEY ("serviceVariantId") REFERENCES "public"."service_variant"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_variant" ADD CONSTRAINT "service_variant_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizationRole" ADD CONSTRAINT "organizationRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service" ADD CONSTRAINT "service_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service" ADD CONSTRAINT "service_studioSessionId_fkey" FOREIGN KEY ("studioSessionId") REFERENCES "public"."studioSession"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_module" ADD CONSTRAINT "course_module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking_intent" ADD CONSTRAINT "booking_intent_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_deliverable" ADD CONSTRAINT "service_deliverable_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."service_variant"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_access" ADD CONSTRAINT "product_access_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."buyer"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_access" ADD CONSTRAINT "product_access_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_access" ADD CONSTRAINT "product_access_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revision_request" ADD CONSTRAINT "revision_request_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "academy_batch" ADD CONSTRAINT "academy_batch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."academy_course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "academy_module" ADD CONSTRAINT "academy_module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."academy_course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "academy_student" ADD CONSTRAINT "academy_student_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."academy_batch"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "academy_student" ADD CONSTRAINT "academy_student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."academy_course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."product_category"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "studioSession" ADD CONSTRAINT "studioSession_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "buyer_access_token" ADD CONSTRAINT "buyer_access_token_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."buyer"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_BookingAddons" ADD CONSTRAINT "_BookingAddons_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_BookingAddons" ADD CONSTRAINT "_BookingAddons_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "user_notification_isRead_idx" ON "user_notification" USING btree ("isRead" bool_ops);--> statement-breakpoint
CREATE INDEX "user_notification_userId_idx" ON "user_notification" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "booking_accessCode_idx" ON "booking" USING btree ("accessCode" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "booking_accessCode_key" ON "booking" USING btree ("accessCode" text_ops);--> statement-breakpoint
CREATE INDEX "booking_clientId_idx" ON "booking" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "booking_studioId_idx" ON "booking" USING btree ("studioId" text_ops);--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "service_variant_serviceId_idx" ON "service_variant" USING btree ("serviceId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "studio_slug_key" ON "studio" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "organizationRole_organizationId_idx" ON "organizationRole" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "organizationRole_organizationId_role_key" ON "organizationRole" USING btree ("organizationId" text_ops,"role" text_ops);--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier" text_ops);--> statement-breakpoint
CREATE INDEX "member_studioId_idx" ON "member" USING btree ("studioId" text_ops);--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "invitation_studioId_idx" ON "invitation" USING btree ("studioId" text_ops);--> statement-breakpoint
CREATE INDEX "service_studioId_idx" ON "service" USING btree ("studioId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_key" ON "user" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_phoneNumber_key" ON "user" USING btree ("phoneNumber" text_ops);--> statement-breakpoint
CREATE INDEX "course_studioId_idx" ON "course" USING btree ("studioId" text_ops);--> statement-breakpoint
CREATE INDEX "course_module_courseId_idx" ON "course_module" USING btree ("courseId" text_ops);--> statement-breakpoint
CREATE INDEX "enrollment_clientId_idx" ON "enrollment" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "enrollment_courseId_idx" ON "enrollment" USING btree ("courseId" text_ops);--> statement-breakpoint
CREATE INDEX "enrollment_studioId_idx" ON "enrollment" USING btree ("studioId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "client_studioId_email_key" ON "client" USING btree ("studioId" text_ops,"email" text_ops);--> statement-breakpoint
CREATE INDEX "client_studioId_idx" ON "client" USING btree ("studioId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "client_studioId_phone_key" ON "client" USING btree ("studioId" text_ops,"phone" text_ops);--> statement-breakpoint
CREATE INDEX "booking_intent_paystackReference_idx" ON "booking_intent" USING btree ("paystackReference" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "booking_intent_paystackReference_key" ON "booking_intent" USING btree ("paystackReference" text_ops);--> statement-breakpoint
CREATE INDEX "booking_intent_status_idx" ON "booking_intent" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "Payment_bookingId_idx" ON "Payment" USING btree ("bookingId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Payment_bookingId_sequence_key" ON "Payment" USING btree ("bookingId" text_ops,"sequence" text_ops);--> statement-breakpoint
CREATE INDEX "Payment_paymentDate_idx" ON "Payment" USING btree ("paymentDate" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Payment_paystackReference_key" ON "Payment" USING btree ("paystackReference" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment" USING btree ("receiptNumber" text_ops);--> statement-breakpoint
CREATE INDEX "Payment_status_idx" ON "Payment" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "Photo_approvalStatus_idx" ON "Photo" USING btree ("approvalStatus" enum_ops);--> statement-breakpoint
CREATE INDEX "Photo_bookingId_idx" ON "Photo" USING btree ("bookingId" text_ops);--> statement-breakpoint
CREATE INDEX "Photo_expiresAt_idx" ON "Photo" USING btree ("expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Notification_bookingId_idx" ON "Notification" USING btree ("bookingId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Notification_providerId_key" ON "Notification" USING btree ("providerId" text_ops);--> statement-breakpoint
CREATE INDEX "Notification_sentAt_idx" ON "Notification" USING btree ("sentAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Notification_status_idx" ON "Notification" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "product_category_name_key" ON "product_category" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "product_category_slug_key" ON "product_category" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "service_deliverable_variantId_idx" ON "service_deliverable" USING btree ("variantId" text_ops);--> statement-breakpoint
CREATE INDEX "product_access_buyerId_idx" ON "product_access" USING btree ("buyerId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "product_access_paymentId_key" ON "product_access" USING btree ("paymentId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "product_access_productId_buyerId_key" ON "product_access" USING btree ("productId" text_ops,"buyerId" text_ops);--> statement-breakpoint
CREATE INDEX "product_access_productId_idx" ON "product_access" USING btree ("productId" text_ops);--> statement-breakpoint
CREATE INDEX "revision_request_bookingId_idx" ON "revision_request" USING btree ("bookingId" text_ops);--> statement-breakpoint
CREATE INDEX "portfolio_item_category_idx" ON "portfolio_item" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "portfolio_item_sortOrder_idx" ON "portfolio_item" USING btree ("sortOrder" int4_ops);--> statement-breakpoint
CREATE INDEX "academy_batch_courseId_idx" ON "academy_batch" USING btree ("courseId" text_ops);--> statement-breakpoint
CREATE INDEX "academy_module_courseId_idx" ON "academy_module" USING btree ("courseId" text_ops);--> statement-breakpoint
CREATE INDEX "academy_student_batchId_idx" ON "academy_student" USING btree ("batchId" text_ops);--> statement-breakpoint
CREATE INDEX "academy_student_courseId_idx" ON "academy_student" USING btree ("courseId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "academy_student_paymentReference_key" ON "academy_student" USING btree ("paymentReference" text_ops);--> statement-breakpoint
CREATE INDEX "product_categoryId_idx" ON "product" USING btree ("categoryId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "buyer_email_key" ON "buyer" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "buyer_phone_key" ON "buyer" USING btree ("phone" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_key" ON "session" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "studioSession_studioId_idx" ON "studioSession" USING btree ("studioId" text_ops);--> statement-breakpoint
CREATE INDEX "buyer_access_token_buyerId_idx" ON "buyer_access_token" USING btree ("buyerId" text_ops);--> statement-breakpoint
CREATE INDEX "buyer_access_token_token_idx" ON "buyer_access_token" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "buyer_access_token_token_key" ON "buyer_access_token" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "_BookingAddons_B_index" ON "_BookingAddons" USING btree ("B" text_ops);
*/