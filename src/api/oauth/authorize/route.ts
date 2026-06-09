import { envs, PRIVATE_KEY } from '#/config.ts'
import { Permissions } from '#/classes/permissions.ts'
import { db } from '#/db/prisma.ts'
import {
    OAUTH_SCOPES,
    getSession,
    parseScopes,
    refreshDiscordToken,
    serializeScopes,
} from '#/utils/api.ts'
import { render } from '#/utils/html.ts'
import { ErrorCard } from '#/web/components/error-card.ts'
import { Layout } from '#/web/components/layout.ts'
import { Router, type Response, type Request } from 'express'
import cookieParser from 'cookie-parser'
import type { APIUser } from 'discord.js'
import { SignJWT } from 'jose'
import { randomBytes } from 'node:crypto'

const router = Router()

router.get('/', cookieParser(), async (req, res) => {
    const {
        response_type,
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method,
        scope,
        state,
    } = req.query

    if (response_type !== 'code') {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Invalid response_type. Only "code" is supported.',
                }),
            }),
        )
    }
    if (!client_id) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Missing client_id.',
                }),
            }),
        )
    }
    if (typeof client_id !== 'string') {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Invalid client_id.',
                }),
            }),
        )
    }
    if (!redirect_uri) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Missing redirect_uri.',
                }),
            }),
        )
    }
    if (typeof redirect_uri !== 'string') {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Invalid redirect_uri.',
                }),
            }),
        )
    }
    if (!code_challenge) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Missing code_challenge.',
                }),
            }),
        )
    }
    if (typeof code_challenge !== 'string') {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Invalid code_challenge.',
                }),
            }),
        )
    }
    if (code_challenge_method !== 'S256') {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message:
                        'Invalid code_challenge_method. Only "S256" is supported.',
                }),
            }),
        )
    }

    const client = await db.client.findUnique({
        where: { id: client_id },
        select: {
            id: true,
            redirect_uris: true,
            scopes: true,
        },
    })

    if (!client) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message:
                        'Invalid client_id. No client found with the provided client_id.',
                }),
            }),
        )
    }

    if (!client.redirect_uris.includes(redirect_uri)) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message:
                        'Invalid redirect_uri. The provided redirect_uri is not registered for the given client_id.',
                }),
            }),
        )
    }

    const requestedScopes = parseScopes(scope)
    const requestedScopeNames = new Set(
        typeof scope === 'string' ?
            scope
                .split(/\s+/)
                .map(s => s.trim())
                .filter(Boolean)
        :   [],
    )

    if (requestedScopes.length !== requestedScopeNames.size) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Invalid scope.',
                }),
            }),
        )
    }

    const allowedScopes =
        client.scopes?.length > 0 ? client.scopes : [...OAUTH_SCOPES]
    const invalidClientScopes = requestedScopes.filter(
        scope => !allowedScopes.includes(scope),
    )

    if (invalidClientScopes.length) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message:
                        'Invalid scope. The client is not allowed to request one or more scopes.',
                }),
            }),
        )
    }
    const serializedScopes = serializeScopes(requestedScopes)

    const session = await getSession(req)

    if (!session.discord) {
        // login
        return discordLogin(req, res)
    }

    const buffer = 1000 * 60 * 60 * 24 // 1 dia

    const expires_at = Date.now() + session.discord.expires_in * 1000

    if (Date.now() > expires_at - buffer) {
        const newDiscord = await refreshDiscordToken(
            session.discord.refresh_token,
        )
        if (!newDiscord) {
            return discordLogin(req, res)
        }
        session.discord = newDiscord
    }
    const request = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
            Authorization: `Bearer ${session.discord.access_token}`,
        },
    })
    const discordUser = (await request.json()) as APIUser
    const roleName =
        discordUser.id === envs.SUPER_USER_DISCORD_ID ? 'super' : 'user'
    const rolePermissions = roleName === 'super' ? Permissions.Flags.ADMIN : 0n

    const user = await db.user.upsert({
        create: {
            discord_user: {
                connectOrCreate: {
                    where: { id: discordUser.id },
                    create: {
                        id: discordUser.id,
                        username: discordUser.username,
                    },
                },
            },
            linked_roles: {
                create: {
                    role: {
                        connectOrCreate: {
                            where: { name: roleName },
                            create: {
                                name: roleName,
                                permissions: rolePermissions,
                            },
                        },
                    },
                },
            },
        },
        where: {
            discord_user_id: discordUser.id,
        },
        update: {
            discord_user: {
                update: {
                    username: discordUser.username,
                },
            },
        },
    })

    const jwt = await new SignJWT({
        sub: user.id,
        scope: serializedScopes,
    })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setIssuer(envs.API_URL)
        .setAudience(client_id)
        .setExpirationTime('7d')
        .sign(PRIVATE_KEY)

    res.cookie('session', jwt, {
        httpOnly: true,
        secure: envs.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
    })

    const code = randomBytes(32).toString('hex')

    await db.authorizationCode.create({
        data: {
            code,
            user_id: user.id,
            redirect_uri,
            code_challenge,
            expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 min
            client_id: client.id,
            scope: serializedScopes,
        },
    })

    const url = new URL(redirect_uri)

    url.searchParams.set('code', code)

    if (typeof state === 'string') {
        url.searchParams.set('state', state)
    }

    res.redirect(`${url}`)

    // render(
    //     res,
    //     Layout({
    //         children: ErrorCard({
    //             title: 'Not Finished',
    //             message: 'The authorization endpoint is not finished yet.',
    //         }),
    //     }),
    // )
})

export default router

// test http://localhost:8080/oauth/authorize?response_type=code&client_id=api-panel&code_challenge=eIVsW83uLPZmbiKwsR7J86HuUoMqpAWFuoLyo36gpaU&code_challenge_method=S256&redirect_uri=http://localhost:8080/oauth/callback

function discordLogin(req: Request, res: Response) {
    res.cookie('oauth_ctx', JSON.stringify(req.query), {
        httpOnly: true,
        secure: envs.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60 * 1000,
    })
    return res.redirect(
        `https://discord.com/oauth2/authorize?client_id=${envs.DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(envs.DISCORD_REDIRECT_URI)}&scope=identify`,
    )
}
