import { client } from '#/client.ts'
import { envs } from '#/config.ts'
import {
    ActionRowBuilder,
    ButtonBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
} from 'discord.js'
import {
    ButtonStyle,
    ComponentType,
    MessageFlags,
    type SendableChannels,
} from 'discord.js'
import { logger } from '#/logger.ts'
import { db } from '#/db/prisma.ts'

const PANNEL_NAME = '# 🔐 **Panel de Webhooks**'

export async function deployWebhookPanel() {
    const channel = await client.channels.fetch(envs.PANEL_CHANNEL_ID)
    if (!channel) {
        return logger.warn('Canal de panel no encontrado')
    }
    if (!channel.isSendable()) {
        return logger.warn('El canal de pannel no está disponible')
    }
    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                PANNEL_NAME +
                    '\nAdministra los tokens usados por la web y el servidor de Minecraft.',
            ),
        )
        .addSeparatorComponents(new SeparatorBuilder())

    const tokens = await db.webhookToken.findMany({
        orderBy: { created_at: 'desc' },
    })
    for (const token of tokens) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `- **${token.name}**\n` +
                            `Creado el <t:${Math.floor(token.created_at.getTime() / 1000)}:d> por <@${token.discord_user_id}>\n` +
                            `Permisos: ${new Intl.ListFormat('es', {
                                style: 'long',
                                type: 'conjunction',
                            }).format(token.permissions.map(p => `\`${p}\``))}`,
                    ),
                )
                .setButtonAccessory(
                    new ButtonBuilder()
                        .setLabel('Eliminar')
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId(`wh:delete:${token.id}`),
                ),
        )
    }
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('➕ Crear token')
                .setStyle(ButtonStyle.Primary)
                .setCustomId('wh:add'),
        ),
    )
    const whpmid = await db.state.findUnique({
        where: { key: 'wh_panel_message_id' },
        select: { value: true },
    })
    if (whpmid) {
        const anc = await channel.messages.fetch(whpmid.value).catch(() => null)
        if (anc) {
            await anc.edit({
                components: [container],
            })
        } else {
            await checkPinned(channel, container)
        }
    } else {
        await checkPinned(channel, container)
    }
}

async function checkPinned(
    channel: SendableChannels,
    container: ContainerBuilder,
) {
    const pinned = await channel.messages.fetchPins()
    const my = pinned.items.find(msg => {
        const container = msg.message.components[0]
        if (!container) return false
        if (container.type !== ComponentType.Container) return false
        const textDisplay = container.components[0]
        if (!textDisplay) return false
        if (textDisplay.type !== ComponentType.TextDisplay) return false
        return (
            msg.message.author.id === client.user.id &&
            textDisplay.content.includes(PANNEL_NAME)
        )
    })
    let nid: string
    if (my) {
        await my.message.edit({
            components: [container],
        })
        nid = my.message.id
    } else {
        const nmsg = await channel.send({
            components: [container],
            flags:
                MessageFlags.IsComponentsV2 |
                MessageFlags.SuppressNotifications,
        })
        nid = nmsg.id
        await nmsg.pin()
    }
    await db.state.upsert({
        where: { key: 'wh_panel_message_id' },
        update: { value: nid },
        create: { key: 'wh_panel_message_id', value: nid },
    })
}
