/*
  Warnings:

  - You are about to drop the column `lastReadUser1` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `lastReadUser2` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `user1Id` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `user2Id` on the `Conversation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_user1Id_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_user2Id_fkey";

-- DropIndex
DROP INDEX "Conversation_user1Id_user2Id_key";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "lastReadUser1",
DROP COLUMN "lastReadUser2",
DROP COLUMN "user1Id",
DROP COLUMN "user2Id";

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "lastRead" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_userId_conversationId_key" ON "ConversationParticipant"("userId", "conversationId");

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
