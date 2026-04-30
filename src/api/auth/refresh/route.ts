import { BadRequestError } from '#/api/errors.ts'
import { envs, PRIVATE_KEY } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { hash } from '#/utils/encript.ts'
import { Router } from 'express'
import { SignJWT } from 'jose'

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

    // const expires_at = new Date(
    //     Temporal.Now.instant().add({
    //         days: 7,
    //     }).epochMilliseconds,
    // )

    // const session = await db.session.create({
    //     data: {
    //         expires_at,
    //         client_id,
    //         user_id,
    //     },
    // })

    // const access_token = await new SignJWT({
    //     session_id: session.id,
    //     sub: authCode.user_id,
    //     client_id,
    // })
    //     .setProtectedHeader({ alg: 'RS256' })
    //     .setIssuedAt()
    //     .setIssuer(envs.API_URL)
    //     .setAudience(client_id)
    //     .setExpirationTime('1d')
    //     .sign(PRIVATE_KEY)

    // const new_refresh_token = await new SignJWT({
    //     session_id: session.id,
    //     sub: authCode.user_id,
    //     client_id,
    // })
    //     .setProtectedHeader({ alg: 'RS256' })
    //     .setIssuedAt()
    //     .setIssuer(envs.API_URL)
    //     .setAudience(client_id)
    //     .setExpirationTime('7d')
    //     .sign(PRIVATE_KEY)

    // await db.session.update({
    //     where: { id: session.id },
    //     data: {
    //         refresh_token: await hash(refresh_token),
    //     },
    // })

    return res.json({
        access_token,
        token_type: 'Bearer',
        expires_in: 60 * 60 * 24,
        refresh_token,
    })
})

export default router
