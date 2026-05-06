import { db } from '#/db/prisma.ts'
import { Router } from 'express'
import z from 'zod'
import {
    BadRequestError,
    InternalServerError,
    NotFoundError,
} from '#/api/errors.ts'
import { PrismaClientKnownRequestError } from '#/db/generated/internal/prismaNamespace.ts'

const router = Router()

const reqSchema = z.object({
    nickname: z.string().min(1, 'El nombre de usuario es obligatorio'),
})

/**
 * Registra los inicios de sesiones en el servidor
 * Recibe en el body un json serializado decrito en `reqSchema`
 * devuelve un 200 con un objeto vacio
 */
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
        data: { nickname },
    } = parsedBody

    try {
        await db.player.update({
            where: { nickname },
            data: {},
        })

        res.status(200).json({})
    } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
            throw new NotFoundError('Jugador no encontrado')
        }
        throw new InternalServerError('Error al registrar la sesión')
    }
})

export default router
