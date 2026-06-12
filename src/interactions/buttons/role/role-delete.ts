import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#/services/interactions.service.ts'
import { roleService } from '#/services/roles.service.ts'

export default class RoleDelete extends ButtonInteractionHandler<'id' | 'q'> {
    override regex = /^role:delete:(?<id>\d+):(?<q>q|y|n+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        const parser = this.parser(interaction.customId)
        const id = parser.get('id')
        const q = parser.get('q') as 'q' | 'y' | 'n'

        const role = roleService.roles.cache.get(id)
        if (!role) return await interaction.deferUpdate()

        switch (q) {
            case 'q': {
                return await interaction.update({
                    components: [
                        new ContainerBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `# ${role.name}\nEstas seguro de eliminar este rol?\nEsta acción no se puede deshacer`,
                                ),
                            )
                            .addActionRowComponents(
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                    await RoleDelete.build({
                                        id: role.id,
                                        q: 'n',
                                    }),
                                    await RoleDelete.build({
                                        id: role.id,
                                        q: 'y',
                                    }),
                                ),
                            ),
                    ],
                })
            }
            case 'n': {
                await interaction.deferUpdate()
                return await roleService.renderPannel()
            }
            case 'y': {
                await roleService.roles.delete(id)
                return await roleService.selectRole(null)
            }
            default: {
                q satisfies never
            }
        }
    }
    static override async build({
        id,
        q = 'q',
    }: {
        id: string
        q?: 'q' | 'y' | 'n'
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel(
                q === 'q' ? 'Eliminar'
                : q === 'n' ? 'No, deseo conservarlo'
                : 'Si, quiero eliminarlo',
            )
            .setStyle(q === 'n' ? ButtonStyle.Success : ButtonStyle.Danger)
            .setCustomId(`role:delete:${id}:${q}`)
            .setDisabled(id === roleService.defaultRoleId)
    }
}
