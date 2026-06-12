import { PUBLIC_KEY, type WebhookPermission } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import type { NextFunction, Request, Response } from 'express'
import { jwtVerify } from 'jose'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { decrypt } from '#/utils/encript.ts'
import {
    BadRequestError,
    ForbiddenError,
    UnauthorizedError,
} from '#/api/errors.ts'

const MAX_DRIFT_MS = 15_000

export function webhookAuth(permissions: WebhookPermission[]) {
    return async function webhookAuth(
        req: Request,
        res: Response,
        next: NextFunction,
    ) {
        const tokenString = req.headers.authorization?.replace('Bearer ', '')
        if (!tokenString) {
            throw new UnauthorizedError()
        }

        const timestamp = Number(req.headers['x-timestamp'])
        if (Number.isNaN(timestamp)) {
            throw new BadRequestError('Invalid timestamp')
        }

        const now = Date.now()
        if (Math.abs(now - timestamp * 1000) > MAX_DRIFT_MS) {
            throw new BadRequestError('Expired')
        }

        const signature = req.headers['x-signature']
        if (!signature) {
            throw new BadRequestError('Missing signature')
        }

        if (typeof signature !== 'string') {
            throw new BadRequestError('Invalid signature')
        }

        const jwtPayload = await jwtVerify<{
            id: string
            user: string
            permissions: string[]
            name: string
            iat: number
        }>(tokenString, PUBLIC_KEY).catch(() => null)
        if (!jwtPayload) {
            throw new UnauthorizedError()
        }
        if (
            !permissions.every(p => jwtPayload.payload.permissions.includes(p))
        ) {
            throw new ForbiddenError()
        }
        const tokendb = await db.webhookToken.findUnique({
            where: { id: jwtPayload.payload.id },
        })
        if (!tokendb) {
            throw new UnauthorizedError()
        }
        const secret = decrypt(tokendb.secret)
        const rawBody = req.body.toString('utf8')
        const signedPayload = `${timestamp}.${rawBody}`

        const expected = createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex')

        const sigBuffer = Buffer.from(signature, 'hex')
        const expBuffer = Buffer.from(expected, 'hex')

        if (
            sigBuffer.length !== expBuffer.length ||
            !timingSafeEqual(sigBuffer, expBuffer)
        ) {
            throw new UnauthorizedError('Invalid signature')
        }

        req.user = {
            id: jwtPayload.payload.user,
        }
        next()
    }
}
