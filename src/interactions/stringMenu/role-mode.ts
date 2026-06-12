import {
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
} from 'discord.js'
import { StringMenuHandler } from '#/services/interactions.service.ts'
import { mcRoleService } from '#/services/mcroles.service.ts'

export const ROLE_PANEL_MODE = {
    ROLE: 'ROLE',
    PLAYER: 'PLAYER',
} as const

export type RolePlanelMode =
    (typeof ROLE_PANEL_MODE)[keyof typeof ROLE_PANEL_MODE]

export default class extends StringMenuHandler {
    override regex = /^role:mode$/

    static override async build({
        mode = ROLE_PANEL_MODE.ROLE,
    }: {
        mode?: RolePlanelMode
    }) {
        const selectUserMenu = new StringSelectMenuBuilder()
            .setCustomId(`role:mode`)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Vista de roles`)
                    .setValue(ROLE_PANEL_MODE.ROLE)
                    .setDefault(mode === ROLE_PANEL_MODE.ROLE),
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Vista de jugadores`)
                    .setValue(ROLE_PANEL_MODE.PLAYER)
                    .setDefault(mode === ROLE_PANEL_MODE.PLAYER),
            )

        return selectUserMenu
    }

    override async run(interaction: StringSelectMenuInteraction<'cached'>) {
        await interaction.deferUpdate()
        const uuid = this.regex.exec(interaction.customId)?.groups?.uuid
        if (!uuid) return
        // TODO: check
        // for (const role of interaction.values) {
        //     await mcRoleService.roles.cache.get(role)?.addPlayer(uuid)
        // }
        await mcRoleService.renderPannel()
    }
}
