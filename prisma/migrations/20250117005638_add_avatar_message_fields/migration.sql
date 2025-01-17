-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "avatarName" TEXT,
ADD COLUMN     "isAvatarMessage" BOOLEAN NOT NULL DEFAULT false;
