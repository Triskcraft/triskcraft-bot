/*
  Warnings:

  - You are about to drop the column `attachments` on the `post_blocks` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cover_media_id]` on the table `posts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "POST_BLOCK_MEDIA_TYPE" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'FILE');

-- AlterTable
ALTER TABLE "post_blocks" DROP COLUMN "attachments";

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "cover_media_id" TEXT;

-- CreateTable
CREATE TABLE "post_media" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content_type" TEXT,
    "media_type" "POST_BLOCK_MEDIA_TYPE" NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "description" TEXT,
    "hash" TEXT,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_block_media" (
    "post_block_message_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_block_media_pkey" PRIMARY KEY ("post_block_message_id","media_id","position")
);

-- CreateIndex
CREATE INDEX "post_media_hash_idx" ON "post_media"("hash");

-- CreateIndex
CREATE INDEX "post_media_media_type_idx" ON "post_media"("media_type");

-- CreateIndex
CREATE INDEX "post_block_media_media_id_idx" ON "post_block_media"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "posts_cover_media_id_key" ON "posts"("cover_media_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "post_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_block_media" ADD CONSTRAINT "post_block_media_post_block_message_id_fkey" FOREIGN KEY ("post_block_message_id") REFERENCES "post_blocks"("message_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_block_media" ADD CONSTRAINT "post_block_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "post_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
