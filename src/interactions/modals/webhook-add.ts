import { db } from '#/db/prisma.ts'
import {
    EmbedBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ModalSubmitInteraction,
} from 'discord.js'
import { SignJWT } from 'jose'
import { randomBytes } from 'node:crypto'
import { encrypt } from '#/utils/encript.ts'
import { PRIVATE_KEY, WEBHOOK_PERMISSIONS } from '#/config.ts'
import { ModalInteractionHandler } from '#/services/interactions.service.ts'
import { deployWebhookPanel } from '#/services/webhook.service.ts'
import type { WebhookToken } from '#/db/generated/client.ts'
import { PrismaClientKnownRequestError } from '#/db/generated/internal/prismaNamespace.ts'
import { logger } from '#/logger.ts'

const alg = 'RS256'

const Permissions = {
    [WEBHOOK_PERMISSIONS.DIGS]: 'Webhook de digs',
    [WEBHOOK_PERMISSIONS.LINK]: 'Linkear cuentas de discord y minecraft',
    [WEBHOOK_PERMISSIONS.JOIN]: 'Registra los inicios de sesión',
}

export default class extends ModalInteractionHandler {
    override regex = /^wh:add$/

    static override async build({ error }: { error?: string } = {}) {
        const modal = new ModalBuilder()
            .setCustomId('wh:add')
            .setTitle('Create a Webhook Token')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Permisos')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('permissions')
                            .setRequired(true)
                            .setMinValues(1)
                            .setMaxValues(Object.values(Permissions).length)
                            .addOptions(
                                Object.entries(Permissions).map(
                                    ([name, description]) =>
                                        new StringSelectMenuOptionBuilder()
                                            .setLabel(name)
                                            .setValue(name)
                                            .setDescription(description),
                                ),
                            ),
                    ),
                new LabelBuilder()
                    .setLabel('Nombre')
                    .setDescription('Para identificar el token')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setRequired(true)
                            .setStyle(TextInputStyle.Short),
                    ),
            )
        if (error) {
            modal.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(error),
            )
        }
        return modal
    }

    override async run(interaction: ModalSubmitInteraction<'cached'>) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        })
        const secret = randomBytes(32).toString('hex')
        const permissions =
            interaction.fields.getStringSelectValues('permissions')
        const name = interaction.fields.getTextInputValue('name')
        let wt: WebhookToken
        let userId: string
        try {
            const user = await db.user.upsert({
                where: {
                    discord_user_id: interaction.user.id,
                },
                create: {
                    discord_user: {
                        connectOrCreate: {
                            create: {
                                id: interaction.user.id,
                                username: interaction.user.username,
                            },
                            where: {
                                id: interaction.user.id,
                            },
                        },
                    },
                },
                update: {
                    discord_user: {
                        update: {
                            username: interaction.user.username,
                        },
                    },
                },
            })
            userId = user.id
            wt = await db.webhookToken.create({
                data: {
                    secret: encrypt(secret).payload,
                    permissions: [...permissions],
                    name,
                    user: {
                        connect: {
                            id: user.id,
                        },
                    },
                },
            })
            logger.info(
                `[WEBHOOK SERVICE] Token con permisos ${new Intl.ListFormat(
                    'es',
                    {
                        style: 'long',
                        type: 'conjunction',
                    },
                ).format(permissions)} creado por ${interaction.user.username}`,
            )
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                if (error.code === 'P2002')
                    return await interaction.editReply({
                        content: 'Ese nombre ya está en uso',
                    })
            }
            return await interaction.editReply({
                content: 'Ha ocurrido un error al crear el token',
            })
        }

        const jwt = await new SignJWT({
            id: wt.id,
            user: userId,
            permissions,
            name,
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .sign(PRIVATE_KEY)

        const embedDescription = [
            'Estas son tus credenciales:',
            'Se mostrarán por única vez y no se pueden volver a recuperar',
            'Asegurate de no revelarlas',
            'Si tienes la sospecha de que han sido reveladas por favor eliminalas y genera una nueva',
        ].join('\n- ')
        const embed = new EmbedBuilder()
            .setDescription(embedDescription)
            .addFields(
                {
                    name: 'Secret',
                    value: secret,
                },
                {
                    name: 'Token',
                    value: jwt,
                },
            )
        interaction.editReply({
            embeds: [embed],
        })
        await deployWebhookPanel()
    }
}
