/*
  Warnings:

  - You are about to drop the column `messageId` on the `File` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fileId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_messageId_fkey";

-- DropIndex
DROP INDEX "File_messageId_key";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "messageId";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "fileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_fileId_key" ON "Message"("fileId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
