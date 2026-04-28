import { envs, PUBLIC_KEY } from '#/config.ts'
import type { Request } from 'express'
import { jwtVerify } from 'jose'

export async function getSession(req: Request) {
    const discord = getDiscordAccessCookie(req)
    const session = await getSessionCookie(req)
    return { discord, session }
}

export function getOauthCtxCookie(req: Request) {
    try {
        return JSON.parse(req.cookies['oauth_ctx']) // TODO: validate this
    } catch {
        return null
    }
}

export interface DiscordAccessTokenResponse {
    token_type: 'Bearer'
    access_token: string
    expires_in: number
    refresh_token: string
    scope: string
}
export function getDiscordAccessCookie(req: Request) {
    try {
        return JSON.parse(
            req.cookies['discord_access'],
        ) as DiscordAccessTokenResponse // TODO: validate this as {DiscordAccessTokenResponse}
    } catch {
        return null
    }
}
// interface DiscordAccessTokenResponse {
//     token_type: 'Bearer'
//     access_token: string
//     expires_in: number
//     refresh_token: string
//     scope: string
// }
export async function getSessionCookie(req: Request) {
    try {
        const cookie = req.cookies['session'] ?? '' // TODO: validate this as {DiscordAccessTokenResponse}
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

    const request = await fetch('https://discord.com', {
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
