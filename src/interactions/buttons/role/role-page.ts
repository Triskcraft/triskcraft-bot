import { ButtonBuilder, ButtonStyle, type ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '#/services/interactions.service.ts'
import { mcRoleService } from '#/services/mcroles.service.ts'

export default class extends ButtonInteractionHandler<'page' | 'id'> {
    override regex = /^role:page:(?<id>\d+):(?<page>\d+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        const parser = this.parser(interaction.customId)
        const page = +parser.get('page')

        await mcRoleService.changuePage(page)
    }
    static override async build({
        id,
        page,
        label,
        disabled = false,
    }: {
        id: string
        page: number
        label: string
        disabled: boolean
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel(label)
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`role:page:${id}:${page}`)
            .setDisabled(disabled)
    }
}
