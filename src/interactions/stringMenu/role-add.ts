import {
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
} from 'discord.js'
import { StringMenuHandler } from '#/services/interactions.service.ts'
import { mcRoleService } from '#/services/mcroles.service.ts'

export default class extends StringMenuHandler {
    override regex = /^role:add:(?<uuid>[^:]+)$/

    static override async build({
        roles,
        userUUID,
    }: {
        userUUID: string
        roles: { name: string; id: string }[]
    }) {
        const selectUserMenu = new StringSelectMenuBuilder()
            .setCustomId(`role:add:${userUUID}`)
            .setMinValues(1)
            .setMaxValues(Math.min(10, roles.length))
            .setPlaceholder('Selecciona un rol para agregar')

        for (const { id, name } of roles) {
            selectUserMenu.addOptions(
                new StringSelectMenuOptionBuilder().setLabel(name).setValue(id),
            )
        }
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
