/*
  Warnings:

  - You are about to drop the column `discord_user_id` on the `minecraft_users` table. All the data in the column will be lost.
  - You are about to drop the column `discord_user_id` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `minecraft_player_uuid` on the `posts` table. All the data in the column will be lost.
  - Made the column `user_id` on table `posts` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "minecraft_users" DROP CONSTRAINT "minecraft_users_discord_user_id_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_discord_user_id_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_minecraft_player_uuid_fkey";

-- DropIndex
DROP INDEX "minecraft_users_discord_user_id_key";

-- AlterTable
ALTER TABLE "minecraft_users" DROP COLUMN "discord_user_id";

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "discord_user_id",
DROP COLUMN "minecraft_player_uuid",
ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "webhook_tokens" ADD COLUMN     "user_id" TEXT;

-- AddForeignKey
ALTER TABLE "webhook_tokens" ADD CONSTRAINT "webhook_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
