/*
  Warnings:

  - You are about to drop the column `fileId` on the `Message` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[messageId]` on the table `File` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `messageId` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_fileId_fkey";

-- DropIndex
DROP INDEX "Message_fileId_key";

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "messageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "fileId";

-- CreateIndex
CREATE UNIQUE INDEX "File_messageId_key" ON "File"("messageId");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
