import { Events, GuildMember, type PartialGuildMember } from 'discord.js'
import { client } from '#/client.ts'
import { getRank } from '#/utils/roles.ts'
import { envs } from '#/config.ts'
import { logger } from '#/logger.ts'
import type { Player } from '#/classes/player.ts'
import { playersService } from './players.service.ts'

async function checkRanks(member: GuildMember, cached: Player) {
    const currentRank = getRank([...member.roles.cache.values()])
    if (cached.role !== currentRank) {
        await cached.setRole(currentRank)
        logger.info(
            `[RANK SERVICE] Updated rank for ${cached.nickname} to ${currentRank}`,
        )
    }
}

async function handleRankUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
) {
    const minecraftLinked = playersService.players.cache
        .values()
        .find(m => m.discord_user_id === oldMember.id)
    if (minecraftLinked) {
        checkRanks(newMember, minecraftLinked)
    }
}

export async function initializeRankService() {
    logger.info('[RANK SERVICE] Inicializando')
    // Register event listener
    client.on(Events.GuildMemberUpdate, handleRankUpdate)
    // check all members on startup
    for (const cached of playersService.players.cache.values()) {
        const member = await client.guilds.cache
            .get(envs.DISCORD_GUILD_ID)!
            .members.fetch(cached.discord_user_id)
            .catch(() => null)
        if (member) {
            await checkRanks(member, cached)
        } else {
            await playersService.players.delete(cached.uuid)
        }
    }
}

export function unregisterRankService() {
    client.off(Events.GuildMemberUpdate, handleRankUpdate)
}
