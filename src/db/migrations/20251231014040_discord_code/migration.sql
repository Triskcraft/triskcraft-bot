-- AddForeignKey
ALTER TABLE "link_codes" ADD CONSTRAINT "link_codes_discord_id_fkey" FOREIGN KEY ("discord_id") REFERENCES "discord_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
