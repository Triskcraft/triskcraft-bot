import { envs } from '#/config.ts'
import { render } from '#/utils/html.ts'
import { ErrorCard } from '#/web/components/error-card.ts'
import { Layout } from '#/web/components/layout.ts'
import { Router } from 'express'
import cookieParser from 'cookie-parser'
import {
    getOauthCtxCookie,
    type DiscordAccessTokenResponse,
} from '#/utils/api.ts'

const router = Router()

router.get('/', cookieParser(), async (req, res) => {
    if (typeof req.query.code !== 'string') {
        return res.redirect('/oauth/authorize')
    }

    const oauthCtx = getOauthCtxCookie(req)
    if (
        !oauthCtx ||
        typeof req.query.state !== 'string' ||
        oauthCtx.discord_state !== req.query.state
    ) {
        res.clearCookie('oauth_ctx', { path: '/' })

        return render(
            res,
            Layout({
                children: ErrorCard({
                    title: 'Invalid Request',
                    message: 'Invalid OAuth context. Please try again.',
                }),
            }),
        )
    }

    const params = new URLSearchParams({
        client_id: envs.DISCORD_CLIENT_ID,
        client_secret: envs.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: envs.DISCORD_REDIRECT_URI,
    })
    const request = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
    })
    if (!request.ok) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    title: 'Discord Login Failed',
                    message:
                        'Discord rejected the authorization code. Please try again.',
                }),
            }),
        )
    }
    const response = (await request.json()) as DiscordAccessTokenResponse
    res.cookie('discord_access', JSON.stringify(response), {
        httpOnly: true,
        secure: envs.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: response.expires_in * 1000,
    })

    const oauthParams = { ...oauthCtx }
    delete oauthParams.discord_state

    res.clearCookie('oauth_ctx', { path: '/' })
    res.redirect(`/oauth/authorize?${new URLSearchParams(oauthParams)}`)
})

export default router
