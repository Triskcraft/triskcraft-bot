import { client } from '#/client.ts'
import { envs, STATE_KEYS } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { logger } from '#/logger.ts'
import {
    ButtonStyle,
    ButtonBuilder,
    SectionBuilder,
    ComponentType,
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
    type SendableChannels,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    Message,
    Events,
} from 'discord.js'
import RoleStringMenu from '#/interactions/stringMenu/role.ts'
import RoleAddStringMenu from '#/interactions/stringMenu/role-add.ts'
import { listMax, Paginator } from '#/utils/format.ts'
import { randomUUID } from 'node:crypto'
import rolePage from '#/interactions/buttons/role/role-page.ts'
import { Player } from '#/classes/player.ts'
import roleBack from '#/interactions/buttons/role/role-back.ts'
import { PLAYER_STATUS } from '#/db/generated/enums.ts'
import { playersService } from './players.service.ts'
import type { MinecraftRole } from '#/db/generated/client.ts'

const PANNEL_NAME = '# 🎭 **Panel de Roles de Minecraft**'

class MCRoleService {
    #message: Message | null = null

    #selectedUser: string | null = null

    #defaultRole: MinecraftRole | null = null

    #started = false

    get defaultRoleId() {
        return this.#defaultRole?.id
    }

    // #roles = new MinecraftRolesManager()

    #selectedRole: MinecraftRole | null = null
    #selectedPage = 1

    // get roles() {
    //     return this.#roles
    // }

    async start() {
        logger.info('[ROLE SERVICE] Inicializando...')
        // await this.#roles.fetch()
        const defaultRoleState = await db.state.findUnique({
            where: { key: STATE_KEYS.DEFAULT_MINECRAFT_ROLE_ID },
            select: { value: true },
        })
        this.#defaultRole =
            defaultRoleState ?
                await db.minecraftRole.findUnique({
                    where: { id: defaultRoleState.value },
                })
            :   null
        if (!this.#started) {
            await this.#chechDefaultRole()
            await this.renderPannel()
        }
        this.registerListener()
        this.#started = true
    }

    async #chechDefaultRole() {
        if (!this.#defaultRole) {
            logger.error(
                '[ROLE SERVICE] No se encontró el rol de Minecraft por defecto. Ejecute `prisma db seed`.',
            )
            return
        }

        const usersWithoutRoles = await db.player.findMany({
            where: {
                linked_roles: {
                    none: {},
                },
                status: PLAYER_STATUS.ACTIVE,
            },
            select: {
                uuid: true,
                nickname: true,
            },
        })
        for (const { uuid, nickname } of usersWithoutRoles) {
            try {
                await db.linkedMinecraftRole.create({
                    data: {
                        role: {
                            connect: {
                                id: this.#defaultRole.id,
                            },
                        },
                        player: {
                            connect: {
                                uuid: uuid,
                            },
                        },
                    },
                })
                logger.info(
                    `[ROLE SERVICE] Rol ${this.#defaultRole.name} agregado a ${nickname}`,
                )
            } catch {
                // ignore
            }
        }
    }

    async renderPannel() {
        const channel =
            client.channels.cache.get(envs.PANEL_CHANNEL_ID) ??
            (await client.channels.fetch(envs.PANEL_CHANNEL_ID))
        if (!channel) {
            return logger.warn('[ROLE SERVICE] Canal de panel no encontrado')
        }
        if (!channel.isSendable()) {
            return logger.warn(
                '[ROLE SERVICE] El canal de pannel no está disponible',
            )
        }

        const container =
            this.#selectedRole ?
                await this.#buildRolePannel({ role: this.#selectedRole })
            :   await this.#buildPanel()

        if (this.#message) {
            this.#message.edit({
                components: [container],
            })
        } else {
            const whpmid = await db.state.findUnique({
                where: { key: STATE_KEYS.ROLES_PANEL_MESSAGE_ID },
                select: { value: true },
            })
            if (whpmid) {
                const anc = await channel.messages
                    .fetch(whpmid.value)
                    .catch(() => null)
                if (anc) {
                    await anc.edit({
                        components: [container],
                    })
                } else {
                    await this.#checkPinned(channel, container)
                }
            } else {
                await this.#checkPinned(channel, container)
            }
        }
    }

    async #buildPanel() {
        const roles = await db.minecraftRole.findMany({
            select: {
                name: true,
                id: true,
                linked_roles: {
                    select: {
                        player: {
                            select: {
                                nickname: true,
                            },
                        },
                    },
                },
            },
        })
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    PANNEL_NAME +
                        '\nAdministra los roles del servidor de Minecraft.' +
                        '\n> Para agreggar o eliminar roles usa /settings mineraft-roles',
                ),
            )
            .addSeparatorComponents(new SeparatorBuilder())

        for (const role of roles.values()) {
            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `- **${role.name}**\nAsignado a ${listMax(
                                role.linked_roles.map(
                                    l => `**${l.player.nickname}**`,
                                ),
                                2,
                            )}`,
                        ),
                    )
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setLabel('Seleccionar')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId(`role:select:${role.id}`),
                    ),
            )
        }
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    '## Jugadores\nSelecciona un jugador para ver y/o administrar sus roles',
                ),
            )

        const selected = await this.#getSelectedUser()
        container.addActionRowComponents(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                await RoleStringMenu.build({ selected }),
            ),
        )
        if (selected) {
            const user = await db.player.findFirst({
                where: { uuid: selected, status: PLAYER_STATUS.ACTIVE },
                include: { linked_roles: { select: { role: true } } },
            })
            if (!user) {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        'Lo lamento, no se encontró ese jugador',
                    ),
                )
            } else {
                playersService.players.cache.set(
                    user.uuid,
                    new Player({
                        discord_user_id: user.discord_user_id,
                        nickname: user.nickname,
                        role:
                            user.linked_roles[0]?.role.id ?? envs.DEFAULT_RANK,
                        uuid: user.uuid,
                    }),
                )
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('Roles:'),
                )
                for (const { name } of user.linked_roles.map(l => l.role)) {
                    container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`- ${name}`),
                    )
                }
                container.addActionRowComponents(
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        await RoleAddStringMenu.build({
                            userUUID: user.uuid,
                            roles: [...roles.values()],
                        }),
                    ),
                )
            }
        }

        return container
    }

    async #buildRolePannel({ role }: { role: MinecraftRole }) {
        const container = new ContainerBuilder().addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `# ${role.name}\nJugadores con ese rol:`,
                    ),
                )
                .setButtonAccessory(await roleBack.build()),
        )
        const players = await db.player.findMany({
            where: {
                linked_roles: {
                    some: {
                        role_id: role.id,
                    },
                },
            },
        })
        const pages = new Paginator(players, { peer: 5 })
        const { page, hasNext, hasPrev, items, totalPages } = pages.get(
            this.#selectedPage,
        )
        if (items.length === 0) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `No se encontraron jugadores con ese rol`,
                ),
            )
        } else {
            for (const { nickname } of items) {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`- ${nickname}`),
                )
            }
        }

        return container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                await rolePage.build({
                    id: role.id,
                    label: 'Anterior',
                    disabled: !hasPrev,
                    page: page - 1,
                }),
                new ButtonBuilder()
                    .setLabel(`Página ${page} de ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setCustomId(`${randomUUID()}`),
                await rolePage.build({
                    id: role.id,
                    label: 'Siguiente',
                    disabled: !hasNext,
                    page: page + 1,
                }),
            ),
        )
    }

    async #checkPinned(channel: SendableChannels, container: ContainerBuilder) {
        const pinned = await channel.messages.fetchPins()

        const my = pinned.items.find(msg => {
            const container = msg.message.components[0]
            if (!container) return false
            if (container.type !== ComponentType.Container) return false
            const textDisplay = container.components[0]
            if (!textDisplay) return false
            if (textDisplay.type !== ComponentType.TextDisplay) return false
            return (
                msg.message.author.id === client.user.id &&
                textDisplay.content.includes(PANNEL_NAME)
            )
        })
        let nid: string
        if (my) {
            await my.message.edit({
                components: [container],
            })
            nid = my.message.id
        } else {
            this.#message = await channel.send({
                components: [container],
                flags:
                    MessageFlags.IsComponentsV2 |
                    MessageFlags.SuppressNotifications,
            })
            nid = this.#message.id
            await this.#message.pin()
        }
        await db.state.upsert({
            where: { key: STATE_KEYS.ROLES_PANEL_MESSAGE_ID },
            update: { value: nid },
            create: { key: STATE_KEYS.ROLES_PANEL_MESSAGE_ID, value: nid },
        })
    }

    async #getSelectedUser() {
        if (this.#selectedUser) return this.#selectedUser
        const sdb = await db.state.findUnique({
            where: { key: STATE_KEYS.ROLES_PANEL_SELECTED_USER },
        })
        return sdb?.value ?? null
    }

    async selectUser(uuid: string) {
        this.#selectedUser = uuid
        await this.renderPannel()
        await db.state.upsert({
            where: { key: STATE_KEYS.ROLES_PANEL_SELECTED_USER },
            update: { value: uuid },
            create: { key: STATE_KEYS.ROLES_PANEL_SELECTED_USER, value: uuid },
        })
    }

    async selectRole(role: MinecraftRole | null, page = 1) {
        this.#selectedPage = (this.#selectedRole = role) !== null ? page : 1
        await this.renderPannel()
    }

    async changuePage(page: number) {
        this.#selectedPage = page
        await this.renderPannel()
    }

    registerListener() {
        if (this.#started) return
        client.on(Events.GuildRoleUpdate, async (old, role) => {
            if (old.name === role.name) return
            const dbrole = await db.minecraftRole.findFirst({
                where: { id: role.id },
            })
            if (!dbrole) return
            await db.minecraftRole.update({
                where: { id: role.id },
                data: {
                    name: role.name,
                },
            })
            await this.renderPannel()
        })
        client.on(Events.GuildRoleDelete, async role => {
            const dbrole = await db.minecraftRole.findFirst({
                where: { id: role.id },
            })
            if (!dbrole) return
            await db.minecraftRole.delete({
                where: { id: role.id },
            })
            await this.renderPannel()
        })
    }
}

export class AlreadyExistsError extends Error {}
export class UnknowError extends Error {
    constructor(cause: unknown) {
        super('Unknow Error', { cause })
    }
}

export const mcRoleService = new MCRoleService()
