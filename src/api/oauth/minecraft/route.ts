import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    UnauthorizedError,
} from '#/api/errors.ts'
import { envs } from '#/config.ts'
import { PLAYER_STATUS } from '#/db/generated/enums.ts'
import { db } from '#/db/prisma.ts'
import { getSessionCookie, parseScopes } from '#/utils/api.ts'
import {
    decrypt,
    encrypt,
    generateCodeChallenge,
    generateCodeVerifier,
    verifyToken,
} from '#/utils/encript.ts'
import { Router, type Request, type Response as ExpressResponse } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const router = Router()
const MICROSOFT_OAUTH_COOKIE = 'minecraft-oauth'
const MICROSOFT_AUTHORIZE_URL =
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize'
const MICROSOFT_TOKEN_URL =
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const MICROSOFT_REDIRECT_URI = new URL(
    '/oauth/minecraft/callback',
    envs.API_URL,
).toString()

const MicrosoftTokenSchema = z.object({
    access_token: z.string().min(1),
})

const XboxTokenSchema = z.object({
    Token: z.string().min(1),
    DisplayClaims: z.object({
        xui: z.array(
            z.object({
                uhs: z.string().min(1),
            }),
        ),
    }),
})

const MinecraftTokenSchema = z.object({
    access_token: z.string().min(1),
})

const MinecraftProfileSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
})

interface MinecraftOAuthContext {
    code_verifier: string
    state: string
    user_id: string
}

router.get('/', async (req, res) => {
    const userId = await getAuthenticatedUserId(req)
    const state = randomUUID()
    const codeVerifier = generateCodeVerifier()
    const context: MinecraftOAuthContext = {
        code_verifier: codeVerifier,
        state,
        user_id: userId,
    }

    res.cookie(
        MICROSOFT_OAUTH_COOKIE,
        encrypt(JSON.stringify(context)).payload,
        {
            httpOnly: true,
            secure: envs.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/oauth/minecraft',
            maxAge: 10 * 60 * 1000,
        },
    )

    return res.redirect(
        `${MICROSOFT_AUTHORIZE_URL}?${new URLSearchParams({
            client_id: envs.MICROSOFT_CLIENT_ID,
            response_type: 'code',
            redirect_uri: MICROSOFT_REDIRECT_URI,
            response_mode: 'query',
            scope: 'XboxLive.SignIn offline_access',
            state,
            code_challenge: generateCodeChallenge(codeVerifier),
            code_challenge_method: 'S256',
            prompt: 'select_account',
        })}`,
    )
})

router.get('/callback', async (req, res) => {
    const context = getMinecraftOAuthContext(req)
    const { code, state } = req.query

    if (
        !context ||
        typeof code !== 'string' ||
        typeof state !== 'string' ||
        context.state !== state
    ) {
        clearMinecraftOAuthCookie(res)
        throw new BadRequestError('Invalid Minecraft OAuth context.')
    }

    clearMinecraftOAuthCookie(res)

    const microsoftToken = await exchangeMicrosoftCode(
        code,
        context.code_verifier,
    )
    const xboxToken = await authenticateXboxLive(microsoftToken.access_token)
    const userHash = xboxToken.DisplayClaims.xui[0]?.uhs

    if (!userHash) {
        throw new BadRequestError('Microsoft did not return an Xbox user.')
    }

    const xstsToken = await authorizeXboxServices(xboxToken.Token)
    const minecraftToken = await authenticateMinecraft(
        userHash,
        xstsToken.Token,
    )
    const profile = await getMinecraftProfile(minecraftToken.access_token)
    const linkedPlayer = await linkMinecraftProfile(context.user_id, profile)

    return res.json({
        linked: true,
        mc_player: linkedPlayer,
    })
})

async function getAuthenticatedUserId(req: Request) {
    const bearerToken =
        req.headers.authorization?.startsWith('Bearer ') ?
            req.headers.authorization.slice('Bearer '.length)
        :   null
    const verified =
        bearerToken ?
            await verifyToken<{
                sub: string
                session_id: string
                scope: string
            }>(bearerToken)
        :   await getSessionCookie(req)

    if (!verified || typeof verified.payload.sub !== 'string') {
        throw new UnauthorizedError()
    }

    if (!parseScopes(verified.payload.scope).includes('minecraft')) {
        throw new ForbiddenError('Missing required scope: minecraft.')
    }

    if (bearerToken) {
        const sessionId = verified.payload.session_id
        if (typeof sessionId !== 'string') {
            throw new UnauthorizedError()
        }

        const session = await db.session.findUnique({
            where: { id: sessionId },
            select: {
                expires_at: true,
                user_id: true,
            },
        })

        if (
            !session ||
            session.expires_at < new Date() ||
            session.user_id !== verified.payload.sub
        ) {
            throw new UnauthorizedError('Invalid or expired OAuth session.')
        }
    }

    return verified.payload.sub
}

function getMinecraftOAuthContext(req: Request) {
    try {
        const encrypted = req.cookies[MICROSOFT_OAUTH_COOKIE]
        const parsed = JSON.parse(decrypt(encrypted)) as MinecraftOAuthContext

        if (
            typeof parsed.code_verifier !== 'string' ||
            typeof parsed.state !== 'string' ||
            typeof parsed.user_id !== 'string'
        ) {
            return null
        }

        return parsed
    } catch {
        return null
    }
}

function clearMinecraftOAuthCookie(res: ExpressResponse) {
    res.clearCookie(MICROSOFT_OAUTH_COOKIE, {
        path: '/oauth/minecraft',
    })
}

async function exchangeMicrosoftCode(code: string, codeVerifier: string) {
    const request = await fetch(MICROSOFT_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: envs.MICROSOFT_CLIENT_ID,
            client_secret: envs.MICROSOFT_CLIENT_SECRET,
            code,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: MICROSOFT_REDIRECT_URI,
            scope: 'XboxLive.SignIn offline_access',
        }),
    })

    return parseApiResponse(request, MicrosoftTokenSchema, 'Microsoft')
}

async function authenticateXboxLive(microsoftAccessToken: string) {
    const request = await fetch(
        'https://user.auth.xboxlive.com/user/authenticate',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                Properties: {
                    AuthMethod: 'RPS',
                    SiteName: 'user.auth.xboxlive.com',
                    RpsTicket: `d=${microsoftAccessToken}`,
                },
                RelyingParty: 'http://auth.xboxlive.com',
                TokenType: 'JWT',
            }),
        },
    )

    return parseApiResponse(request, XboxTokenSchema, 'Xbox Live')
}

async function authorizeXboxServices(xboxToken: string) {
    const request = await fetch(
        'https://xsts.auth.xboxlive.com/xsts/authorize',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                Properties: {
                    SandboxId: 'RETAIL',
                    UserTokens: [xboxToken],
                },
                RelyingParty: 'rp://api.minecraftservices.com/',
                TokenType: 'JWT',
            }),
        },
    )

    return parseApiResponse(
        request,
        XboxTokenSchema,
        'Xbox Secure Token Service',
    )
}

async function authenticateMinecraft(userHash: string, xstsToken: string) {
    const request = await fetch(
        'https://api.minecraftservices.com/authentication/login_with_xbox',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
            }),
        },
    )

    return parseApiResponse(request, MinecraftTokenSchema, 'Minecraft')
}

async function getMinecraftProfile(minecraftAccessToken: string) {
    const request = await fetch(
        'https://api.minecraftservices.com/minecraft/profile',
        {
            headers: {
                Authorization: `Bearer ${minecraftAccessToken}`,
            },
        },
    )

    return parseApiResponse(
        request,
        MinecraftProfileSchema,
        'Minecraft profile',
    )
}

async function parseApiResponse<T>(
    request: Response,
    schema: z.ZodType<T>,
    service: string,
) {
    const body: unknown = await request.json().catch(() => null)

    if (!request.ok) {
        throw new BadRequestError(`${service} authentication failed.`, {
            status: request.status,
        })
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        throw new BadRequestError(`${service} returned an invalid response.`)
    }

    return parsed.data
}

async function linkMinecraftProfile(
    userId: string,
    profile: z.infer<typeof MinecraftProfileSchema>,
) {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: {
            discord_user_id: true,
        },
    })

    if (!user) {
        throw new UnauthorizedError()
    }

    const [playerByUuid, playerByDiscord, playerByNickname] = await Promise.all(
        [
            db.player.findUnique({
                where: { uuid: profile.id },
                select: { discord_user_id: true },
            }),
            db.player.findUnique({
                where: { discord_user_id: user.discord_user_id },
                select: { uuid: true },
            }),
            db.player.findUnique({
                where: { nickname: profile.name },
                select: { uuid: true },
            }),
        ],
    )

    if (playerByUuid && playerByUuid.discord_user_id !== user.discord_user_id) {
        throw new ConflictError(
            'This Minecraft account is linked to another Discord account.',
        )
    }

    if (playerByDiscord && playerByDiscord.uuid !== profile.id) {
        throw new ConflictError(
            'This Discord account is linked to another Minecraft account.',
        )
    }

    if (playerByNickname && playerByNickname.uuid !== profile.id) {
        throw new ConflictError(
            'This Minecraft nickname belongs to another stored profile.',
        )
    }

    const player = await db.$transaction(async transaction => {
        const linkedPlayer = await transaction.player.upsert({
            where: { uuid: profile.id },
            create: {
                uuid: profile.id,
                nickname: profile.name,
                discord_user_id: user.discord_user_id,
                status: PLAYER_STATUS.ACTIVE,
            },
            update: {
                nickname: profile.name,
                status: PLAYER_STATUS.ACTIVE,
            },
            select: {
                nickname: true,
                uuid: true,
            },
        })

        await transaction.user.update({
            where: { id: userId },
            data: {
                mc_player_uuid: profile.id,
            },
        })

        return linkedPlayer
    })

    return player
}

export default router
