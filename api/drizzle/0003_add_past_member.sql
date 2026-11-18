CREATE TABLE IF NOT EXISTS "past_member" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"studioId" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phoneNumber" text,
	"image" text,
	"role" text NOT NULL,
	"joinedAt" timestamp(3) NOT NULL,
	"leftAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"removedById" text,
	"removedByName" text,
	"reason" text DEFAULT 'REMOVED_FROM_STUDIO' NOT NULL,
	"totalBookings" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "past_member" ADD CONSTRAINT "past_member_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "past_member_studioId_idx" ON "past_member" USING btree ("studioId" text_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "past_member_userId_idx" ON "past_member" USING btree ("userId" text_ops);
