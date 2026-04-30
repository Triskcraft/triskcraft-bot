import { PLAYER_STATUS } from '#/db/generated/enums.ts'
import { db } from '#/db/prisma.ts'
import type { RequestHandler } from 'express'
import { type MinecraftPlayer } from '@triskcraft/api-types'

type includesQuery = 'roles' | 'medias' | 'rank' | 'description' | (string & {})
export const getPlayers: RequestHandler<
    { game: string },
    MinecraftPlayer[],
    null,
    { includes: includesQuery | includesQuery[] }
> = async (req, res) => {
    const { includes } = req.query

    const includeRoles =
        typeof includes === 'string' ?
            includes === 'roles'
        :   includes.includes('roles')

    const includeMedias =
        typeof includes === 'string' ?
            includes === 'medias'
        :   includes.includes('medias')

    const includeRank =
        typeof includes === 'string' ?
            includes === 'rank'
        :   includes.includes('rank')

    const roleIncludeJoin = {
        select: {
            role: {
                select: {
                    name: true,
                },
            },
        },
    } as const

    const members = await db.player.findMany({
        where: { status: PLAYER_STATUS.ACTIVE, user: { is: {} } },
        include: {
            user: {
                select: {
                    id: true,
                    rank: includeRank,
                },
            },
            medias:
                includeMedias ?
                    {
                        select: {
                            type: true,
                            url: true,
                        },
                    }
                :   false,
            linked_roles:
                includeRoles ? roleIncludeJoin : ({} as typeof roleIncludeJoin),
        },
    })
    const pobled = members.map(
        ({ digs, rank, linked_roles, medias, nickname, uuid, user }) => {
            const member: MinecraftPlayer = {
                digs,
                nickname,
                uuid,
                rank,
                user_id: user!.id,
            }
            if (includeMedias) {
                member.medias = medias
            }
            if (includeRoles) {
                member.roles = linked_roles.map(lr => lr.role.name)
            }
            if (includeRank) {
                member.rank = rank
            }
            return member
        },
    )
    return res.json(pobled)
}
