import {
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    type ButtonInteraction,
} from 'discord.js'
import { ButtonInteractionHandler } from '#/services/interactions.service.ts'
import { blogService } from '#/services/blog.service.ts'
import { POST_STATUS } from '#/db/generated/enums.ts'

export default class extends ButtonInteractionHandler<'id'> {
    override regex = /^blog:post:(?<id>\d+)$/
    override async run(interaction: ButtonInteraction<'cached'>) {
        if (!blogService.role)
            return await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `Servicio no disponible`,
            })

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
                content: `Este post ya no está dispoible`,
            })
        }
        if (post.discord_user_id !== interaction.user.id) {
            return await interaction.reply({
                flags:
                    MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
                content: `Este post no te pertenece`,
            })
        }
        await interaction.deferUpdate()
        await blogService.publish(post)
    }

    static override async build({
        id,
        status = POST_STATUS.DRAFT,
    }: {
        id: string
        status?: POST_STATUS
    }): Promise<ButtonBuilder> {
        return new ButtonBuilder()
            .setLabel('Publicar')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(status === POST_STATUS.PUBLISHED)
            .setCustomId('blog:post:' + id)
    }
}
