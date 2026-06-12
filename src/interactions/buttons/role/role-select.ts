import { ButtonBuilder, ButtonStyle, type ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '#/services/interactions.service.ts'
import { mcRoleService } from '#/services/mcroles.service.ts'
import { db } from '#/db/prisma.ts'

export default class extends ButtonInteractionHandler<'id'> {
    override regex = /^role:select:(?<id>\d+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        await interaction.deferUpdate()
        const id = this.parser(interaction.customId).get('id')
        const role = await db.minecraftRole.findFirst({
            where: { id },
        })
        if (!role) {
            return
        }
        await mcRoleService.selectRole(role)
    }

    static override async build({
        id,
    }: {
        id: string
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('Seleccionar')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId('role:select:' + id)
    }
}
