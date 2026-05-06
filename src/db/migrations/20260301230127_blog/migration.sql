-- CreateEnum
CREATE TYPE "POST_STATUS" AS ENUM ('DRAFT', 'PUBLISHED', 'OUTDATED');

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "title" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "minecraft_player_uuid" TEXT,
    "thread_id" TEXT NOT NULL,
    "status" "POST_STATUS" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_blocks" (
    "message_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "content" TEXT,
    "components" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "embeds" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "attachments" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "author_id" TEXT NOT NULL,

    CONSTRAINT "post_blocks_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "posts_title_key" ON "posts"("title");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_minecraft_player_uuid_fkey" FOREIGN KEY ("minecraft_player_uuid") REFERENCES "minecraft_users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_blocks" ADD CONSTRAINT "post_blocks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "discord_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_blocks" ADD CONSTRAINT "post_blocks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
