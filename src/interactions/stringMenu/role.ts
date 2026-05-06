import {
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
} from 'discord.js'
import { StringMenuHandler } from '#/services/interactions.service.ts'
import { roleService } from '#/services/roles.service.ts'
import { playersService } from '#/services/players.service.ts'

export default class extends StringMenuHandler {
    override regex = /^role:mcu$/

    static override async build({ selected }: { selected: string | null }) {
        const selectUserMenu = new StringSelectMenuBuilder()
            .setCustomId('role:mcu')
            .setMinValues(1)
            .setMaxValues(1)
            .setPlaceholder('Selecciona un usuario')

        if (playersService.players.cache.size > 0) {
            for (const {
                nickname,
                uuid,
            } of playersService.players.cache.values()) {
                selectUserMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(nickname)
                        .setValue(uuid)
                        .setDefault(uuid === selected),
                )
            }
        } else {
            selectUserMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('No hay registros de jugadores')
                    .setValue('0')
                    .setDefault(true),
            )
            selectUserMenu.setDisabled(true)
        }
        return selectUserMenu
    }

    override async run(interaction: StringSelectMenuInteraction<'cached'>) {
        await interaction.deferUpdate()
        const value = interaction.values[0]!
        await roleService.selectUser(value)
    }
}
