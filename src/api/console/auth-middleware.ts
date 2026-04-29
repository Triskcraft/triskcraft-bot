import { type Request, type Response, type NextFunction } from 'express'
import { type DiscordAccessTokenResponse } from '#/utils/api.ts'
import { PUBLIC_KEY } from '#/config.ts'
import { jwtVerify } from 'jose'

function parseCookie(cookie: string) {
    try {
        return JSON.parse(cookie) as Omit<DiscordAccessTokenResponse, 'scope'> // TODO: validate
    } catch {
        return null
    }
}

function getSessionCookie(req: Request) {
    try {
        const cookie = req.cookies['session'] ?? ''
        return parseCookie(cookie)
    } catch {
        return null
    }
}

async function verifyToken(token: string) {
    try {
        return await jwtVerify(token, PUBLIC_KEY)
    } catch {
        return null
    }
}

export async function checkAuthToken(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const cookie = getSessionCookie(req)
    if (!cookie) {
        return res.redirect('/login')
    }

    const payload = await verifyToken(cookie.access_token)
    if (!payload) {
        return res.redirect('/login')
    }

    next()
}
