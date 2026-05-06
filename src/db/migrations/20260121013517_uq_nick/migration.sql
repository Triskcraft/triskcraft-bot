/*
  Warnings:

  - A unique constraint covering the columns `[nickname]` on the table `minecraft_users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "minecraft_users_nickname_key" ON "minecraft_users"("nickname");
