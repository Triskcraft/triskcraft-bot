import { db } from '#/db/prisma.ts'
import { inspect } from 'node:util'
import { logger } from '#/logger.ts'
import { envs } from '#/config.ts'
import { Player } from '#/classes/player.ts'
import { Collection } from 'discord.js'
import { PrismaClientKnownRequestError } from '#/db/generated/internal/prismaNamespace.ts'
import { PLAYER_STATUS } from '#/db/generated/enums.ts'
import { playersService } from '#/services/players.service.ts'

type UUID = string
export class MinecraftRole {
    #id: string

    get id() {
        return this.#id
    }

    #name: string

    get name() {
        return this.#name
    }

    #players: Collection<UUID, Player>

    get players() {
        return this.#players
    }

    constructor({
        id,
        name,
        players = new Collection(),
    }: {
        id: string
        name: string
        players?: Collection<UUID, Player>
    }) {
        this.#id = id
        this.#name = name
        this.#players = players
    }

    toJSON() {
        return { id: this.#id, name: this.#name, players: this.#players }
    }

    [inspect.custom]() {
        return this.toJSON()
    }

    async editName(name: string) {
        const { linked_roles } = await db.role.update({
            data: { name },
            where: { id: this.#id },
            select: {
                linked_roles: {
                    select: {
                        player: true,
                    },
                },
            },
        })
        logger.info(`[ROLE SERVICE] Rol ${this.#name} renombrado a ${name}`)
        for (const { player } of linked_roles.filter(
            l => l.player.status === PLAYER_STATUS.ACTIVE,
        )) {
            this.#players.getOrInsert(
                player.uuid,
                playersService.players.cache.getOrInsertComputed(
                    player.uuid,
                    () => {
                        return new Player({
                            discord_user_id: player.discord_user_id,
                            nickname: player.nickname,
                            uuid: player.uuid,
                            rank: player.rank,
                        })
                    },
                ),
            )
        }
        if (this.#id === envs.DEFAULT_ROLE_ID) {
            envs.DEFAULT_ROLE_NAME = name
        }
        this.#name = name
        return this
    }

    async removePlayer(uuid: string) {
        try {
            const response = await db.linkedRole.delete({
                where: {
                    mc_user_uuid_role_id: {
                        mc_user_uuid: uuid,
                        role_id: this.#id,
                    },
                },
                select: {
                    player: {
                        select: {
                            nickname: true,
                        },
                    },
                },
            })
            this.#players.delete(uuid)
            logger.info(
                `[ROLE SERVICE] Rol ${this.#name} desvinculado de ${response.player.nickname}`,
            )
        } catch (error) {
            logger.error(error, '[ROLE SERVICE] Error desvinculando un rol')
        }
    }

    async addPlayer(uuid: string) {
        try {
            const {
                player: { nickname },
            } = await db.linkedRole.create({
                data: {
                    role: {
                        connect: {
                            id: this.#id,
                        },
                    },
                    player: {
                        connect: {
                            uuid: uuid,
                        },
                    },
                },
                select: {
                    player: {
                        select: {
                            nickname: true,
                        },
                    },
                },
            })
            const newMember = await playersService.players.fetch(uuid, {
                cache: true,
            })
            if (newMember) {
                this.#players.set(uuid, newMember)
                playersService.players.cache.set(uuid, newMember)
                logger.info(
                    `[ROLE SERVICE] Rol ${this.#name} agregado a ${nickname}`,
                )
            }
        } catch (e) {
            if (
                e instanceof PrismaClientKnownRequestError &&
                e.code === 'P2002'
            ) {
                await this.fetch()
            } else {
                logger.error(
                    e,
                    `[ROLE SERVICE] Error al intentar agregar el rol ${this.#name} a ${uuid}`,
                )
            }
        }
    }

    async fetch() {
        const role = await db.role.findUnique({
            where: { id: this.#id },
            include: {
                linked_roles: {
                    include: {
                        player: true,
                    },
                },
            },
        })
        if (!role) return null
        this.#id = role.id
        this.#name = role.name

        for (const {
            discord_user_id,
            nickname,
            uuid,
            rank,
        } of role.linked_roles
            .map(l => l.player)
            .filter(p => p.status === PLAYER_STATUS.ACTIVE)) {
            this.#players.getOrInsertComputed(uuid, () => {
                return new Player({
                    discord_user_id,
                    nickname,
                    uuid,
                    rank,
                })
            })
        }
    }
}
