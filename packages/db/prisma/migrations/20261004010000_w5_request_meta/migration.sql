-- AlterTable
ALTER TABLE "verification_requests" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "decision_reason" TEXT;
