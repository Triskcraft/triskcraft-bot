import { BadRequestError, UnauthorizedError } from '#/api/errors.ts'
import { db } from '#/db/prisma.ts'
import { createJWT } from '#/utils/api.ts'
import { generateCodeVerifier, hash, weakHash } from '#/utils/encript.ts'
import { Router } from 'express'

const router = Router()

router.post('/', async (req, res) => {
    const { grant_type, redirect_uri, client_id, refresh_token } = req.body
    if (grant_type !== 'authorization_code') {
        throw new BadRequestError(
            'Invalid grant_type. Expected "authorization_code".',
        )
    }
    if (!client_id) {
        throw new BadRequestError('Missing parameter: client_id is required.')
    }
    if (!refresh_token) {
        throw new BadRequestError(
            'Missing parameter: refresh_token is required.',
        )
    }
    if (!redirect_uri) {
        throw new BadRequestError(
            'Missing parameter: redirect_uri is required.',
        )
    }

    const session = await db.session.findUnique({
        where: { refresh_token: weakHash(refresh_token) },
        select: {
            id: true,
            user_id: true,
        },
    })

    if (!session) {
        throw new UnauthorizedError()
    }

    const expires_at = new Date(
        Temporal.Now.instant().add({
            days: 7,
        }).epochMilliseconds,
    )

    const access_token = await createJWT({
        session_id: session.id,
        sub: session.user_id,
        client_id,
        aud: client_id,
    })

    const new_refresh_token = generateCodeVerifier()

    await db.session.update({
        where: { id: session.id },
        data: {
            expires_at,
            refresh_token: await hash(new_refresh_token),
        },
    })

    return res.json({
        access_token,
        token_type: 'Bearer',
        expires_in: 60 * 60 * 24,
        refresh_token: new_refresh_token,
    })
})

export default router
