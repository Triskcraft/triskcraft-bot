import {
    MessageFlags,
    ModalBuilder,
    type ModalSubmitInteraction,
} from 'discord.js'
import { inactivityService } from '#/services/inactivity.service.ts'
import { formatForUser, parseUserTime } from '#/utils/time.ts'
import { DateTime } from 'luxon'
import { ModalInteractionHandler } from '#/services/interactions.service.ts'

export default class extends ModalInteractionHandler {
    override regex = /^inactivity:.$/

    static override async build() {
        return new ModalBuilder()
    }

    override async run(interaction: ModalSubmitInteraction<'cached'>) {
        const duration = interaction.fields.getTextInputValue('duration')
        const until = interaction.fields.getTextInputValue('until')

        // Ambos campos son opcionales, pero al menos uno debe contener valor.
        if (!duration && !until) {
            await interaction.reply({
                content: 'Debes completar al menos uno de los campos.',
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        try {
            const reference = until || duration
            const { until: untilDate } = parseUserTime(reference)
            if (untilDate.toMillis() <= DateTime.utc().toMillis()) {
                await interaction.reply({
                    content:
                        'La fecha indicada ya pasó. Por favor ingresa un valor en el futuro.',
                    flags: MessageFlags.Ephemeral,
                })
                return
            }
            await inactivityService.markInactivity(
                interaction.guildId,
                interaction.member,
                untilDate.toJSDate(),
                interaction.customId,
            )
            // Respuesta privada para evitar spam en el canal de interacción.
            await interaction.reply({
                content: `Registramos tu inactividad hasta ${formatForUser(untilDate.toJSDate())}.`,
                flags: MessageFlags.Ephemeral,
            })
        } catch (error) {
            await interaction.reply({
                content: (error as Error).message,
                flags: MessageFlags.Ephemeral,
            })
        }
    }
}
