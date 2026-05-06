import { db } from '#/db/prisma.ts'
import { Collection } from 'discord.js'
import { Player } from '#/classes/player.ts'
import { MinecraftRole } from '#/classes/minecraft-role.ts'
import { playersService } from '#/services/players.service.ts'
import { PLAYER_STATUS } from '#/db/generated/enums.ts'

export class MinecraftRolesManager {
    async fetch() {
        const roles = await db.role.findMany({
            include: {
                linked_roles: {
                    include: {
                        player: true,
                    },
                },
            },
        })
        const members = playersService.players.cache
        for (const r of roles) {
            this.#cache.set(
                r.id,
                new MinecraftRole({
                    id: r.id,
                    name: r.name,
                    players: new Collection(
                        r.linked_roles
                            .filter(
                                l => l.player.status === PLAYER_STATUS.ACTIVE,
                            )
                            .map(l => {
                                return [
                                    l.mc_user_uuid,
                                    members.getOrInsertComputed(
                                        l.mc_user_uuid,
                                        () => {
                                            return new Player({
                                                discord_user_id:
                                                    l.player.discord_user_id,
                                                nickname: l.player.nickname,
                                                uuid: l.mc_user_uuid,
                                                rank: l.player.rank,
                                            })
                                        },
                                    ),
                                ]
                            }),
                    ),
                }),
            )
        }
        return this.#cache
    }

    #cache = new Collection<string, MinecraftRole>()

    get cache() {
        return this.#cache
    }

    async create(name: string) {
        const role = new MinecraftRole(
            await db.role.create({
                data: { name },
            }),
        )
        this.#cache.set(role.id, role)
        return role
    }

    async delete(id: string) {
        await db.role.delete({
            where: { id },
        })
        this.#cache.delete(id)
    }
}
