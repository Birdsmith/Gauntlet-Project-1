-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "replyToId" TEXT;

-- CreateIndex
CREATE INDEX "DirectMessage_replyToId_idx" ON "DirectMessage"("replyToId");

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
