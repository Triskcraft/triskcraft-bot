import {
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#/services/interactions.service.ts'
import { blogService } from '#/services/blog.service.ts'
import blogTitle from '#/interactions/modals/blog/blog-title.ts'

export default class extends ButtonInteractionHandler<'id'> {
    override regex = /^blog:title:(?<id>\d+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
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

        await interaction.showModal(
            await blogTitle.build({ title: post.title, id }),
        )
    }
    static override async build({
        id,
    }: {
        id: string
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('Cambiar el título')
            .setStyle(ButtonStyle.Primary)
            .setCustomId('blog:title:' + id)
    }
}
