import {
    ContainerBuilder,
    Embed,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SeparatorBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
    type ApplicationCommandDataResolvable,
    type ChatInputCommandInteraction,
} from 'discord.js'
import type { CommandInteractionHandler } from '#/services/interactions.service.ts'

/**
 * Genera un código de vinculación de sesión y lo persiste en la base de datos.
 * También intenta enviarlo por DM y responde de forma efímera al usuario.
 */
export default class implements CommandInteractionHandler {
    name = 'proyects'

    static async build(
        _params?: Record<string, unknown>,
    ): Promise<ApplicationCommandDataResolvable> {
        return new SlashCommandBuilder()
            .setName('proyects')
            .setNameLocalizations({
                'en-US': 'proyects',
                'es-ES': 'proyectos',
            })
            .setDescription('Manage the proyects in their channel')
            .setDescriptionLocalizations({
                'en-US': 'Manage the proyects in their channel',
                'es-ES': 'Gestiona los proyectos en su canal',
            })
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand(sub =>
                sub
                    .setName('create')
                    .setNameLocalizations({
                        'en-US': 'create',
                        'es-ES': 'crear',
                    })
                    .setDescription('Create a proyect')
                    .setDescriptionLocalizations({
                        'en-US': 'Create a proyect',
                        'es-ES': 'Crea un proyecto',
                    })
                    .addAttachmentOption(att =>
                        att
                            .setName('file')
                            .setNameLocalizations({
                                'en-US': 'file',
                                'es-ES': 'archivo',
                            })
                            .setDescription('Json file with the proyect info')
                            .setDescriptionLocalizations({
                                'en-US': 'Json file with the proyect info',
                                'es-ES':
                                    'Archivo json con la info del proyecto',
                            })
                            .setRequired(true),
                    )
                    .addAttachmentOption(att =>
                        att
                            .setName('banner')
                            .setNameLocalizations({
                                'en-US': 'banner',
                                'es-ES': 'banner',
                            })
                            .setDescription('Banner of the proyect')
                            .setDescriptionLocalizations({
                                'en-US': 'Banner of the proyect',
                                'es-ES': 'Banner del proyecto',
                            })
                            .setRequired(true),
                    ),
            )
    }

    async run(interaction: ChatInputCommandInteraction<'cached'>) {
        const file = interaction.options.getAttachment('file', true)
        console.log(file)

        if (!file.contentType?.includes('json')) {
            return interaction.reply({
                content: 'El file debe ser un json',
                flags: MessageFlags.Ephemeral,
            })
        }
        const req = await fetch(file.url)
        const json = (await req.json()) as any
        console.log(json)

        interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(json.general.name)
                    .setDescription(json.general.alias)
                    .addFields({
                        name: 'Clasificación',
                        value: 'Tipo:\nCategoría de mob:\nRecurso objetivo:\nDiseño base:',
                        inline: true,
                    })
                    .addFields({
                        name: '...',
                        value: `${json.classification.type}\n${json.classification.mob_category}\n${json.classification.objetive}\n${json.classification.based}`,
                        inline: true,
                    })
                    .addFields({
                        name: ' ',
                        value: ' ',
                    })
                    .addFields({
                        name: 'Clasificación',
                        value: 'Tipo:\nCategoría de mob:\nRecurso objetivo:\nDiseño base:',
                        inline: true,
                    })
                    .addFields({
                        name: '...',
                        value: `${json.classification.type}\n${json.classification.mob_category}\n${json.classification.objetive}\n${json.classification.based}`,
                        inline: true,
                    }),
            ],
        })
    }
}
