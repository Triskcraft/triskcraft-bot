import { ForbiddenError, InternalServerError, UnauthorizedError } from '#/api/errors.ts'
import { db } from '#/db/prisma.ts'
import { verifyToken } from '#/utils/encript.ts'
import { parseScopes } from '#/utils/api.ts'
import { Router } from 'express'

const router = Router()

router.post('/', async (req, res) => {
    const { authorization } = req.headers
    if (!authorization) {
        throw new UnauthorizedError()
    }
    if (!/Bearer\s.+/.test(authorization)) {
        throw new UnauthorizedError()
    }
    const token = authorization.replace('Bearer ', '')

    const verify = await verifyToken<{
        sub: string
        session_id: string
        client_id: string
        aud: string
        exp?: number
        iss?: string
        scope: string
    }>(token)

    if (!verify) {
        throw new UnauthorizedError()
    }

    const { payload } = verify
    const scopes = parseScopes(payload.scope)

    if (!scopes.length) {
        throw new ForbiddenError('Missing required scope.')
    }

    const user = await db.user.findUnique({
        where: {
            id: verify.payload.sub,
        },
        select: {
            created_at: true,
            rank: scopes.includes('identify'),
            discord_user: {
                select: {
                    id: true,
                    username: scopes.includes('identify'),
                },
            },
            mc_player: {
                select: {
                    uuid: true,
                    nickname: true,
                    digs: true,
                    rank: true,
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
            },
        },
    })

    if (!user) {
        throw new InternalServerError()
    }

    const response: Record<string, unknown> = {}

    if (scopes.includes('openid')) {
        response.sub = payload.sub
        response.iss = payload.iss
        response.aud = payload.aud
        response.exp = payload.exp
    }

    if (scopes.includes('identify')) {
        response.id = payload.sub
        response.rank = user.rank
        response.created_at = user.created_at.getTime()
        response.discord_user = user.discord_user
    }

    if (scopes.includes('minecraft')) {
        response.mc_player =
            user.mc_player ?
                {
                    digs: user.mc_player.digs,
                    nickname: user.mc_player.nickname,
                    uuid: user.mc_player.uuid,
                    rank: user.mc_player.rank,
                    user_id: payload.sub,
                    medias: user.mc_player.medias,
                    roles: user.mc_player.linked_roles.map(lr => lr.role.name),
                }
            :   null
    }

    return res.json(response)
})

export default router
