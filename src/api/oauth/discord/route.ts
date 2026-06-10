import { envs } from '#/config.ts'
import { render } from '#/utils/html.ts'
import { ErrorCard } from '#/web/components/error-card.ts'
import { Layout } from '#/web/components/layout.ts'
import { Router } from 'express'
import cookieParser from 'cookie-parser'
import type { APIUser } from 'discord.js'
import {
    getOauthCtxCookie,
    type DiscordAccessTokenResponse,
} from '#/utils/api.ts'
import { logger } from '#/logger.ts'

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

    const userRequest = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
            Authorization: `Bearer ${response.access_token}`,
        },
    })
    const guildsRequest = await fetch(
        'https://discord.com/api/v10/users/@me/guilds?limit=200',
        {
            headers: {
                Authorization: `Bearer ${response.access_token}`,
            },
        },
    )

    if (!userRequest.ok || !guildsRequest.ok) {
        logger.error(
            {
                userStatus: userRequest.status,
                guildsStatus: guildsRequest.status,
            },
            'No se pudo consultar el usuario o sus gremios durante OAuth',
        )

        return discordLoginError(
            res,
            'Discord did not provide the account information required to complete the login.',
        )
    }

    const discordUser = (await userRequest.json()) as APIUser
    const discordGuilds = (await guildsRequest.json()) as { id: string }[]
    const isGuildMember = discordGuilds.some(
        guild => guild.id === envs.DISCORD_GUILD_ID,
    )

    if (!isGuildMember) {
        const joinRequest = await fetch(
            `https://discord.com/api/v10/guilds/${envs.DISCORD_GUILD_ID}/members/${discordUser.id}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bot ${envs.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    access_token: response.access_token,
                }),
            },
        )

        if (!joinRequest.ok) {
            logger.error(
                {
                    status: joinRequest.status,
                    userId: discordUser.id,
                    guildId: envs.DISCORD_GUILD_ID,
                },
                'No se pudo unir al usuario al gremio durante OAuth',
            )

            return discordLoginError(
                res,
                'Discord could not add your account to the server. Please try again.',
            )
        }
    }

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

function discordLoginError(res: Parameters<typeof render>[0], message: string) {
    return render(
        res,
        Layout({
            children: ErrorCard({
                title: 'Discord Login Failed',
                message,
            }),
        }),
    )
}
