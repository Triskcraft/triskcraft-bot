import {
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
} from 'discord.js'
import { StringMenuHandler } from '#/services/interactions.service.ts'
import { mcRoleService } from '#/services/mcroles.service.ts'
import { db } from '#/db.ts'

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

        await db.linkedMinecraftRole.createMany({
            data: interaction.values.map(roleId => ({
                mc_user_uuid: uuid,
                role_id: roleId,
            })),
            skipDuplicates: true,
        })

        await mcRoleService.renderPannel()
    }
}
