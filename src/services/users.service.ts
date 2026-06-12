import { logger } from '#/logger.ts'
import { client } from '#/client.ts'
import { Events } from 'discord.js'
import { db } from '#/db/prisma.ts'

/**
 * Servicio para el manejo de jugadores en el gremio.
 * majena la información de los jugadores y escucha el evento de baneos para removerlos.
 */
class UsersService {
    start() {
        logger.info('[USERS SERVICE] Inicializando...')
        this.#installEventListener()
    }

    /**
     * Instala el event listener.
     */
    #installEventListener() {
        client.on(Events.GuildMemberAdd, async member => {
            try {
                await db.user.upsert({
                    where: { discord_user_id: member.id },
                    create: {
                        discord_user: {
                            connectOrCreate: {
                                create: {
                                    id: member.id,
                                    username: member.user.username,
                                },
                                where: {
                                    id: member.id,
                                },
                            },
                        },
                    },
                    update: {
                        discord_user: {
                            connectOrCreate: {
                                create: {
                                    id: member.id,
                                    username: member.user.username,
                                },
                                where: {
                                    id: member.id,
                                },
                            },
                        },
                    },
                })
            } catch (error) {
                logger.error(error, '[USERS SERVICE] Error al crear un usuario')
            }
        })
    }
}

const usersService = new UsersService()

export { usersService }
