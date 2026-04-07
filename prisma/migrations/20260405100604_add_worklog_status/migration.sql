-- CreateEnum
CREATE TYPE "WorkLogStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- AlterTable
ALTER TABLE "WorkLog" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "WorkLogStatus" NOT NULL DEFAULT 'ACTIVE';
