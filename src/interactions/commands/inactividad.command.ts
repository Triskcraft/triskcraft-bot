import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionsBitField,
    Role,
    type CommandInteraction,
    SlashCommandBuilder,
    PermissionFlagsBits,
    type ApplicationCommandDataResolvable,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
} from 'discord.js'
import { logger } from '#/logger.ts'
import { inactivityService } from '#/services/inactivity.service.ts'
import { formatForUser } from '#/utils/time.ts'
import { envs } from '#/config.ts'
import { PLAYER_STATUS, type RoleStatistic } from '#/db/generated/browser.ts'
import type { CommandInteractionHandler } from '#/services/interactions.service.ts'
import { monitoredService } from '#/services/monitored.service.ts'
import { db } from '#/db/prisma.ts'

/**
 * Genera un código de vinculación de sesión y lo persiste en la base de datos.
 * También intenta enviarlo por DM y responde de forma efímera al usuario.
 */
export default class implements CommandInteractionHandler {
    name = 'inactividad'
    async run(interaction: ChatInputCommandInteraction<'cached'>) {
        if (
            !interaction.memberPermissions?.has(
                PermissionsBitField.Flags.Administrator,
            )
        ) {
            return await interaction.reply({
                content: 'Solo administradores pueden usar estos comandos.',
            })
        }

        const group = interaction.options.getSubcommandGroup(false)
        if (!group) {
            switch (interaction.options.getSubcommand()) {
                case 'listar':
                    return await handleList(interaction)
                case 'estadisticas':
                    return await handleStats(interaction)
                case 'logins':
                    return await handleLogins(interaction)
                default:
                    return await interaction.reply({
                        content: 'Comando desconocido.',
                    })
            }
        }

        if (group === 'roles') {
            switch (interaction.options.getSubcommand()) {
                case 'agregar':
                    return await handleRoleAdd(interaction)
                case 'eliminar':
                    return await handleRoleRemove(interaction)
                case 'listar':
                    return await handleRoleList(interaction)
                default:
                    return await interaction.reply({
                        content: 'Subcomando desconocido.',
                    })
            }
        }

        await interaction.reply({ content: 'Comando desconocido.' })
    }
    static async build(
        _params?: Record<string, unknown>,
    ): Promise<ApplicationCommandDataResolvable> {
        return new SlashCommandBuilder()
            .setName('inactividad')
            .setNameLocalizations({
                'en-US': 'inactivity',
                'es-ES': 'inactividad',
            })
            .setDescription(
                'Herramientas administrativas para gestionar inactividad',
            )
            .setDescriptionLocalizations({
                'en-US': 'Administrative tools for managing inactivity',
                'es-ES':
                    'Herramientas administrativas para gestionar inactividad',
            })
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand(logins =>
                logins
                    .setName('logins')
                    .setNameLocalizations({
                        'en-US': 'logins',
                        'es-ES': 'logins',
                    })
                    .setDescription(
                        'Lista los inicios de sesiones en el servidor',
                    )
                    .setDescriptionLocalizations({
                        'en-US': 'Lists logins on the server',
                        'es-ES': 'Lista los inicios de sesiones en el servidor',
                    }),
            )
            .addSubcommand(listar =>
                listar
                    .setName('listar')
                    .setNameLocalizations({
                        'en-US': 'list',
                        'es-ES': 'listar',
                    })
                    .setDescription('Muestra las inactividades registradas')
                    .setDescriptionLocalizations({
                        'en-US': 'Displays recorded inactivity',
                        'es-ES': 'Muestra las inactividades registradas',
                    }),
            )
            .addSubcommand(estadisticas =>
                estadisticas
                    .setName('estadisticas')
                    .setNameLocalizations({
                        'en-US': 'statistics',
                        'es-ES': 'estadisticas',
                    })
                    .setDescription(
                        'Muestra estadísticas de inactividad por rol',
                    )
                    .setDescriptionLocalizations({
                        'es-ES': 'Muestra estadísticas de inactividad por rol',
                        'en-US': 'Displays inactivity statistics by role',
                    }),
            )
            .addSubcommandGroup(roles =>
                roles
                    .setName('roles')
                    .setNameLocalizations({
                        'en-US': 'roles',
                        'es-ES': 'roles',
                    })
                    .setDescription('Gestiona los roles monitoreados')
                    .setDescriptionLocalizations({
                        'es-ES': 'Gestiona los roles monitoreados',
                        'en-US': 'Manage monitored roles',
                    })
                    .addSubcommand(sub =>
                        sub
                            .setName('agregar')
                            .setNameLocalizations({
                                'en-US': 'add',
                                'es-ES': 'agregar',
                            })
                            .setDescription(
                                'Agrega un rol a la lista de seguimiento',
                            )
                            .setDescriptionLocalizations({
                                'es-ES':
                                    'Agrega un rol a la lista de seguimiento',
                                'en-US': 'Add a role to the watchlist',
                            })
                            .addRoleOption(op =>
                                op
                                    .setName('rol')
                                    .setNameLocalizations({
                                        'en-US': 'role',
                                        'es-ES': 'rol',
                                    })
                                    .setDescription('Rol a seguir')
                                    .setDescriptionLocalizations({
                                        'es-ES': 'Rol a seguir',
                                        'en-US': 'Role to follow',
                                    }),
                            ),
                    )
                    .addSubcommand(sub =>
                        sub
                            .setName('eliminar')
                            .setNameLocalizations({
                                'en-US': 'remove',
                                'es-ES': 'eliminar',
                            })
                            .setDescription(
                                'Elimina un rol a la lista de seguimiento',
                            )
                            .setDescriptionLocalizations({
                                'es-ES':
                                    'Elimina un rol a la lista de seguimiento',
                                'en-US': 'Remove a role to the watchlist',
                            })
                            .addRoleOption(op =>
                                op
                                    .setName('rol')
                                    .setNameLocalizations({
                                        'en-US': 'role',
                                        'es-ES': 'rol',
                                    })
                                    .setDescription('Rol a dejar de seguir')
                                    .setDescriptionLocalizations({
                                        'es-ES': 'Rol a dejar de seguir',
                                        'en-US': 'Role to stop following',
                                    }),
                            ),
                    )
                    .addSubcommand(sub =>
                        sub
                            .setName('listar')
                            .setNameLocalizations({
                                'en-US': 'list',
                                'es-ES': 'listar',
                            })
                            .setDescription(
                                'Muestra los roles actualmente monitoreados',
                            )
                            .setDescriptionLocalizations({
                                'es-ES':
                                    'Muestra los roles actualmente monitoreados',
                                'en-US':
                                    'Displays the roles currently being monitored',
                            }),
                    ),
            )
    }
}

/**
 * Genera un embed listando la última conexion de los jugadores
 * activos y registrados en el servidor
 * @param interaction
 */
async function handleLogins(
    interaction: ChatInputCommandInteraction<'cached'>,
) {
    await interaction.deferReply()

    const players = await db.player.findMany({
        where: { status: PLAYER_STATUS.ACTIVE },
        select: {
            nickname: true,
            last_seen: true,
            discord_user_id: true,
        },
    })

    const list = players.map(p => {
        const base = `- <@${p.discord_user_id}> **${p.nickname}**`
        if (p.last_seen) {
            const unix = Math.floor(p.last_seen.getTime() / 1000)
            return `${base} <t:${unix}:s> <t:${unix}:R>`
        }
        return `${base} Sin registros`
    })

    return await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
            parse: [],
        },
        components: [
            new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# Últimas conexiones de los jugadores\n${list.join('\n')}`,
                ),
            ),
        ],
    })
}

/**
 * Genera un resumen inmediato del estado de inactividad de todos los
 * miembros pertenecientes a los roles monitoreados, utilizando tanto la
 * caché de Discord como la base de datos.
 */
async function handleList(interaction: CommandInteraction<'cached'>) {
    // Recupera registros en BD y configuración de roles a monitorear.
    const records = await inactivityService.listInactivities(
        interaction.guildId,
    )
    const trackedRoles = await monitoredService.listRoles(interaction.guildId)

    if (!trackedRoles.length) {
        await interaction.reply({
            content:
                'No hay roles configurados. Usa `/inactividad roles agregar`.',
        })
        return
    }

    // Obtener todos los miembros del servidor (incluyendo offline)
    await interaction.deferReply()
    const allServerMembers = await interaction.guild.members.fetch()

    // Si no se pueden obtener todos, usar role.members como fallback
    if (!allServerMembers || allServerMembers.size === 0) {
        for (const roleId of trackedRoles) {
            const role = await interaction.guild.roles
                .fetch(roleId)
                .catch(() => null)
            if (!role) continue
            for (const [memberId, member] of role.members) {
                if (!allServerMembers.has(memberId)) {
                    allServerMembers.set(memberId, member)
                }
            }
        }
    }

    // Validar que hay miembros
    if (!allServerMembers || allServerMembers.size === 0) {
        await interaction.editReply({
            content: 'No se encontraron miembros con los roles monitoreados.',
        })
        return
    }

    // Filtrar miembros que tienen los roles monitoreados
    const allMembers = new Map()
    for (const [memberId, member] of allServerMembers) {
        for (const roleId of trackedRoles) {
            if (member.roles.cache.has(roleId)) {
                allMembers.set(memberId, member)
                break
            }
        }
    }

    // Separar inactivos y activos
    const inactiveMembers = []
    const activeMembers = []
    const inactiveIds = new Set(records.map(r => r.user_id))

    for (const [memberId, member] of allMembers) {
        if (inactiveIds.has(memberId)) {
            const record = records.find(r => r.user_id === memberId)
            inactiveMembers.push({ member, endsAt: record?.ends_at })
        } else {
            activeMembers.push(member)
        }
    }

    // Crear embed
    const embed = new EmbedBuilder()
        .setTitle('Estado de miembros monitoreados')
        .setColor(0x5865f2)
        .setTimestamp(new Date())
        .setDescription(
            `Total: **${allMembers.size}** | Inactivos: **${inactiveMembers.length}** | Activos: **${activeMembers.length}**`,
        )

    // Agregar campo de inactivos (máximo 50 caracteres por línea, máximo 1024 caracteres totales)
    if (inactiveMembers.length > 0) {
        const maxLines = 20
        const inactiveList = inactiveMembers
            .slice(0, maxLines)
            .map(item => {
                const memberStr = item.member.user.username
                const endStr =
                    item.endsAt ?
                        formatForUser(item.endsAt).substring(0, 30)
                    :   'Sin fecha'
                return `${memberStr} → ${endStr}`
            })
            .join('\n')
        const displayText =
            inactiveMembers.length > maxLines ?
                `${inactiveList}\n... y ${inactiveMembers.length - maxLines} más`
            :   inactiveList
        embed.addFields({
            name: `❌ Inactivos (${inactiveMembers.length})`,
            value: displayText || 'Sin datos',
        })
    } else {
        embed.addFields({
            name: `❌ Inactivos (0)`,
            value: 'No hay miembros inactivos.',
        })
    }

    // Agregar campo de activos (máximo 50 caracteres por línea, máximo 1024 caracteres totales)
    if (activeMembers.length > 0) {
        const maxLines = 20
        const activeList = activeMembers
            .slice(0, maxLines)
            .map(member => member.user.username)
            .join('\n')
        const displayText =
            activeMembers.length > maxLines ?
                `${activeList}\n... y ${activeMembers.length - maxLines} más`
            :   activeList
        embed.addFields({
            name: `✅ Activos (${activeMembers.length})`,
            value: displayText || 'Sin datos',
        })
    } else {
        embed.addFields({
            name: `✅ Activos (0)`,
            value: 'No hay miembros activos.',
        })
    }

    await interaction.editReply({ embeds: [embed] })
}

/**
 * Calcula estadísticas de inactividad por rol, incluyendo porcentajes y
 * tendencias históricas, para su visualización en un embed detallado.
 */
async function handleStats(interaction: CommandInteraction<'cached'>) {
    // Obtiene registros actuales y roles monitoreados para generar métricas.
    const records = await inactivityService.listInactivities(
        interaction.guildId,
    )
    const tracked = await monitoredService.listRoles(interaction.guildId)
    if (!tracked.length) {
        await interaction.reply({
            content:
                'No hay roles configurados. Usa `/inactividad roles agregar`.',
        })
        return
    }

    // Obtener todos los miembros del servidor (incluyendo offline)
    const allServerMembers = await interaction.guild.members
        .fetch()
        .catch(() => null)

    const summaries: Array<{
        role: Role
        total: number
        inactive: number
        active: number
    }> = []
    let totalMembers = 0
    let totalInactive = 0
    for (const roleId of tracked) {
        const role = await interaction.guild.roles
            .fetch(roleId)
            .catch(() => null)
        if (!role) continue

        // Filtrar miembros que tienen este rol
        const members =
            allServerMembers && allServerMembers.size > 0 ?
                allServerMembers.filter(member =>
                    member.roles.cache.has(roleId),
                )
            :   role.members
        const [inactive, active] = members.partition(member =>
            records.some(record => record.user_id === member.id),
        )

        totalMembers += members.size
        totalInactive += inactive.size
        summaries.push({
            role,
            total: members.size,
            inactive: inactive.size,
            active: active.size,
        })
    }

    if (!summaries.length) {
        return await interaction.reply({
            content: 'No se encontraron roles monitoreados disponibles.',
        })
    }

    const embed = new EmbedBuilder()
        .setTitle('Estadísticas de inactividad')
        .setColor(0x5865f2)
        .setTimestamp(new Date())
        .setDescription('Resumen actualizado de los roles monitoreados.')

    const totalActive = Math.max(totalMembers - totalInactive, 0)
    const totalPercentage =
        totalMembers ? (totalInactive / totalMembers) * 100 : 0
    embed.addFields({
        name: 'Visión general',
        value: `Miembros analizados: **${totalMembers}**\nInactivos: **${totalInactive}** (${totalPercentage.toFixed(1)}%)\nActivos: **${totalActive}**`,
    })

    for (const summary of summaries) {
        const percentage =
            summary.total ? (summary.inactive / summary.total) * 100 : 0
        embed.addFields({
            name: summary.role.name,
            value: `${buildBar(percentage)} ${percentage.toFixed(1)}% inactivos\nInactivos: **${summary.inactive}** | Activos: **${summary.active}**`,
            inline: summaries.length > 1,
        })
    }

    const snapshots = await monitoredService.getSnapshots(interaction.guildId)
    const historyField = buildHistoryField(snapshots, summaries)
    if (historyField) {
        embed.addFields(historyField)
    }

    await interaction.reply({ embeds: [embed] })
}

async function handleRoleAdd(
    interaction: ChatInputCommandInteraction<'cached'>,
) {
    const role = interaction.options.getRole('rol', true)
    monitoredService.addRole(interaction.guildId, role.id)
    await interaction.reply({ content: `Seguiremos el rol ${role}.` })
    await logAdminAction(
        interaction,
        `${interaction.user} agregó el rol ${role} al seguimiento.`,
    )
}

/**
 * Quita un rol de la lista de seguimiento y registra la acción en el canal
 * de auditoría configurado.
 */
async function handleRoleRemove(
    interaction: ChatInputCommandInteraction<'cached'>,
) {
    const role = interaction.options.getRole('rol', true)
    monitoredService.removeRole(interaction.guildId, role.id)
    await interaction.reply({
        content: `Eliminamos el rol ${role} del seguimiento.`,
    })
    await logAdminAction(
        interaction,
        `${interaction.user} eliminó el rol ${role} del seguimiento.`,
    )
}

/**
 * Lista los roles actualmente vigilados y los devuelve como menciones para
 * facilitar su lectura por parte del administrador.
 */
async function handleRoleList(interaction: CommandInteraction<'cached'>) {
    const roles = await monitoredService.listRoles(interaction.guildId)
    if (!roles.length) {
        return await interaction.reply({
            content: 'No hay roles monitoreados.',
        })
    }

    const mentions = roles.map(roleId => `<@&${roleId}>`)
    await interaction.reply({
        content: `Roles monitoreados: ${mentions.join(', ')}`,
    })
}

/**
 * Envía un mensaje al canal de auditoría configurado para dejar constancia
 * de las acciones administrativas ejecutadas mediante los comandos del bot.
 */
async function logAdminAction(
    interaction: CommandInteraction<'cached'>,
    message: string,
) {
    if (!envs.adminLogChannelId) return
    try {
        const channel = await interaction.client.channels.fetch(
            envs.adminLogChannelId,
        )
        if (channel?.isTextBased() && 'send' in channel) {
            await channel.send({ content: message })
        }
    } catch (error) {
        logger.warn(
            { err: error },
            'No se pudo enviar mensaje al canal de auditoría',
        )
    }
}

/**
 * Construye una barra textual proporcional al porcentaje indicado.
 */
function buildBar(percentage: number) {
    const width = 12
    const filled = Math.round((percentage / 100) * width)
    const clampedFilled = Math.min(width, Math.max(0, filled))
    const empty = width - clampedFilled
    return `${'█'.repeat(clampedFilled)}${'░'.repeat(empty)}`
}

/**
 * Construye el campo de historial usando datos de snapshots previos para
 * representar tendencias de inactividad por rol.
 */
function buildHistoryField(
    snapshots: RoleStatistic[],
    summaries: Array<{
        role: Role
        total: number
        inactive: number
        active: number
    }>,
) {
    if (!snapshots.length) return null

    const grouped = new Map<string, RoleStatistic[]>()
    for (const snapshot of snapshots) {
        if (!grouped.has(snapshot.role_id)) {
            grouped.set(snapshot.role_id, [])
        }
        grouped.getOrInsert(snapshot.role_id, []).push(snapshot)
    }

    const lines = []
    for (const summary of summaries) {
        const roleSnapshots = grouped.get(summary.role.id)
        if (!roleSnapshots?.length) continue
        const sorted = [...roleSnapshots].toSorted(
            (a, b) => a.captured_at.getTime() - b.captured_at.getTime(),
        )
        const recent = sorted.slice(-10)
        const sparkline = buildSparkline(
            recent.map(item =>
                percentageInactive(item.inactive_count, item.active_count),
            ),
        )
        const last = recent.at(-1)
        const percentage =
            last ?
                percentageInactive(
                    last.inactive_count,
                    last.active_count,
                ).toFixed(1)
            :   '0.0'
        lines.push(`${summary.role} ${sparkline} (${percentage}%)`)
    }

    if (!lines.length) return null

    return {
        name: 'Historial reciente',
        value: lines.join('\n'),
    }
}

/**
 * Genera una mini-gráfica tipo sparkline usando caracteres de bloques para
 * reflejar variaciones en porcentajes de inactividad.
 */
function buildSparkline(percentages: Array<number>) {
    if (!percentages.length) return 'sin datos'
    const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
    return percentages
        .map(percentage => {
            const index = Math.min(
                blocks.length - 1,
                Math.max(
                    0,
                    Math.round((percentage / 100) * (blocks.length - 1)),
                ),
            )
            return blocks[index]
        })
        .join('')
}

/**
 * Calcula el porcentaje de inactividad dado el número de inactivos y activos.
 */
function percentageInactive(inactive: number, active: number) {
    const total = inactive + active
    if (!total) return 0
    return (inactive / total) * 100
}
