-- CreateTable
CREATE TABLE "webhook_tokens" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "discord_user_id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "permissions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_tokens_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "webhook_tokens" ADD CONSTRAINT "webhook_tokens_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
