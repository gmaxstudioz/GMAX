CREATE TABLE "cashout" (
	"id" text PRIMARY KEY NOT NULL,
	"studioId" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"expenseDate" timestamp(3) NOT NULL,
	"notes" text,
	"recordedById" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cashout" ADD CONSTRAINT "cashout_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cashout" ADD CONSTRAINT "cashout_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "cashout_studioId_idx" ON "cashout" USING btree ("studioId" text_ops);--> statement-breakpoint
CREATE INDEX "cashout_expenseDate_idx" ON "cashout" USING btree ("expenseDate" timestamp_ops);