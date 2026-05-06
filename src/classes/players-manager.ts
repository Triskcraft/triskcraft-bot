import { db } from '#/db/prisma.ts'
import { Collection } from 'discord.js'
import { Player } from '#/classes/player.ts'
import { PLAYER_STATUS } from '#/db/generated/enums.ts'
import { roleService } from '#/services/roles.service.ts'

type UUID = string

export class PlayersManager {
    async fetch(): Promise<Collection<UUID, Player>>
    async fetch(
        uuid: UUID,
        options?: { cache?: boolean },
    ): Promise<Player | null>
    async fetch(
        uuid?: UUID,
        options?: { cache?: boolean },
    ): Promise<Collection<UUID, Player> | Player | null> {
        if (!uuid) {
            const members = await db.player.findMany({
                where: { status: PLAYER_STATUS.ACTIVE },
                select: {
                    uuid: true,
                    nickname: true,
                    discord_user_id: true,
                    rank: true,
                },
            })
            for (const m of members) {
                this.#cache.set(
                    m.uuid,
                    new Player({
                        discord_user_id: m.discord_user_id,
                        nickname: m.nickname,
                        uuid: m.uuid,
                        rank: m.rank,
                    }),
                )
            }
            return this.#cache
        } else {
            let member: Player | null = null
            if (options?.cache) {
                member = this.#cache.get(uuid) ?? null
            }
            if (member) return member
            const memberData = await db.player.findFirst({
                where: { status: PLAYER_STATUS.ACTIVE, uuid },
                select: {
                    uuid: true,
                    nickname: true,
                    discord_user_id: true,
                    rank: true,
                },
            })
            if (memberData) {
                member = new Player({
                    discord_user_id: memberData.discord_user_id,
                    nickname: memberData.nickname,
                    uuid: memberData.uuid,
                    rank: memberData.rank,
                })
                this.#cache.set(member.uuid, member)
            }
            return member
        }
    }

    #cache = new Collection<UUID, Player>()

    get cache() {
        return this.#cache
    }

    async delete(uuid: UUID) {
        await db.player.update({
            where: { uuid },
            data: { status: PLAYER_STATUS.DELETED },
        })
        for (const [, role] of roleService.roles.cache.filter(r =>
            r.players.has(uuid),
        )) {
            await role.removePlayer(uuid)
        }
        this.#cache.delete(uuid)
    }
}
