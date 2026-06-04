/*
  Warnings:

  - Added the required column `scope` to the `authorization_codes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "authorization_codes" ADD COLUMN     "scope" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "scopes" TEXT[];
