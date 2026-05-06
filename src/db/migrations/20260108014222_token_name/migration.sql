/*
  Warnings:

  - Added the required column `name` to the `webhook_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "webhook_tokens" ADD COLUMN     "name" TEXT NOT NULL;
