import { client } from '#/client.ts'
import { envs } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { Router } from 'express'
import z from 'zod'
import {
    BadRequestError,
    InternalServerError,
    NotFoundError,
} from '#/api/errors.ts'
import { PLAYER_STATUS } from '#/db/generated/enums.ts'

const router = Router()

const reqSchema = z.object({
    nickname: z.string().min(1, 'El nombre de usuario es obligatorio'),
    code: z.string().min(1, 'El código es obligatorio'),
})

router.post('/', async (req, res) => {
    let jsonbody: unknown
    try {
        jsonbody = JSON.parse(req.body.toString('utf-8'))
    } catch {
        throw new BadRequestError('Invalid JSON')
    }
    const parsedBody = reqSchema.safeParse(jsonbody)
    if (!parsedBody.success) {
        throw new BadRequestError('Invalid payload', {
            details: z.treeifyError(parsedBody.error),
        })
    }

    const {
        data: { code, nickname },
    } = parsedBody

    const codedb = await db.linkCode.findUnique({
        where: { code },
    })

    if (!codedb) {
        throw new NotFoundError('Código no encontrado')
    }

    const discordMember = await client.guilds.cache
        .get(envs.DISCORD_GUILD_ID)!
        .members.fetch(codedb.discord_id)

    if (!discordMember) {
        throw new BadRequestError('discord_id no encontrado')
    }
    const uuid = await nicknameToUUID(nickname)
    if (!uuid) {
        throw new BadRequestError('nickname no encontrado')
    }

    try {
        const user = await db.$transaction(async transaction => {
            const player = await transaction.player.upsert({
                where: { uuid },
                create: {
                    nickname,
                    uuid,
                },
                update: {
                    nickname,
                    status: PLAYER_STATUS.ACTIVE,
                },
                select: {
                    uuid: true,
                },
            })
            await transaction.user.upsert({
                where: {
                    discord_user_id: codedb.discord_id,
                },
                create: {
                    discord_user: {
                        connect: { id: codedb.discord_id },
                    },
                    mc_player: {
                        connect: { uuid: player.uuid },
                    },
                },
                update: {
                    mc_player: {
                        connect: { uuid: player.uuid },
                    },
                },
            })
            await transaction.linkCode.delete({
                where: { code },
            })
            return player
        })

        if (!user) {
            throw new InternalServerError('Error al vincular la cuenta')
        }

        res.status(200).json(user)
    } catch {
        throw new InternalServerError('Error al vincular la cuenta')
    }
})

export default router

async function nicknameToUUID(nickname: string) {
    const req = await fetch(
        `https://api.mojang.com/users/profiles/minecraft/${nickname}`,
    )
    if (req.status !== 200) return null
    const { id } = (await req.json()) as {
        id: string
        name: string
    }
    return id
}
