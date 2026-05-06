/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `webhook_tokens` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "webhook_tokens_name_key" ON "webhook_tokens"("name");
