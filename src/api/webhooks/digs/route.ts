import { db } from '#/db/prisma.ts'
import { Router } from 'express'
import { PrismaClientKnownRequestError } from '#/db/generated/internal/prismaNamespace.ts'
import z from 'zod'
import { logger } from '#/logger.ts'
import { BadRequestError } from '#/api/errors.ts'
import { PLAYER_STATUS } from '#/db/generated/enums.ts'

const router = Router()

const reqSchema = z.array(
    z.union([
        z.object({
            nickname: z.string().min(1, 'El nombre de usuario es obligatorio'),
            uuid: z
                .string()
                .min(1, 'El id de usuario es obligatorio')
                .optional(),
            digs: z.number().min(0, 'La cantidad de digs debe ser positiva'),
        }),
        z.object({
            nickname: z
                .string()
                .min(1, 'El nombre de usuario es obligatorio')
                .optional(),
            uuid: z.string().min(1, 'El id de usuario es obligatorio'),
            digs: z.number().min(0, 'La cantidad de digs debe ser positiva'),
        }),
    ]),
)

const queue = new Map<string, { kind: 'uuid' | 'nickname'; digs: number }>()

router.post('/', async (req, res) => {
    let jsonbody: unknown
    try {
        jsonbody = JSON.parse(req.body.toString('utf-8'))
    } catch {
        throw new BadRequestError('Invalid JSON')
    }
    const parsedBody = reqSchema.safeParse(jsonbody)
    if (!parsedBody.success) {
        return res.status(400).json({
            error: 'Invalid payload',
            details: z.treeifyError(parsedBody.error),
        })
    }

    const { data: body } = parsedBody

    for (const entry of body) {
        if (entry.digs < 0) continue
        queue.set(entry.uuid ?? entry.nickname!, {
            kind: entry.uuid ? 'uuid' : 'nickname',
            digs: entry.digs,
        })
    }
})

setInterval(async () => {
    const copy = new Map(queue)
    queue.clear()
    for (const [identifier, { kind, digs }] of copy) {
        if (digs < 0) continue
        try {
            await db.player.update({
                where:
                    kind === 'uuid' ?
                        { uuid: identifier, status: PLAYER_STATUS.ACTIVE }
                    :   { nickname: identifier, status: PLAYER_STATUS.ACTIVE },
                data: { digs },
            })
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                if (error.code !== 'P2025') {
                    logger.error(error, 'Error updating digs')
                }
            } else {
                logger.error(error, 'Error updating digs')
            }
        }
    }
}, 10_000)

export default router
