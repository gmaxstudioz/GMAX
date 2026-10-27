CREATE TABLE "cashout" (
    "id" text PRIMARY KEY NOT NULL,
    "studioId" text NOT NULL,
    "description" text NOT NULL,
    "category" text NOT NULL,
    "amount" numeric(12, 2) NOT NULL,
    "expenseDate" timestamp(3) NOT NULL,
    "notes" text,
    "recordedById" text,
    "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "cashout_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cashout_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "cashout_studioId_idx" ON "cashout"("studioId");
CREATE INDEX "cashout_expenseDate_idx" ON "cashout"("expenseDate");
