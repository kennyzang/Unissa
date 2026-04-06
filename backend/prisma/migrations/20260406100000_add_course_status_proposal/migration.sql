-- AlterTable: add status and proposedByStaffId to courses
ALTER TABLE "courses" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published';
ALTER TABLE "courses" ADD COLUMN "proposedByStaffId" TEXT;
