import { ButtonBuilder, ButtonStyle, type ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '#/services/interactions.service.ts'
import { mcRoleService } from '#/services/mcroles.service.ts'

export default class extends ButtonInteractionHandler {
    override regex = /^role:back$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        await interaction.deferUpdate()
        await mcRoleService.selectRole(null)
    }
    static override async build(
        _params?: Record<string, unknown>,
    ): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('Atrás')
            .setStyle(ButtonStyle.Success)
            .setCustomId('role:back')
    }
}
