-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "avatarSystemPrompt" TEXT;
