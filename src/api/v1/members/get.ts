import type { Request, Response } from 'express'
import { db } from '#/db/prisma.ts'
import { PLAYER_STATUS } from '#/db/generated/enums.ts'

/**
 * Endpoint que entrega el listado de miembros combinando la whitelist de
 * Minecraft con los datos complementarios almacenados en la base de datos.
 * Se aplica caching HTTP para evitar recalcular resultados en llamadas
 * repetidas.
 */

export async function getMembers(req: Request, res: Response) {
    const members = await db.player.findMany({
        where: { status: PLAYER_STATUS.ACTIVE },
        include: {
            medias: {
                select: {
                    type: true,
                    url: true,
                },
            },
            linked_roles: {
                select: {
                    role: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    })
    const pobled = members.map(
        ({
            description,
            digs,
            rank,
            linked_roles,
            medias,
            nickname: mc_name,
            uuid: mc_uuid,
        }) => {
            const roles = linked_roles.map(lr => lr.role.name)
            return {
                description,
                digs,
                mc_name,
                mc_uuid,
                medias,
                rank,
                roles,
            } satisfies Member
        },
    )
    res.set('Cache-Control', 'public, max-age=86400')
    res.json(pobled)
}

interface Member {
    mc_uuid: string
    mc_name: string
    rank: string
    description: string
    digs: number
    roles: string[]
    medias: {
        type: string
        url: string
    }[]
}
