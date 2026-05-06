import { formatForUser } from '#/utils/time.ts'
import type { InactivityPeriod } from '#/db/generated/client.ts'
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    type GuildMember,
} from 'discord.js'
import { db } from '#/db/prisma.ts'
import { client } from '#/client.ts'
import { logger } from '#/logger.ts'
import { envs } from '#/config.ts'
/**
 * Servicio encargado de persistir y exponer los estados de inactividad.
 */
export class InactivityService {
    /**
     * Marca la inactividad para un usuario.
     */
    async markInactivity(
        guild_id: string,
        member: GuildMember,
        until: Date,
        source: string,
    ) {
        // Se usa upsert para evitar duplicados y conservar el historial más
        // reciente del usuario en la tabla de periodos de inactividad.
        const result = await db.inactivityPeriod.upsert({
            where: {
                user_id: member.id,
            },
            create: {
                discord_user: {
                    connectOrCreate: {
                        create: {
                            id: member.id,
                            username: member.user.username,
                        },
                        where: { id: member.id },
                    },
                },
                guild_id,
                role_snapshot: JSON.stringify(
                    member.roles.cache.map(role => role.id),
                ),
                started_at: new Date(),
                ends_at: until,
                source: source,
                notified: false,
            },
            update: {
                role_snapshot: JSON.stringify(
                    member.roles.cache.map(role => role.id),
                ),
                started_at: new Date(),
                ends_at: until,
                source: source,
                notified: false,
            },
        })
        return result
    }

    /**
     * Elimina la inactividad de un usuario.
     */
    async clearInactivity(user_id: string) {
        await db.inactivityPeriod.delete({
            where: { user_id },
        })
    }

    /**
     * Obtiene la inactividad actual del usuario.
     */
    async getInactivity(user_id: string) {
        const result = await db.inactivityPeriod.findFirst({
            where: { user_id },
        })
        if (!result) return null
        return mapRow(result)
    }

    /**
     * Lista inactividades de un servidor.
     */
    async listInactivities(guild_id: string) {
        const result = await db.inactivityPeriod.findMany({
            where: { guild_id },
            orderBy: { ends_at: 'asc' },
        })
        return result.map(mapRow)
    }

    /**
     * Busca inactividades vencidas sin notificar.
     */
    async getExpired(guild_id: string) {
        const result = await db.inactivityPeriod.findMany({
            where: { guild_id, notified: false, ends_at: { lte: new Date() } },
        })
        return result.map(mapRow)
    }

    /**
     * Construye un texto user-friendly de la inactividad.
     */
    async describe(member: GuildMember) {
        const record = await this.getInactivity(member.id)
        if (!record) {
            return `${member} no tiene inactividad registrada.`
        }

        return `${member} permanecerá inactivo hasta ${formatForUser(record.ends_at)}.`
    }

    async deployInactivityPanel() {
        const channel = await client.channels.fetch(envs.inactivityChannelId)
        if (!channel) {
            return logger.warn('Canal no encontrado')
        }
        if (!channel.isTextBased()) {
            logger.warn('El canal de interacciones no está disponible')
            return
        }

        const existing = await channel.messages.fetch({ limit: 10 })
        const anchor = existing.find(
            message =>
                message.author.id === client.user.id &&
                message.components.length > 0,
        )
        const { embed, components } = buildInactivityPanel()

        if (anchor) {
            await anchor.edit({ embeds: [embed], components })
        } else {
            if (channel.isTextBased() && 'send' in channel) {
                await channel.send({ embeds: [embed], components })
            }
        }

        logger.info('Panel de inactividad desplegado.')
    }
}

/**
 * Adapta el registro de Prisma deserializando el snapshot de roles para
 * devolverlo como estructura utilizable por el resto del código.
 */
function mapRow(row: InactivityPeriod) {
    return {
        ...row,
        role_snapshot: JSON.parse(row.role_snapshot),
    }
}

export const inactivityService = new InactivityService()

/**
 * Crea el embed y botones principales para la auto-gestión.
 */
export function buildInactivityPanel() {
    const embed = new EmbedBuilder()
        .setTitle('Gestión de Inactividad')
        .setDescription(
            'Administra tus periodos de ausencia utilizando los botones de abajo. Todas las respuestas del bot serán efímeras y solo tú podrás verlas.',
        )
        .setColor(0x5865f2)

    // Fila única de botones que abarcan el ciclo completo de autogestión.
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('inactivity:set')
            .setLabel('Marcar inactividad')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('inactivity:edit')
            .setLabel('Modificar inactividad')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('inactivity:clear')
            .setLabel('Desmarcar inactividad')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('inactivity:show')
            .setLabel('Mostrar estado')
            .setStyle(ButtonStyle.Success),
    )

    return { embed, components: [buttons] }
}
