CREATE TABLE "booking_backfill_access" (
	"id" text PRIMARY KEY NOT NULL,
	"studioId" text NOT NULL,
	"userId" text NOT NULL,
	"grantedById" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_backfill_access" ADD CONSTRAINT "booking_backfill_access_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking_backfill_access" ADD CONSTRAINT "booking_backfill_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking_backfill_access" ADD CONSTRAINT "booking_backfill_access_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_backfill_access_studio_user_key" ON "booking_backfill_access" USING btree ("studioId" text_ops,"userId" text_ops);--> statement-breakpoint
CREATE INDEX "booking_backfill_access_userId_expiresAt_idx" ON "booking_backfill_access" USING btree ("userId" text_ops,"expiresAt" timestamp_ops);