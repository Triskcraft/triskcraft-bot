import { db } from '#/db/prisma.ts'
import {
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
    type ModalSubmitInteraction,
} from 'discord.js'
import { ModalInteractionHandler } from '#/services/interactions.service.ts'
import { deployWebhookPanel } from '#/services/webhook.service.ts'

export default class extends ModalInteractionHandler {
    override regex = /^wh:delete:(?<id>.+)$/

    static override async build({ id }: { id: string }) {
        const token = await db.webhookToken.findUnique({
            where: { id },
        })
        if (!token) {
            return new ModalBuilder()
                .setCustomId('wh:delete:0')
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('Token no encontrado'),
                )
        }
        return new ModalBuilder()
            .setCustomId(`wh:delete:${id}`)
            .setTitle('Eliminar token ' + token.name)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `Creado el <t:${Math.floor(token.created_at.getTime() / 1000)}:d>\n` +
                        `por <@${token.discord_user_id}>\n` +
                        `permisos:\n` +
                        token.permissions.map(p => `- ${p}`).join('\n'),
                ),
            )
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Seguro quieres eliminar este token?')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('confirm')
                            .setRequired(true)
                            .setMinValues(1)
                            .setMaxValues(1)
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('Si')
                                    .setValue('y')
                                    .setDescription(
                                        'Estoy seguro, Esta acción no se puede deshacer',
                                    ),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('No')
                                    .setValue('n')
                                    .setDescription(
                                        'Deseo cancelar y conservarlo',
                                    ),
                            ),
                    ),
            )
    }

    override async run(interaction: ModalSubmitInteraction<'cached'>) {
        const [confirm] = interaction.fields.getStringSelectValues('confirm')
        if (confirm !== 'y') {
            return interaction.deferUpdate()
        }
        const wt = await db.webhookToken.delete({
            where: {
                id: this.regex.exec(interaction.customId)![1]!,
            },
        })
        await interaction.reply({
            content: `Token **${wt.name}** eliminado correctamente.`,
            flags: MessageFlags.Ephemeral,
        })
        await deployWebhookPanel()
    }
}
