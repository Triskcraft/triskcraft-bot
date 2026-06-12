/*
  Warnings:

  - You are about to drop the column `discord_user_id` on the `webhook_tokens` table. All the data in the column will be lost.
  - Made the column `user_id` on table `webhook_tokens` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "webhook_tokens" DROP CONSTRAINT "webhook_tokens_discord_user_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_tokens" DROP CONSTRAINT "webhook_tokens_user_id_fkey";

-- AlterTable
ALTER TABLE "webhook_tokens" DROP COLUMN "discord_user_id",
ALTER COLUMN "user_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "webhook_tokens" ADD CONSTRAINT "webhook_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
