-- CreateTable
DROP TABLE IF EXISTS "states";
CREATE TABLE "states" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "states_key_key" ON "states"("key");
