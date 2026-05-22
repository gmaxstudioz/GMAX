-- Migration: add-user-role-and-portfolio
-- Run this in the Supabase SQL Editor

-- 1. Add role column to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';

-- 2. Create portfolio_item table
CREATE TABLE IF NOT EXISTS "portfolio_item" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "r2Key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "portfolio_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "portfolio_item_category_idx" ON "portfolio_item"("category");
CREATE INDEX IF NOT EXISTS "portfolio_item_sortOrder_idx" ON "portfolio_item"("sortOrder");

-- 3. Set yourself as admin (replace YOUR_USER_ID with your actual user ID from the user table)
-- UPDATE "user" SET "role" = 'admin' WHERE "email" = 'your-email@example.com';
