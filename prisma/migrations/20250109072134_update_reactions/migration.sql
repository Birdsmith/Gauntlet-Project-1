/*
  Warnings:

  - A unique constraint covering the columns `[userId,directMessageId,emoji]` on the table `Reaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "DirectMessage_replyToId_idx";

-- AlterTable
ALTER TABLE "Reaction" ADD COLUMN     "directMessageId" TEXT,
ALTER COLUMN "messageId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Reaction_directMessageId_idx" ON "Reaction"("directMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_directMessageId_emoji_key" ON "Reaction"("userId", "directMessageId", "emoji");

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_directMessageId_fkey" FOREIGN KEY ("directMessageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
