import {
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ModalSubmitInteraction,
} from 'discord.js'
import { ModalInteractionHandler } from '#/services/interactions.service.ts'
import { blogService } from '#/services/blog.service.ts'

export default class extends ModalInteractionHandler<'id'> {
    override regex = /^blog:title:(?<id>\d+)$/

    static override async build({ title, id }: { title: string; id: string }) {
        return new ModalBuilder()
            .setCustomId(`blog:title:${id}`)
            .setTitle('Renombrar ' + title)
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Nuevo nombre del post')
                    .setDescription(
                        'Máximo 100 caracteres. Se puede editar después',
                    )
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setRequired(true)
                            .setStyle(TextInputStyle.Short)
                            .setMaxLength(100)
                            .setValue(title),
                    ),
            )
    }

    override async run(interaction: ModalSubmitInteraction<'cached'>) {
        if (!blogService.role) {
            return await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `Servicio no disponible`,
            })
        }

        if (!interaction.member.roles.cache.has(blogService.role.id)) {
            return await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `No tienes el rol ${blogService.role}`,
            })
        }

        const id = this.parser(interaction.customId).get('id')
        const title = interaction.fields.getTextInputValue('name')!
        const post = blogService.posts.cache.get(id)

        if (!post) {
            return await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `Este post ya no está disponible`,
            })
        }

        if (post.discord_user_id !== interaction.user.id) {
            return await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `Este post no te pertenece`,
            })
        }

        await blogService.changeTitle(post, title)

        return await interaction.deferUpdate()
    }
}
