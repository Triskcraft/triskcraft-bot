/*
  Warnings:

  - You are about to drop the column `rank` on the `minecraft_users` table. All the data in the column will be lost.
  - You are about to drop the column `rank` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "minecraft_users" DROP COLUMN "rank";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "rank";

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "name" TEXT NOT NULL,
    "permissions" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linked_user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "linked_user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_name_key" ON "user_roles"("name");

-- AddForeignKey
ALTER TABLE "linked_user_roles" ADD CONSTRAINT "linked_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linked_user_roles" ADD CONSTRAINT "linked_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "user_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
