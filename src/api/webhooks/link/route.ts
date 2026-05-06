import { client } from '#/client.ts'
import { envs } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { Router } from 'express'
import { getRank } from '#/utils/roles.ts'
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
        const [user] = await db.$transaction([
            db.player.upsert({
                where: { uuid: codedb.id },
                create: {
                    nickname,
                    uuid,
                    discord_user: {
                        connect: { id: codedb.discord_id },
                    },
                    rank: getRank([...discordMember.roles.cache.values()]),
                },
                update: {
                    discord_user: {
                        connect: { id: codedb.discord_id },
                    },
                    rank: getRank([...discordMember.roles.cache.values()]),
                    nickname,
                    status: PLAYER_STATUS.ACTIVE,
                },
                select: {
                    uuid: true,
                    nickname: true,
                    rank: true,
                    discord_user: {
                        select: {
                            id: true,
                            username: true,
                        },
                    },
                },
            }),
            db.linkCode.delete({
                where: { code },
            }),
        ])

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
