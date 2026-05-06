import {
    MessageFlags,
    SlashCommandBuilder,
    type ApplicationCommandDataResolvable,
    type ChatInputCommandInteraction,
} from 'discord.js'
import { db } from '#/db/prisma.ts'
import { logger } from '#/logger.ts'
import type { CommandInteractionHandler } from '#/services/interactions.service.ts'

/**
 * Genera un código de vinculación de sesión y lo persiste en la base de datos.
 * También intenta enviarlo por DM y responde de forma efímera al usuario.
 */
export default class implements CommandInteractionHandler {
    name = 'dis-session'
    async run(interaction: ChatInputCommandInteraction<'cached'>) {
        const code = Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(6, '0')
        const discord_id = interaction.user.id
        const username = interaction.user.username
        const discord_nickname = interaction.member?.displayName || username

        try {
            await db.linkCode
                .delete({
                    where: { discord_id },
                })
                .catch(() => {
                    /* ignore if not found */
                })
            // Se crea un nuevo código asegurando que exista la relación de usuario.
            await db.linkCode.create({
                data: {
                    discord_nickname,
                    code,
                    discord_user: {
                        connectOrCreate: {
                            create: {
                                id: discord_id,
                                username: interaction.user.username,
                            },
                            where: {
                                id: discord_id,
                            },
                        },
                    },
                },
            })

            logger.info(
                { code, discord_id, discord_nickname },
                'Código registrado en BD',
            )
        } catch (error) {
            logger.error(
                { err: error, discord_id },
                'Error al guardar código en BD',
            )
            await interaction.reply({
                content:
                    'Ocurrió un error al generar el código. Intenta nuevamente.',
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        try {
            await interaction.user.send({
                content: `Tu código es: **${code}**`,
            })
        } catch (error) {
            logger.warn(
                { err: error, userId: interaction.user.id },
                'No se pudo enviar DM',
            )
        }

        // Respuesta efímera para que solo el solicitante vea el resultado.
        await interaction.reply({
            content: `Tu código es: **${code}**`,
            flags: MessageFlags.Ephemeral,
        })
    }
    static async build(
        _params?: Record<string, unknown>,
    ): Promise<ApplicationCommandDataResolvable> {
        return new SlashCommandBuilder()
            .setName('dis-session')
            .setNameLocalizations({
                'en-US': 'dis-session',
                'es-ES': 'dis-sesion',
            })
            .setDescription(
                'Genera un código para vincular tu cuenta de Discord con la de Minecraft',
            )
            .setDescriptionLocalizations({
                'en-US':
                    'Generate a code to link your Discord account to your Minecraft account',
                'es-ES':
                    'Genera un código para vincular tu cuenta de Discord con la de Minecraft',
            })
    }
}
