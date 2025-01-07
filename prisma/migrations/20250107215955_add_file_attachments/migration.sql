/*
  Warnings:

  - You are about to drop the column `messageId` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `File` table. All the data in the column will be lost.
  - Added the required column `filename` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_messageId_fkey";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "messageId",
DROP COLUMN "name",
ADD COLUMN     "filename" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
