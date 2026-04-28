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
        return res.redirect('/auth/authorize')
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
    const response = (await request.json()) as DiscordAccessTokenResponse
    res.cookie('discord_access', JSON.stringify(response), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: response.expires_in * 1000,
    })
    const oauthCtx = getOauthCtxCookie(req)
    if (!oauthCtx) {
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
    res.redirect(`/auth/authorize?${new URLSearchParams(oauthCtx)}`)
})

export default router
