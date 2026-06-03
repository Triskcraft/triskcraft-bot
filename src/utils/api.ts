import { envs, PRIVATE_KEY, PUBLIC_KEY } from '#/config.ts'
import type { Request } from 'express'
import { SignJWT } from 'jose'
import { jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose'
import { z } from 'zod'

export const OAUTH_SCOPES = ['openid', 'identify', 'minecraft'] as const
export type OAuthScope = (typeof OAUTH_SCOPES)[number]

export function parseScopes(scope: unknown): OAuthScope[] {
    if (typeof scope !== 'string') {
        return []
    }

    const requested = new Set(
        scope
            .split(/\s+/)
            .map(s => s.trim())
            .filter(Boolean),
    )

    return OAUTH_SCOPES.filter(scope => requested.has(scope))
}

export function serializeScopes(scopes: readonly OAuthScope[]) {
    return scopes.join(' ')
}

const OAuthCtxSchema = z.record(z.string(), z.string())
export type OAuthCtx = z.infer<typeof OAuthCtxSchema>

const DiscordAccessSchema = z.object({
    token_type: z.literal('Bearer'),
    access_token: z.string().min(1),
    expires_in: z.number(),
    refresh_token: z.string().min(1),
    scope: z.string(),
})
export type DiscordAccessTokenResponse = z.infer<typeof DiscordAccessSchema>

export async function getSession(req: Request) {
    const discord = getDiscordAccessCookie(req)
    const session = await getSessionCookie(req)
    return { discord, session }
}

export function getOauthCtxCookie(req: Request): OAuthCtx | null {
    try {
        const raw = JSON.parse(req.cookies['oauth_ctx'])
        return OAuthCtxSchema.safeParse(raw).data ?? null
    } catch {
        return null
    }
}

export function getDiscordAccessCookie(
    req: Request,
): DiscordAccessTokenResponse | null {
    try {
        const raw = JSON.parse(req.cookies['discord_access'])
        return DiscordAccessSchema.safeParse(raw).data ?? null
    } catch {
        return null
    }
}
export async function getSessionCookie(req: Request) {
    try {
        const cookie = req.cookies['session'] ?? ''
        return await jwtVerify(cookie, PUBLIC_KEY)
    } catch {
        return null
    }
}

export async function refreshToken(refresh_token: string) {
    const params = new URLSearchParams({
        client_id: envs.DISCORD_CLIENT_ID,
        client_secret: envs.DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token,
    })

    const request = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        body: params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    })

    if (!request.ok) {
        return null
    }

    const response = await request.json()
    return response as DiscordAccessTokenResponse
}

export interface JWTPayload extends JoseJWTPayload {
    aud: string
    client_id: string
    scope: string
    sub: string
    session_id: string
}
export async function createJWT(payload: JWTPayload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setIssuer(envs.API_URL)
        .setExpirationTime('1h')
        .sign(PRIVATE_KEY)
}
