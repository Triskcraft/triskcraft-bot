import {
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    type ApplicationCommandDataResolvable,
    type ChatInputCommandInteraction,
} from 'discord.js'
import type { CommandInteractionHandler } from '#/services/interactions.service.ts'
import { db } from '#/db.ts'
import { STATE_KEYS } from '@triskcraft/db'
import { mcRoleService } from '#/services/mcroles.service.ts'

const GROUPS = {
    MINECRAFT_ROLES: 'minecraft-roles',
} as const

type Groups = (typeof GROUPS)[keyof typeof GROUPS]

const SUBCOMMANDS_MINECRAFT_ROLES = {
    SET_DEFAULT: 'set-default',
    ADD: 'add',
    REMOVE: 'remove',
} as const

type SubcommandMinecraftRoles =
    (typeof SUBCOMMANDS_MINECRAFT_ROLES)[keyof typeof SUBCOMMANDS_MINECRAFT_ROLES]
/**
 * Genera un código de vinculación de sesión y lo persiste en la base de datos.
 * También intenta enviarlo por DM y responde de forma efímera al usuario.
 */
export default class implements CommandInteractionHandler {
    name = 'settings'
    static async build(
        _params?: Record<string, unknown>,
    ): Promise<ApplicationCommandDataResolvable> {
        return new SlashCommandBuilder()
            .setName('settings')
            .setNameLocalizations({
                'en-US': 'settings',
                'es-ES': 'ajustes',
            })
            .setDescription('Cambia las configuraciones del bot')
            .setDescriptionLocalizations({
                'en-US': 'Change the bot settings',
                'es-ES': 'Cambia las configuraciones del bot',
            })
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommandGroup(group =>
                group
                    .setName(GROUPS.MINECRAFT_ROLES)
                    .setNameLocalizations({
                        'en-US': 'minecraft-roles',
                        'es-ES': 'roles-de-minecraft',
                    })
                    .setDescription('Minecraft role setings')
                    .setDescriptionLocalizations({
                        'en-US': 'Minecraft role setings',
                        'es-ES': 'Configuraciones de los roles de minecraft',
                    })
                    .addSubcommand(sub =>
                        sub
                            .setName(SUBCOMMANDS_MINECRAFT_ROLES.SET_DEFAULT)
                            .setNameLocalizations({
                                'en-US': 'set-default',
                                'es-ES': 'establecer-predeterminado',
                            })
                            .setDescription(
                                'Set default role for minecraft players',
                            )
                            .setDescriptionLocalizations({
                                'en-US':
                                    'Set default role for minecraft players',
                                'es-ES':
                                    'Establece el rol predeterminado para los jugadores de minecraft',
                            })
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setNameLocalizations({
                                        'en-US': 'role',
                                        'es-ES': 'rol',
                                    })
                                    .setDescription('Role to select')
                                    .setDescriptionLocalizations({
                                        'es-ES': 'Rol a elegir',
                                        'en-US': 'Role to select',
                                    })
                                    .setRequired(true),
                            ),
                    )
                    .addSubcommand(sub =>
                        sub
                            .setName(SUBCOMMANDS_MINECRAFT_ROLES.ADD)
                            .setNameLocalizations({
                                'en-US': 'add',
                                'es-ES': 'agregar',
                            })
                            .setDescription('Add a role as a minecraft role')
                            .setDescriptionLocalizations({
                                'en-US': 'Add a role as a minecraft role',
                                'es-ES': 'Agrega un rol como rol de minecraft',
                            })
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setNameLocalizations({
                                        'en-US': 'role',
                                        'es-ES': 'rol',
                                    })
                                    .setDescription('Role to add')
                                    .setDescriptionLocalizations({
                                        'es-ES': 'Rol a agregar',
                                        'en-US': 'Role to add',
                                    })
                                    .setRequired(true),
                            ),
                    )
                    .addSubcommand(sub =>
                        sub
                            .setName(SUBCOMMANDS_MINECRAFT_ROLES.REMOVE)
                            .setNameLocalizations({
                                'en-US': 'remove',
                                'es-ES': 'remove',
                            })
                            .setDescription(
                                'Remove a minecraft role from the list',
                            )
                            .setDescriptionLocalizations({
                                'en-US':
                                    'Remove a minecraft role from the list',
                                'es-ES':
                                    'Elimina un rol de minecraft de la lista',
                            })
                            .addRoleOption(option =>
                                option
                                    .setName('role')
                                    .setNameLocalizations({
                                        'en-US': 'role',
                                        'es-ES': 'rol',
                                    })
                                    .setDescription('Role to remove')
                                    .setDescriptionLocalizations({
                                        'es-ES': 'Rol a remover',
                                        'en-US': 'Role to remove',
                                    })
                                    .setRequired(true),
                            ),
                    ),
            )
    }
    async run(interaction: ChatInputCommandInteraction<'cached'>) {
        const groupName = interaction.options.getSubcommandGroup() as Groups
        switch (groupName) {
            case 'minecraft-roles': {
                const subcommandName =
                    interaction.options.getSubcommand() as SubcommandMinecraftRoles
                switch (subcommandName) {
                    case 'set-default': {
                        return await setDefaultMinecraftRole(interaction)
                    }
                    case 'add': {
                        return await addMinecraftRole(interaction)
                    }
                    case 'remove': {
                        return await removeMinecraftRole(interaction)
                    }
                    default: {
                        await interaction.reply({
                            flags: MessageFlags.Ephemeral,
                            content: `Lo lamento, pero no encuentro el comando /settings ${groupName} ${subcommandName satisfies never}`,
                        })
                    }
                }
                return
            }
            default: {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: `Lo lamento, pero no encuentro el comando /settings ${groupName satisfies never}`,
                })
            }
        }
    }
}

async function setDefaultMinecraftRole(
    interaction: ChatInputCommandInteraction<'cached'>,
) {
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
    })

    const role = interaction.options.getRole('role', true)
    // asegure role in db
    await db.minecraftRole.upsert({
        where: { id: role.id },
        create: {
            id: role.id,
            name: role.name,
        },
        update: {
            name: role.name,
        },
    })
    // set default
    await db.state.upsert({
        where: { key: STATE_KEYS.DEFAULT_MINECRAFT_ROLE_ID },
        update: {
            value: role.id,
        },
        create: {
            key: STATE_KEYS.DEFAULT_MINECRAFT_ROLE_ID,
            value: role.id,
        },
    })
    // to resync
    await mcRoleService.start()

    return await interaction.editReply({
        content: [
            `Rol ${role} establecido como predeterminado`,
            'Cuando un miembro se una se le asignará ese rol',
        ].join('\n'),
    })
}

async function addMinecraftRole(
    interaction: ChatInputCommandInteraction<'cached'>,
) {
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
    })

    const role = interaction.options.getRole('role', true)
    // asegure role in db
    await db.minecraftRole.upsert({
        where: { id: role.id },
        create: {
            id: role.id,
            name: role.name,
        },
        update: {
            name: role.name,
        },
    })
    // to resync
    await mcRoleService.renderPannel()

    return await interaction.editReply({
        content: `Rol ${role} agregado a la lista de roles de minecraft`,
    })
}

async function removeMinecraftRole(
    interaction: ChatInputCommandInteraction<'cached'>,
) {
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
    })

    const role = interaction.options.getRole('role', true)
    // asegure role in db
    await db.minecraftRole.delete({
        where: { id: role.id },
    })
    // to resync
    await mcRoleService.renderPannel()

    return await interaction.editReply({
        content: `Rol ${role} removido de la lista de roles de minecraft`,
    })
}
