-- ! Migration customized for snowflake
-- ! This migration is not compatible with the default migration
-- ! You need to run this migration first

--Fecha base: 01 /06 / 2025
CREATE OR REPLACE FUNCTION snowflake(node_id int DEFAULT 0)
RETURNS text AS $$
DECLARE
    our_epoch bigint:= 1748736000000; --milisegundos desde 01 /06 / 2025
    seq_id bigint;
    now_millis bigint;
    safe_node_id int;
    snowflake_id bigint;
BEGIN
--Asegurar que node_id esté entre 0 y 1023(10 bits)
safe_node_id:= GREATEST(0, LEAST(node_id, 1023));

--Usar la secuencia para obtener un número siempre único
    SELECT nextval('snowflake_seq') % 4096 INTO seq_id; --12 bits
    SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000) INTO now_millis;

snowflake_id:= ((now_millis - our_epoch) << 22)-- timestamp(41 bits)
    | ((safe_node_id & 1023) << 12)-- node id(10 bits)
        | (seq_id & 4095); --secuencia(12 bits)

    RETURN snowflake_id:: text; --Convertir a string
END;
$$ LANGUAGE plpgsql;

--Crear secuencia si no existe
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname = 'snowflake_seq') THEN
        CREATE SEQUENCE snowflake_seq;
    END IF;
END$$;

-- ! Prisma generation

-- CreateTable
CREATE TABLE "inactivity_periods" (
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "role_snapshot" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "inactivity_periods_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "tracked_roles" (
    "guild_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_roles_pkey" PRIMARY KEY ("guild_id","role_id")
);

-- CreateTable
CREATE TABLE "role_statistics" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "guild_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "inactive_count" INTEGER NOT NULL DEFAULT 0,
    "active_count" INTEGER NOT NULL DEFAULT 0,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_codes" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "discord_id" TEXT NOT NULL,
    "discord_nickname" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linked_roles" (
    "mc_user_uuid" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "linked_roles_pkey" PRIMARY KEY ("mc_user_uuid","role_id")
);

-- CreateTable
CREATE TABLE "medias" (
    "id" TEXT NOT NULL DEFAULT snowflake(),
    "mc_user_uuid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "medias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minecraft_users" (
    "uuid" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "digs" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "discord_user_id" TEXT NOT NULL,

    CONSTRAINT "minecraft_users_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "discord_users" (
    "id" TEXT NOT NULL,

    CONSTRAINT "discord_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "link_codes_discord_id_key" ON "link_codes"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "link_codes_code_key" ON "link_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "medias_mc_user_uuid_type_key" ON "medias"("mc_user_uuid", "type");

-- CreateIndex
CREATE UNIQUE INDEX "minecraft_users_discord_user_id_key" ON "minecraft_users"("discord_user_id");

-- AddForeignKey
ALTER TABLE "inactivity_periods" ADD CONSTRAINT "inactivity_periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "discord_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linked_roles" ADD CONSTRAINT "linked_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linked_roles" ADD CONSTRAINT "linked_roles_mc_user_uuid_fkey" FOREIGN KEY ("mc_user_uuid") REFERENCES "minecraft_users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medias" ADD CONSTRAINT "medias_mc_user_uuid_fkey" FOREIGN KEY ("mc_user_uuid") REFERENCES "minecraft_users"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minecraft_users" ADD CONSTRAINT "minecraft_users_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
