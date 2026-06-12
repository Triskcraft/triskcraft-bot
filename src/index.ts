import '#/utils/polifill.ts'
import { app } from '#/api/server.ts'
import { client } from '#/client.ts'
import { envs } from '#/config.ts'
import { logger } from '#/logger.ts'
import { db } from '#/db/prisma.ts'
import { inactivityService } from '#/services/inactivity.service.ts'
import { interactionService } from '#/services/interactions.service.ts'
import { deployWebhookPanel } from '#/services/webhook.service.ts'
import {
    initializeRankService,
    unregisterRankService,
} from '#/services/rank.service.ts'
import { monitoredService } from '#/services/monitored.service.ts'
import { Scheduler } from '#/services/scheduler.ts'
import { mcRoleService } from '#/services/mcroles.service.ts'
import { blogService } from '#/services/blog.service.ts'
import { welcomeService } from './services/welcome.service.ts'
import { usersService } from './services/users.service.ts'

/**
 * Maneja el apagado ordenado del proceso, garantizando que cada componente
 * libere sus recursos antes de finalizar.
 */
async function shutdown(signal: string) {
    logger.info({ signal }, 'Cerrando bot')
    scheduler.stop()
    unregisterRankService()
    welcomeService.stop()
    await client.destroy()
    await db.$disconnect()
    process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

async function migrateDiscordUsers() {
    const discordUsers = await db.discordUser.findMany({
        select: {
            id: true,
            player: {
                select: {
                    uuid: true,
                },
            },
            user: {
                select: {
                    mc_player_uuid: true,
                },
            },
        },
    })

    let createdUsers = 0
    let linkedPlayers = 0

    for (const discordUser of discordUsers) {
        const playerUuid = discordUser.player?.uuid

        await db.user.upsert({
            where: {
                discord_user_id: discordUser.id,
            },
            create: {
                discord_user_id: discordUser.id,
                ...(playerUuid ? { mc_player_uuid: playerUuid } : {}),
            },
            update:
                playerUuid && discordUser.user?.mc_player_uuid !== playerUuid ?
                    {
                        mc_player_uuid: playerUuid,
                    }
                :   {},
        })

        if (!discordUser.user) {
            createdUsers++
        }
        if (playerUuid && discordUser.user?.mc_player_uuid !== playerUuid) {
            linkedPlayers++
        }
    }

    logger.info(
        {
            createdUsers,
            linkedPlayers,
            processedDiscordUsers: discordUsers.length,
        },
        'Migración de usuarios completada',
    )
}

/**
 * Punto de entrada principal del bot. Aquí se inicializan los servicios
 * compartidos (API HTTP, cliente de Discord, acceso a base de datos y
 * planificador) y se orquestan las tareas de arranque y apagado seguro.
 */
app.listen(envs.API_PORT, async () => {
    logger.info(`api listening on port ${envs.API_PORT}`)
})

/**
 * Los servicios principales se comparten en todo el proyecto para permitir
 * coordinación entre las interacciones de Discord y la API HTTP.
 */
const scheduler = new Scheduler(inactivityService, monitoredService)
await migrateDiscordUsers()
await interactionService.registerInteractionHandlers()

if (envs.DEPLOY_INACTIVITY_PANEL) {
    // Despliega (o actualiza) el panel de botones en el canal configurado.
    await inactivityService.deployInactivityPanel()
} else {
    logger.info('Saltando el despliegue del panel de inactividad')
}
await deployWebhookPanel()
initializeRankService()
// Activa los jobs programados que mantienen el sistema actualizado.
scheduler.start()
await blogService.start()
await welcomeService.start()
usersService.start()
if (envs.ROLE_SERVICE) {
    await mcRoleService.start()
}

/**
 * El despliegue de comandos solo se ejecuta cuando la variable de entorno
 * correspondiente lo indica, evitando registrar comandos en cada arranque
 * durante entornos de desarrollo.
 */
if (envs.DEPLOY_COMMAND) {
    await interactionService.registerCommands()
} else {
    logger.info('Saltando el despliegue de comandos')
}
