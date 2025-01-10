-- DropForeignKey
ALTER TABLE "DirectMessage" DROP CONSTRAINT "DirectMessage_replyToId_fkey";

-- DropIndex
DROP INDEX "DirectMessage_createdAt_idx";

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
