import { InternalServerError, UnauthorizedError } from '#/api/errors.ts'
import { db } from '#/db/prisma.ts'
import { verifyToken } from '#/utils/encript.ts'
import { Router } from 'express'

const router = Router()

router.post('/', async (req, res) => {
    const { authorization } = req.headers
    if (!authorization) {
        throw new UnauthorizedError()
    }
    if (/Bearer\s.+/.test(authorization)) {
        throw new UnauthorizedError()
    }
    const token = authorization.replace('Bearer ', '')

    const verify = await verifyToken<{
        sub: string
        session_id: string
        client_id: string
    }>(token)

    if (!verify) {
        throw new UnauthorizedError()
    }

    const { payload } = verify

    const user = await db.user.findUnique({
        where: {
            id: verify.payload.sub,
        },
        select: {
            rank: true,
            created_at: true,
            discord_user: {
                select: {
                    id: true,
                    username: true,
                },
            },
            mc_player: {
                select: {
                    uuid: true,
                    nickname: true,
                },
            },
        },
    })

    if (!user) {
        throw new InternalServerError()
    }

    return res.json({
        id: payload.sub,
        rank: user.rank,
        created_at: user.created_at.getTime(),
        discord_user: user.discord_user,
        mc_player: user.mc_player,
    })
})

export default router
