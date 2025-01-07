/*
  Warnings:

  - You are about to drop the column `filename` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentId` on the `Message` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[messageId]` on the table `File` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `messageId` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_attachmentId_fkey";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "filename",
ADD COLUMN     "messageId" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "attachmentId";

-- CreateIndex
CREATE UNIQUE INDEX "File_messageId_key" ON "File"("messageId");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
