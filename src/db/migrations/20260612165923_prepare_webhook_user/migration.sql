-- AlterTable
ALTER TABLE "webhook_tokens" ADD COLUMN "user_id" TEXT;

-- Create missing application users before moving existing relations.
INSERT INTO "users" ("discord_user_id", "created_at", "updated_at")
SELECT "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "discord_users"
ON CONFLICT ("discord_user_id") DO NOTHING;

-- Link application users to their existing Minecraft players.
UPDATE "users" AS "user"
SET
    "mc_player_uuid" = "player"."uuid",
    "updated_at" = CURRENT_TIMESTAMP
FROM "minecraft_users" AS "player"
WHERE
    "user"."discord_user_id" = "player"."discord_user_id"
    AND "user"."mc_player_uuid" IS DISTINCT FROM "player"."uuid";

-- Move post ownership to application users.
UPDATE "posts" AS "post"
SET "user_id" = "user"."id"
FROM "users" AS "user"
WHERE "user"."discord_user_id" = "post"."discord_user_id";

-- Associate existing webhook tokens with their application users.
UPDATE "webhook_tokens" AS "token"
SET "user_id" = "user"."id"
FROM "users" AS "user"
WHERE "user"."discord_user_id" = "token"."discord_user_id";

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

-- AddForeignKey
ALTER TABLE "webhook_tokens" ADD CONSTRAINT "webhook_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
