import { BadRequestError } from '#/api/errors.ts'
import { db } from '#/db/prisma.ts'
import { createJWT } from '#/utils/api.ts'
import { generateCodeVerifier, verifyPKCE, weakHash } from '#/utils/encript.ts'
import { Router } from 'express'
import {
    type OAuthTokenRequest,
    type OAuthTokenResponse,
} from '@triskcraft/api-types'

const router = Router()

router.post<'/', null, OAuthTokenResponse, OAuthTokenRequest>(
    '/',
    async (req, res) => {
        const { grant_type, code, redirect_uri, client_id, code_verifier } =
            req.body
        if (grant_type !== 'authorization_code') {
            throw new BadRequestError(
                'Invalid grant_type. Expected "authorization_code".',
            )
        }
        if (!code) {
            throw new BadRequestError('Missing parameter: code is required.')
        }
        if (!client_id) {
            throw new BadRequestError(
                'Missing parameter: client_id is required.',
            )
        }
        if (!redirect_uri) {
            throw new BadRequestError(
                'Missing parameter: redirect_uri is required.',
            )
        }
        if (!code_verifier) {
            throw new BadRequestError(
                'Missing parameter: code_verifier is required (PKCE).',
            )
        }
        const authCode = await db.authorizationCode.findUnique({
            where: { code },
            select: {
                expires_at: true,
                code_challenge: true,
                user_id: true,
            },
        })
        if (!authCode) {
            throw new BadRequestError(
                'The provided authorization code is invalid or not found.',
            )
        }

        if (authCode.expires_at < new Date()) {
            await db.authorizationCode.delete({
                where: { code },
            })
            throw new BadRequestError(
                'The authorization code has expired. Please request a new one.',
            )
        }

        if (!verifyPKCE(code_verifier, authCode.code_challenge)) {
            throw new BadRequestError(
                'PKCE verification failed: code_verifier does not match code_challenge.',
            )
        }
        const { user_id } = await db.authorizationCode.delete({
            where: { code },
        })

        const expires_at = new Date(
            Temporal.Now.instant().add({
                days: 7,
            }).epochMilliseconds,
        )

        const refresh_token = generateCodeVerifier()

        const session = await db.session.create({
            data: {
                expires_at,
                client_id,
                user_id,
                refresh_token: weakHash(refresh_token),
            },
        })

        const access_token = await createJWT({
            session_id: session.id,
            sub: authCode.user_id,
            client_id,
            aud: client_id,
        })

        return res.json({
            access_token,
            token_type: 'Bearer',
            expires_in: 60 * 60 * 24,
            refresh_token,
        })
    },
)

export default router
