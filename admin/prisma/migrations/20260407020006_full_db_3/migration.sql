/*
  Warnings:

  - The `phone` column on the `client` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "client" DROP COLUMN "phone",
ADD COLUMN     "phone" TEXT[];

-- CreateTable
CREATE TABLE "table" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_phone_key" ON "client"("phone");

-- AddForeignKey
ALTER TABLE "table" ADD CONSTRAINT "table_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
