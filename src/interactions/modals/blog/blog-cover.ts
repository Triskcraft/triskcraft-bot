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
    override regex = /^blog:cover:(?<id>\d+)$/

    static override async build({
        cover_image_url,
        id,
        title,
    }: {
        cover_image_url?: string | null
        id: string
        title: string
    }) {
        const input = new TextInputBuilder()
            .setCustomId('url')
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...')

        if (cover_image_url) {
            input.setValue(cover_image_url)
        }

        return new ModalBuilder()
            .setCustomId(`blog:cover:${id}`)
            .setTitle('Portada de ' + title)
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('URL de imagen')
                    .setDescription('La imagen se descargará y subirá a S3')
                    .setTextInputComponent(input),
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
        const imageUrl = interaction.fields.getTextInputValue('url')!
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

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
        })

        await blogService.changeCoverImage(post, imageUrl)

        await interaction.editReply({
            content: 'Portada actualizada',
        })
    }
}
