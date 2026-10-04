-- AlterTable: display name and avatar seed for profiles (D-034). Off-chain only.
ALTER TABLE "profiles" ADD COLUMN "display_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "profiles" ADD COLUMN "avatar_seed" TEXT;
