/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `discord_users` will be added. If there are existing duplicate values, this will fail.
  - Made the column `username` on table `discord_users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "discord_users" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "discord_users_username_key" ON "discord_users"("username");
